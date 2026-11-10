import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateNpmAudit } from './audit-dependencies.mjs';

const zero = { info: 0, low: 0, moderate: 0, high: 0, critical: 0, total: 0 };
const clean = () => ({ auditReportVersion: 2, vulnerabilities: {}, metadata: { vulnerabilities: { ...zero } } });
const evaluate = (report, scope = 'frontend') => evaluateNpmAudit(report, { scope });
function finding(name, severity, via = []) {
  const report = clean();
  report.vulnerabilities[name] = { severity, via };
  report.metadata.vulnerabilities[severity] = 1;
  report.metadata.vulnerabilities.total = 1;
  return report;
}

test('clean frontend and backend audits pass without exceptions', () => {
  for (const scope of ['frontend', 'backend']) {
    assert.deepEqual(evaluate(clean(), scope), { passed: true, counts: zero, deferred: [] });
  }
});

test('every severity fails in both scopes', () => {
  for (const scope of ['frontend', 'backend']) {
    for (const severity of ['info', 'low', 'moderate', 'high', 'critical']) {
      assert.equal(evaluate(finding('dependency', severity), scope).passed, false);
    }
  }
});

test('the former ECharts advisory and its word-cloud propagation are no longer exempt', () => {
  const report = finding('echarts', 'moderate', [{ name: 'echarts', severity: 'moderate',
    url: 'https://github.com/advisories/GHSA-fgmj-fm8m-jvvx' }]);
  assert.equal(evaluate(report).passed, false);
  report.vulnerabilities['echarts-wordcloud'] = { severity: 'moderate', via: ['echarts'] };
  report.metadata.vulnerabilities.moderate = 2;
  report.metadata.vulnerabilities.total = 2;
  assert.deepEqual(evaluate(report).deferred, []);
  assert.equal(evaluate(report).passed, false);
});

test('malformed, unavailable and contradictory registry responses fail closed', () => {
  const inconsistent = clean();
  inconsistent.metadata.vulnerabilities.high = 1;
  inconsistent.metadata.vulnerabilities.total = 1;
  const hiddenFinding = clean();
  hiddenFinding.vulnerabilities.package = { severity: 'low' };
  for (const report of [{}, { ...clean(), error: { code: 'NETWORK' } },
    { ...clean(), auditReportVersion: 99 }, inconsistent, hiddenFinding]) {
    assert.throws(() => evaluate(report));
  }
  assert.throws(() => evaluate(clean(), 'unknown'));
});
