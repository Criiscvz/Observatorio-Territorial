import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

const root = fileURLToPath(new URL('../', import.meta.url));
export const reviewed = Object.freeze({
  name: '@ryotsu/picomatch', version: '4.0.7-a',
  spec: 'npm:@ryotsu/picomatch@4.0.7-a',
  resolved: 'https://registry.npmjs.org/@ryotsu/picomatch/-/picomatch-4.0.7-a.tgz',
  integrity: 'sha512-JroBFEmaejC7szGSfqOhF1QZHLKvX2wTA1+fWyfkpy3BjzdQKNPLKa2FtgeKVUDy5/UPUNkXEeCHJ5ZRBMLTVA==',
});
const hashes = Object.freeze({
  'index.js': '02ae26406508e28f9ba0865be16cf77f0b33de6c4d4d49c212c4176df1d5625a',
  'posix.js': '5695ff5dfcd5a338a40630bd506056f2950bcb08fe1cc068519cbbfe60add480',
  'lib/constants.js': 'cdcb0716c3c7137f34fbec4fe29613de0aaa0a7de01505601ef3a88a5ba05fb0',
  'lib/parse.js': 'a59b25c67cce014f5226836f8391cb1f323dc76224dc82b85c6826d10b33922a',
  'lib/picomatch.js': 'fdd249d7ffff853f3bb1c77eafc8baa1a437bea85a94c35877b83c6a40d9ca94',
  'lib/scan.js': '6457a1764e5c2e543cc3a0c00ce12ebb3764097628868198370b64d4e642aaae',
  'lib/utils.js': 'f04604f70cd1a3f6ace80b84766468674ff38b4bb83818d2ef1d81fc6355f935',
  LICENSE: 'd0cd141b0c322fded5dfad1d4645bb2fedfc05b7321fe1009469638190d59ef9',
  'package.json': '6a17af861b7ade307d1cc64a389823d3ce0307d78b80eb38f9e110bacac999fc',
});

export function verifyLock(manifest, lock) {
  assert.equal(manifest.overrides?.picomatch, reviewed.spec, 'The reviewed override is required.');
  const entries = Object.entries(lock.packages).filter(([key, value]) =>
    key.endsWith('/picomatch') || value.name === 'picomatch' || value.name === reviewed.name);
  assert(entries.length > 0, 'The reviewed matcher must be installed.');
  for (const [, value] of entries) {
    for (const key of ['name', 'version', 'resolved', 'integrity']) assert.equal(value[key], reviewed[key]);
    assert.equal(value.dev, true, 'Do not introduce the fork into runtime dependencies.');
  }
  return entries.map(([key]) => key);
}

export function verifyPackage(directory) {
  assert(!lstatSync(directory).isSymbolicLink(), 'Registry package must not be a link.');
  const expected = ['LICENSE', 'README.md', 'index.js', 'lib', 'package.json', 'posix.js'];
  assert.deepEqual(readdirSync(directory).sort(), expected.sort(), 'Unexpected package contents.');
  assert.deepEqual(readdirSync(join(directory, 'lib')).sort(),
    ['constants.js', 'parse.js', 'picomatch.js', 'scan.js', 'utils.js']);
  for (const [file, hash] of Object.entries(hashes)) {
    const target = join(directory, file);
    assert(lstatSync(target).isFile() && !lstatSync(target).isSymbolicLink());
    assert.equal(createHash('sha256').update(readFileSync(target)).digest('hex'), hash, 'Unreviewed package file: ' + file);
  }
}

export function checkUpstreamAdvisories(report) {
  assert(report && typeof report === 'object' && !Array.isArray(report));
  assert(Object.keys(report).every(key => key === 'picomatch'), 'Unexpected upstream audit response.');
  const findings = Object.hasOwn(report, 'picomatch') ? report.picomatch : [];
  assert(Array.isArray(findings), 'Invalid upstream advisories.');
  assert(findings.length <= 1, 'Additional upstream findings require review.');
  for (const finding of findings) {
    // This exact report is covered by the reviewed code and bounded probes.
    // A renamed npm package must not conceal future advisories on its source.
    assert.equal(finding.url, 'https://github.com/advisories/GHSA-fc5q-39xc-vjpf', 'Unreviewed upstream advisory.');
    assert.equal(finding.title, 'picomatch vulnerable to ReDoS through single-branch repeated extglobs');
    assert.equal(finding.vulnerable_versions, '<=4.0.7', 'Changed upstream affected range requires review.');
    assert.equal(finding.severity, 'high');
  }
  return { originalVersion: '4.0.7', reviewedPatchedAdvisories: findings.length, unresolvedAdvisories: 0 };
}

async function auditUpstream() {
  const response = await fetch('https://registry.npmjs.org/-/npm/v1/security/advisories/bulk', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ picomatch: ['4.0.7'] }), redirect: 'error', signal: AbortSignal.timeout(30000),
  });
  assert(response.ok, 'The upstream advisory registry must be available.');
  return checkUpstreamAdvisories(await response.json());
}

