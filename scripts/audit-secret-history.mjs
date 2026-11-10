import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, realpath, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { scanAllReachableHistory, scanDirectory, trackedSnapshot } from './scan-secrets.mjs';
import { scanCredentialHistory } from './audit-credential-history.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
let snapshot;
try {
  const shallow = spawnSync('git', ['rev-parse', '--is-shallow-repository'], { cwd: root, encoding: 'utf8' });
  assert(shallow.status === 0 && shallow.stdout.trim() === 'false', 'A complete local clone is required.');
  const commits = spawnSync('git', ['rev-list', '--all', '--count'], { cwd: root, encoding: 'utf8' });
  assert(commits.status === 0 && /^\d+$/.test(commits.stdout.trim()), 'Could not inventory reachable commits.');
  snapshot = await trackedSnapshot(root);
  const currentFindings = await scanDirectory(snapshot);
  const historyFindings = await scanAllReachableHistory(root);
  const credentialCandidates = scanCredentialHistory(root);
  const report = { auditedAt: new Date().toISOString(), reachableCommits: Number(commits.stdout.trim()),
    scope: 'current tracked files and all history reachable from local refs; no reflogs or unreachable objects',
    redacted: true, currentFindings, historyFindings, credentialCandidates };
  const output = join(root, 'storage/codex-local/phase1');
  await mkdir(output, { recursive: true });
  await writeFile(join(output, 'secret-history-metadata.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ redacted: true, reachableCommits: report.reachableCommits,
    currentFindings: currentFindings.length, historicalFindings: historyFindings.length,
    credentialCandidates: credentialCandidates.length,
    report: 'storage/codex-local/phase1/secret-history-metadata.json' }));
  if (currentFindings.length || historyFindings.length || credentialCandidates.length) process.exitCode = 1;
} catch {
  console.error('History audit failed; source values and raw diagnostics suppressed.');
  process.exitCode = 1;
} finally {
  if (snapshot) {
    const actual = await realpath(snapshot);
    assert(basename(actual).startsWith('observatorio-tracked-scan-'));
    assert.equal(dirname(actual), await realpath(tmpdir()));
    await rm(actual, { recursive: true, force: true });
  }
}
