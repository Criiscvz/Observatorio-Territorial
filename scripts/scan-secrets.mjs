import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFile, lstat, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
export const scannerVersion = '8.30.1';

export function requireScanner(binary = process.env.GITLEAKS_BIN || 'gitleaks') {
  const result = spawnSync(binary, ['version'], { encoding: 'utf8', timeout: 10000, windowsHide: true });
  assert(!result.error && result.status === 0 && result.stdout.trim() === scannerVersion,
    `Gitleaks ${scannerVersion} is required; run scripts/install-gitleaks.mjs first.`);
  return binary;
}

async function runScan(directory, mode, extra, { config = join(root, '.gitleaks.toml'), binary } = {}) {
  binary = requireScanner(binary);
  const reportRoot = await mkdtemp(join(tmpdir(), 'observatorio-secret-report-'));
  try {
    const reportPath = join(reportRoot, 'report.json');
    const ignorePath = join(reportRoot, '.gitleaksignore');
    await writeFile(ignorePath, '', { mode: 0o600 });
    const result = spawnSync(binary, [mode, directory, ...extra, '--config', config,
      '--no-banner', '--no-color', '--redact=100', '--ignore-gitleaks-allow',
      '--gitleaks-ignore-path', ignorePath, '--report-format=json', '--report-path', reportPath,
      '--exit-code=1', '--log-level=error', '--timeout=120'],
    { encoding: 'utf8', timeout: 130000, maxBuffer: 4 * 1024 * 1024, windowsHide: true });
    // Never forward scanner stdout/stderr or source/Secret/Match report fields.
    assert(!result.error && [0, 1].includes(result.status), 'Gitleaks failed; raw diagnostics suppressed.');
    const report = JSON.parse(await readFile(reportPath, 'utf8'));
    assert(Array.isArray(report), 'Unexpected scanner report; contents suppressed.');
    const findings = report.map(item => {
      const path = isAbsolute(item.File) ? relative(directory, item.File) : item.File;
      assert(path && !path.startsWith('..') && !isAbsolute(path), 'Invalid scanner path; contents suppressed.');
      assert(Number.isInteger(item.StartLine) && /^[a-z0-9-]+$/.test(item.RuleID), 'Invalid scanner metadata.');
      const finding = { file: path.replaceAll('\\', '/'), line: item.StartLine, rule: item.RuleID };
      if (mode === 'git') {
        assert(/^[a-f0-9]{40}$/.test(item.Commit), 'Invalid scanner commit metadata.');
        finding.commit = item.Commit;
      }
      return finding;
    });
    assert.equal(result.status === 0, findings.length === 0, 'Inconsistent scanner result.');
    return findings;
  } finally {
    await rm(reportRoot, { recursive: true, force: true });
  }
}

export const scanDirectory = (directory, options) => runScan(directory, 'dir', [], options);

export function scanHistory(repository, base, head, options) {
  assert(/^[a-f0-9]{40}$/.test(base) && /^[a-f0-9]{40}$/.test(head), 'Only full commit SHAs are accepted.');
  assert(!/^0{40}$/.test(base), 'A new ref has no bounded history range; review it separately.');
  return runScan(repository, 'git', [`--log-opts=${base}..${head} --no-ext-diff`], options);
}

export async function trackedSnapshot(repository) {
  const result = spawnSync('git', ['ls-files', '--stage', '-z'],
    { cwd: repository, encoding: 'utf8', timeout: 10000 });
  assert(!result.error && result.status === 0, 'Could not read tracked path metadata.');
  const directory = await mkdtemp(join(tmpdir(), 'observatorio-tracked-scan-'));
  try {
    for (const entry of result.stdout.split('\0').filter(Boolean)) {
      const match = entry.match(/^(100644|100755) [a-f0-9]+ 0\t(.+)$/s);
      assert(match, 'Only regular, conflict-free tracked files may be scanned.');
      const path = match[2];
      const source = resolve(repository, path);
      const destination = resolve(directory, path);
      for (const [parent, target] of [[repository, source], [directory, destination]]) {
        const within = relative(parent, target);
        assert(within && !within.startsWith('..') && !isAbsolute(within), 'Tracked path escaped snapshot.');
      }
      assert((await lstat(source)).isFile(), 'Refusing non-regular tracked source.');
      await mkdir(dirname(destination), { recursive: true });
      await copyFile(source, destination);
    }
    return directory;
  } catch (error) {
    await rm(directory, { recursive: true, force: true });
    throw error;
  }
}

async function main() {
  let directory;
  try {
    directory = await trackedSnapshot(root);
    const snapshotFindings = await scanDirectory(directory);
    const base = process.env.SCAN_BASE || '';
    const head = process.env.SCAN_HEAD || '';
    const event = process.env.SCAN_EVENT || '';
    const historyRequired = ['pull_request', 'push'].includes(event);
    assert(!historyRequired || (base && head), 'The CI event must supply a bounded commit range.');
    const historyFindings = base || head ? await scanHistory(root, base, head) : [];
    const passed = snapshotFindings.length === 0 && historyFindings.length === 0;
    console.log(JSON.stringify({ scanner: `gitleaks ${scannerVersion}`, scope: 'current tracked files',
      historyScanned: Boolean(base && head), fullHistoryAudited: false, redacted: true,
      snapshotFindings, historyFindings, passed }, null, 2));
    if (!passed) process.exitCode = 1;
  } catch {
    console.error('Secret scan failed; raw diagnostics and source values suppressed.');
    process.exitCode = 1;
  } finally {
    if (directory) {
      const actual = await realpath(directory);
      assert(basename(actual).startsWith('observatorio-tracked-scan-'));
      assert.equal(dirname(actual), await realpath(tmpdir()));
      await rm(actual, { recursive: true, force: true });
    }
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