const vectors = [
  ['+(*a)', 'a'.repeat(40) + '!'], ['*(a*)b', 'a'.repeat(40) + '!'],
  ['+(*)a', 'a'.repeat(40) + '!'], ['+(*a*)b', 'a'.repeat(40) + '!'],
  ['+(@(*a))', 'a'.repeat(40) + '!'], ['*(@(*a))b', 'a'.repeat(40) + '!'],
  ['+([a]*a)', 'a'.repeat(40) + '!'], ['+(*?a)', 'a'.repeat(40) + '!'],
  ['+(a|aa)', 'a'.repeat(40) + '!'], ['*(+(a))', 'a'.repeat(40) + '!'],
];
function verifyMatching(directory) {
  // Each probe is a separate bounded process: an unsafe regex cannot hang CI.
  const probe = `const p=require(process.argv[1]),d=JSON.parse(process.argv[2]);
    for(const o of [{},{capture:true},{fastpaths:false},{windows:true}]){
      const re=p.makeRe(d.pattern,o); for(let i=0;i<10;i++){
        if(re.test(d.input))throw new Error('Attack input unexpectedly matched');
      }
    } process.stdout.write('ok');`;
  for (const [pattern, input] of vectors) {
    const result = spawnSync(process.execPath, ['--max-old-space-size=64', '-e', probe, directory,
      JSON.stringify({ pattern, input })], { encoding: 'utf8', timeout: 5000, windowsHide: true });
    assert(!result.error && result.status === 0 && result.stdout === 'ok', 'Unsafe or broken matcher for ' + pattern);
  }
  const require = createRequire(join(directory, 'package.json'));
  const pm = require(directory);
  for (const [pattern, input, expected, options] of [
    ['**/*.{ts,html}', 'src/app/page.ts', true], ['**/*.ts', 'src/page.css', false],
    ['**/!(*.spec).ts', 'src/page.spec.ts', false], ['**/!(*.spec).ts', 'src/page.ts', true],
    ['**/.git/**', '.git/config', true, { dot: true }],
    ['**/*.php', 'app/Domain/Example.php', true], ['+(foo|bar)', 'foobar', true],
    ['!*.js', 'test.js', false], ['*.js', 'file.js', true],
    ['**/*.js', 'dir\\file.js', true, { windows: true }],
  ]) assert.equal(pm.isMatch(input, pattern, options), expected, 'Matcher contract: ' + pattern);
}

async function verifyReload() {
  const { default: plugin, normalizePaths } = await import('../backend/node_modules/vite-plugin-full-reload/dist/index.js');
  const listeners = new Map(), sent = [], watched = [];
  const configRoot = resolve(root, 'synthetic-reload-root');
  const patterns = ['resources/views/**/*.blade.php', 'routes/**'];
  plugin(patterns, { root: configRoot, log: false }).configureServer({
    watcher: { add: files => watched.push(...files), on: (event, callback) => listeners.set(event, callback) },
    ws: { send: event => sent.push(event) }, config: { logger: { info() {} } },
  });
  assert.deepEqual(watched, normalizePaths(configRoot, patterns));
  const normalize = file => join(configRoot, file).replaceAll('\\', '/');
  listeners.get('change')(normalize('resources/views/example.blade.php'));
  listeners.get('add')(normalize('routes/example.php'));
  listeners.get('change')(normalize('storage/private.csv'));
  await delay(10);
  assert.deepEqual(sent, [{ type: 'full-reload', path: '*' }, { type: 'full-reload', path: '*' }]);
}

export async function verifyScope(scope) {
  assert(['backend', 'frontend'].includes(scope), 'Use backend or frontend.');
  const directory = join(root, scope);
  const manifest = JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8'));
  const lock = JSON.parse(readFileSync(join(directory, 'package-lock.json'), 'utf8'));
  const packages = verifyLock(manifest, lock), installed = new Set();
  for (const key of packages) {
    const target = join(directory, key);
    verifyPackage(target); verifyMatching(target); installed.add(target);
  }
  let consumers = 0;
  for (const [key, value] of Object.entries(lock.packages)) {
    if (!key || !(value.dependencies?.picomatch || value.peerDependencies?.picomatch)) continue;
    const consumer = join(directory, key, 'package.json');
    if (!existsSync(consumer) && value.optional) continue;
    assert(existsSync(consumer), 'Missing dependency consumer: ' + key);
    const resolved = createRequire(consumer).resolve('picomatch/package.json');
    assert(installed.has(dirname(resolved)), 'A consumer still resolves an unreviewed copy: ' + key);
    consumers++;
  }
  if (scope === 'backend') await verifyReload();
  return { scope, installedCopies: installed.size, consumers, boundedAttackCases: vectors.length * installed.size,
    reloadVerified: scope === 'backend', reviewedVersion: reviewed.version };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const installed = await verifyScope(process.argv[2]);
    console.log(JSON.stringify({ ok: true, ...installed, upstream: await auditUpstream() }));
  }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
