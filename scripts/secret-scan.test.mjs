import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { requireScanner, scanDirectory, scanHistory, trackedSnapshot } from './scan-secrets.mjs';

requireScanner(); // Never silently skip the scanner's regression tests.
const fakeGithubToken = () => 'ghp_' + randomBytes(18).toString('hex');
const publicPowerBi = () => 'https://app.powerbi.com/view?r=' + Buffer.from(JSON.stringify({
  k: '00000000-0000-4000-8000-000000000001',
  t: '00000000-0000-4000-8000-000000000002', c: 4,
})).toString('base64');

async function fixture(files, check) {
  const directory = await mkdtemp(join(tmpdir(), 'observatorio-scan-fixture-'));
  try {
    for (const [path, source] of Object.entries(files)) {
      const target = join(directory, path);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, source);
    }
    await check(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test('a clean template passes', async () => {
  await fixture({ 'example.txt': 'DB_PASSWORD=\nAWS_SECRET_ACCESS_KEY=\n' }, async directory => {
    assert.deepEqual(await scanDirectory(directory), []);
  });
});

test('generated canaries fail without exposing source or secret values', async () => {
  const canary = fakeGithubToken();
  await fixture({ 'source.js': `const token = '${canary}';\n` }, async directory => {
    const findings = await scanDirectory(directory);
    assert(findings.some(item => item.rule === 'github-pat'));
    assert(findings.every(item => Object.keys(item).sort().join(',') === 'file,line,rule'));
    assert(!JSON.stringify(findings).includes(canary));
  });
});

test('inline allow comments cannot bypass the scanner', async () => {
  await fixture({ 'source.js': `const token = '${fakeGithubToken()}'; // gitleaks:allow\n` }, async directory => {
    assert((await scanDirectory(directory)).length > 0);
  });
});

test('canaries in tests and docs are not directory-allowlisted', async () => {
  await fixture({ 'backend/tests/extra.php': `<?php $token = '${fakeGithubToken()}';`,
    'docs/example.md': `token=${fakeGithubToken()}\n` }, async directory => {
    const findings = await scanDirectory(directory);
    assert(findings.some(item => item.file === 'backend/tests/extra.php'));
    assert(findings.some(item => item.file === 'docs/example.md'));
  });
});

test('the reviewed public Power BI view URL passes only at the exact seeder path', async () => {
  const line = `            '${publicPowerBi()}',\n`;
  await fixture({ 'backend/database/seeders/ReporteArticuloSeeder.php': line }, async directory => {
    assert.deepEqual(await scanDirectory(directory), []);
  });
  await fixture({ 'backend/database/seeders/OtherSeeder.php': line }, async directory => {
    assert((await scanDirectory(directory)).some(item => item.rule === 'grafana-api-key'));
  });
});

test('the exception does not hide unrelated credentials in the same seeder', async () => {
  await fixture({ 'backend/database/seeders/ReporteArticuloSeeder.php':
    `'${publicPowerBi()}',\n$token = '${fakeGithubToken()}';\n` }, async directory => {
    assert((await scanDirectory(directory)).some(item => item.rule === 'github-pat'));
  });
});

test('the exception does not allow a Grafana-shaped token outside a public URL line', async () => {
  const payload = publicPowerBi().split('?r=')[1];
  await fixture({ 'backend/database/seeders/ReporteArticuloSeeder.php': `$token = '${payload}';\n` }, async directory => {
    assert((await scanDirectory(directory)).some(item => item.rule === 'grafana-api-key'));
  });
});

test('the tracked snapshot excludes an untracked environment file and private output', async () => {
  await fixture({ 'source.txt': 'clean source\n', '.env': `TOKEN=${fakeGithubToken()}\n`,
    'backend/storage/app/private/notes.txt': fakeGithubToken() }, async directory => {
    for (const args of [['init', '--quiet'], ['add', '--', 'source.txt']]) {
      const result = spawnSync('git', args, { cwd: directory, encoding: 'utf8' });
      assert.equal(result.status, 0, 'Synthetic Git fixture failed.');
    }
    const snapshot = await trackedSnapshot(directory);
    try {
      assert.equal(await readFile(join(snapshot, 'source.txt'), 'utf8'), 'clean source\n');
      await assert.rejects(readFile(join(snapshot, '.env')), { code: 'ENOENT' });
      await assert.rejects(readFile(join(snapshot, 'backend/storage/app/private/notes.txt')), { code: 'ENOENT' });
      assert.deepEqual(await scanDirectory(snapshot), []);
    } finally {
      await rm(snapshot, { recursive: true, force: true });
    }
  });
});

test('a canary committed and then removed is still detected in the new commit range', async () => {
  await fixture({ 'source.txt': 'clean source\n' }, async directory => {
    const git = args => {
      const result = spawnSync('git', ['-c', 'user.name=CI Fixture', '-c', 'user.email=ci@example.test', ...args],
        { cwd: directory, encoding: 'utf8' });
      assert.equal(result.status, 0, 'Synthetic Git history fixture failed.');
      return result.stdout.trim();
    };
    git(['init', '--quiet']);
    git(['add', '--', 'source.txt']);
    git(['commit', '--quiet', '-m', 'clean fixture']);
    const base = git(['rev-parse', 'HEAD']);
    const canary = fakeGithubToken();
    await writeFile(join(directory, 'source.txt'), `token=${canary}\n`);
    git(['commit', '--quiet', '-am', 'introduce synthetic canary']);
    await writeFile(join(directory, 'source.txt'), 'clean source\n');
    git(['commit', '--quiet', '-am', 'remove synthetic canary']);
    const head = git(['rev-parse', 'HEAD']);
    assert.deepEqual(await scanDirectory(directory), []);
    const findings = await scanHistory(directory, base, head);
    assert(findings.some(item => item.rule === 'github-pat' && /^[a-f0-9]{40}$/.test(item.commit)));
    assert(!JSON.stringify(findings).includes(canary));
  });
});

test('untrusted or unbounded history options are rejected before scanner execution', () => {
  assert.throws(() => scanHistory('.', '--all', 'HEAD'));
  assert.throws(() => scanHistory('.', '0'.repeat(40), 'a'.repeat(40)));
});
