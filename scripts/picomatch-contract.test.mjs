import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { reviewed, verifyLock, checkUpstreamAdvisories } from './verify-picomatch.mjs';

test('every old, renamed or unresolved matcher copy fails the provenance gate', async () => {
  for (const scope of ['backend', 'frontend']) {
    const manifest = JSON.parse(await readFile(new URL('../' + scope + '/package.json', import.meta.url)));
    const lock = JSON.parse(await readFile(new URL('../' + scope + '/package-lock.json', import.meta.url)));
    assert(verifyLock(manifest, lock).length > 0);
    for (const patch of [{ name: 'picomatch' }, { version: '4.0.7' }, { integrity: 'changed' },
      { resolved: 'https://example.invalid/package.tgz' }, { dev: false }]) {
      const changed = structuredClone(lock);
      Object.assign(changed.packages['node_modules/picomatch'], patch);
      assert.throws(() => verifyLock(manifest, changed));
    }
    const nested = structuredClone(lock);
    nested.packages['node_modules/example/node_modules/picomatch'] = { name: 'picomatch', version: '2.3.2' };
    assert.throws(() => verifyLock(manifest, nested));
    assert.throws(() => verifyLock({ overrides: { picomatch: reviewed.spec + '0' } }, lock));
  }
});

test('the alias cannot conceal new, malformed or changed upstream advisories', () => {
  const covered = { url: 'https://github.com/advisories/GHSA-fc5q-39xc-vjpf',
    title: 'picomatch vulnerable to ReDoS through single-branch repeated extglobs',
    vulnerable_versions: '<=4.0.7', severity: 'high' };
  assert.equal(checkUpstreamAdvisories({ picomatch: [covered] }).reviewedPatchedAdvisories, 1);
  assert.equal(checkUpstreamAdvisories({}).unresolvedAdvisories, 0);
  for (const patch of [{ url: 'https://github.com/advisories/GHSA-new' }, { title: 'Another cause' },
    { vulnerable_versions: '*' }, { severity: 'critical' }]) {
    assert.throws(() => checkUpstreamAdvisories({ picomatch: [{ ...covered, ...patch }] }));
  }
  for (const bad of [null, [], { error: {} }, { picomatch: null }, { picomatch: {} },
    { picomatch: [covered, { ...covered, url: 'https://github.com/advisories/GHSA-new' }] }]) {
    assert.throws(() => checkUpstreamAdvisories(bad));
  }
});
