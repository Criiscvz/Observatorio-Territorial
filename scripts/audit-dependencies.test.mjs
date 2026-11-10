import assert from 'node:assert/strict';
import test from 'node:test';
import { echartsReview, evaluateNpmAudit } from './audit-dependencies.mjs';

const zero = { info: 0, low: 0, moderate: 0, high: 0, critical: 0, total: 0 };
const lock = { packages: { 'node_modules/echarts': { version: '5.6.0' } } };
const options = { scope: 'frontend', now: new Date('2026-11-05T12:00:00Z') };
const clean = () => ({ auditReportVersion: 2, vulnerabilities: {}, metadata: { vulnerabilities: { ...zero } } });
function known() {
  return { auditReportVersion: 2, metadata: { vulnerabilities: { ...zero, moderate: 1, total: 1 } },
    vulnerabilities: { echarts: { severity: 'moderate', nodes: ['node_modules/echarts'],
      via: [{ name: 'echarts', severity: 'moderate', url: 'https://github.com/advisories/' + echartsReview.advisory }] } } };
}

test('clean frontend and backend audits pass', () => {
  for (const scope of ['frontend', 'backend']) assert(evaluateNpmAudit(clean(), lock, { ...options, scope }).passed);
});
test('only the recorded version, advisory and review window can be deferred', () => {
  assert(evaluateNpmAudit(known(), lock, options).passed);
  assert(!evaluateNpmAudit(known(), { packages: { 'node_modules/echarts': { version: '5.6.1' } } }, options).passed);
  assert(!evaluateNpmAudit(known(), lock, { ...options, now: new Date('2026-12-06T00:00:00Z') }).passed);
  assert(!evaluateNpmAudit(known(), lock, { ...options, scope: 'backend' }).passed);
});
test('a different moderate advisory or additional dependency fails', () => {
  const report = known();
  report.vulnerabilities.echarts.via[0].url = 'https://github.com/advisories/GHSA-0000-0000-0000';
  assert(!evaluateNpmAudit(report, lock, options).passed);
  const additional = known(); additional.vulnerabilities.glob = { severity: 'moderate', via: [] };
  additional.metadata.vulnerabilities.moderate = 2; additional.metadata.vulnerabilities.total = 2;
  assert(!evaluateNpmAudit(additional, lock, options).passed);
});
test('only the exact word-cloud peer propagation can inherit the recorded finding', () => {
  const report = known();
  report.vulnerabilities['echarts-wordcloud'] = { severity: 'moderate', via: ['echarts'], nodes: ['node_modules/echarts-wordcloud'] };
  report.metadata.vulnerabilities.moderate = 2; report.metadata.vulnerabilities.total = 2;
  const peers = { packages: { ...lock.packages, 'node_modules/echarts-wordcloud': { version: '2.1.0' } } };
  assert(evaluateNpmAudit(report, peers, options).passed);
  report.vulnerabilities['echarts-wordcloud'].via.push('other');
  assert(!evaluateNpmAudit(report, peers, options).passed);
});
test('a severity increase and an unexpected nested copy fail', () => {
  const report = known(); report.vulnerabilities.echarts.severity = 'high';
  assert(!evaluateNpmAudit(report, lock, options).passed);
  const nested = known(); nested.vulnerabilities.echarts.nodes.push('node_modules/other/node_modules/echarts');
  assert(!evaluateNpmAudit(nested, lock, options).passed);
});
test('malformed, error and contradictory registry responses cannot pass as clean', () => {
  for (const report of [{}, { ...clean(), error: { code: 'NETWORK' } },
    { ...clean(), auditReportVersion: 99 }]) assert.throws(() => evaluateNpmAudit(report, lock, options));
  const inconsistent = clean(); inconsistent.metadata.vulnerabilities.high = 1; inconsistent.metadata.vulnerabilities.total = 1;
  assert.throws(() => evaluateNpmAudit(inconsistent, lock, options));
});
