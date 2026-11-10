import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
export function evaluateNpmAudit(report, { scope }) {
  const counts = report?.metadata?.vulnerabilities;
  const findings = report?.vulnerabilities;
  assert(['frontend', 'backend'].includes(scope), 'Unknown dependency scope.');
  assert(report?.auditReportVersion === 2 && !report.error && findings && counts, 'Invalid audit response.');
  for (const key of ['info', 'low', 'moderate', 'high', 'critical', 'total']) {
    assert(Number.isInteger(counts[key]) && counts[key] >= 0, 'Invalid audit counts.');
  }
  const names = Object.keys(findings);
  assert(counts.total === ['info', 'low', 'moderate', 'high', 'critical'].reduce((sum, key) => sum + counts[key], 0)
    && names.length === counts.total, 'Contradictory audit counts.');
  return { passed: names.length === 0, counts, deferred: [] };
}

function main(scope) {
  assert(['frontend', 'backend'].includes(scope), 'Use the frontend or backend audit script.');
  const npm = process.env.npm_execpath;
  assert(npm?.endsWith('npm-cli.js'), 'Run through npm run audit:dependencies.');
  const directory = resolve(root, scope);
  const result = spawnSync(process.execPath, [npm, 'audit', '--package-lock-only', '--json',
    '--include=dev', '--include=optional', '--include=peer', '--registry=https://registry.npmjs.org',
    '--fetch-timeout=30000', '--fetch-retries=1'],
  { cwd: directory, encoding: 'utf8', timeout: 90000, maxBuffer: 8 * 1024 * 1024, windowsHide: true });
  assert(!result.error && [0, 1].includes(result.status), 'Dependency registry unavailable.');
  const report = JSON.parse(result.stdout);
  const evaluation = evaluateNpmAudit(report, { scope });
  console.log(JSON.stringify({ scope, ...evaluation }, null, 2));
  if (!evaluation.passed) process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(process.argv[2]); }
  catch { console.error('Dependency audit failed; no findings were suppressed. Check the registry and lockfile.'); process.exitCode = 1; }
}
