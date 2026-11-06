import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
export const echartsReview = Object.freeze({
  package: 'echarts', version: '5.6.0', advisory: 'GHSA-fgmj-fm8m-jvvx', reviewBy: '2026-12-05',
  reason: 'Word-cloud 2.1.0 requires ECharts 5. LinesChart and full bundles are blocked by lint; the real registry is tested. Migration to ECharts >=6.1.0 remains required.',
});

export function evaluateNpmAudit(report, lock, { scope, now = new Date() }) {
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
  if (names.length === 0 && counts.total === 0) return { passed: true, counts, deferred: [] };
  const finding = findings.echarts;
  const today = now.toISOString().slice(0, 10);
  const cloud = findings['echarts-wordcloud'];
  const inheritedOnly = !cloud || (cloud.severity === 'moderate' && cloud.via?.length === 1 && cloud.via[0] === 'echarts'
    && cloud.nodes?.length === 1 && cloud.nodes[0] === 'node_modules/echarts-wordcloud'
    && lock?.packages?.['node_modules/echarts-wordcloud']?.version === '2.1.0');
  const known = scope === 'frontend' && names.length > 0 && names.every(name => ['echarts', 'echarts-wordcloud'].includes(name))
    && counts.moderate === names.length && !counts.high && !counts.critical && inheritedOnly
    && finding.severity === 'moderate' && finding.via?.length > 0
    && finding.via.every(item => typeof item === 'object'
      && item.name === 'echarts' && item.severity === 'moderate'
      && item.url === 'https://github.com/advisories/' + echartsReview.advisory)
    && finding.nodes?.length === 1 && finding.nodes[0] === 'node_modules/echarts'
    && lock?.packages?.['node_modules/echarts']?.version === echartsReview.version
    && today <= echartsReview.reviewBy;
  return { passed: Boolean(known), counts, deferred: known ? [echartsReview] : [] };
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
  const lock = JSON.parse(readFileSync(resolve(directory, 'package-lock.json'), 'utf8'));
  const evaluation = evaluateNpmAudit(report, lock, { scope });
  console.log(JSON.stringify({ scope, ...evaluation }, null, 2));
  if (!evaluation.passed) process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(process.argv[2]); }
  catch { console.error('Dependency audit failed; no findings were suppressed. Check the registry and lockfile.'); process.exitCode = 1; }
}
