import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Exercise Docker's own ignore matcher using synthetic files only. Never build
// from the application's directory, read .env, pull an image, or run a container.
const repository = fileURLToPath(new URL('../', import.meta.url));
const excluded = [
  '.env', '.env.production', '.env.backup', 'nested/.env', 'nested/deep/.env.local',
  'auth.json', 'nested/auth.json', 'local.pem', 'nested/local.key',
  'nested/deep/local.p12', 'local.pfx', 'nested/deep/debug.log', 'nested/source.php.bak',
  '.git/config', '.phpstorm.meta.php', '_ide_helper.php', '_ide_helper_models.php',
  'Dockerfile.devpatch', 'toArray())', 'vendor/fixture.txt', 'node_modules/fixture.txt',
  'storage/app/private/visual-review/report.json',
  'storage/app/public/avatars/fixture.png', 'storage/logs/laravel.log',
  'storage/codex-logs/fixture.txt', 'storage/framework/sessions/fixture.txt',
  'storage/oauth-private.key', 'bootstrap/cache/config.php',
  '.docker-codex/fixture.txt', 'tmp/fixture.json', 'output/fixture.pdf',
];
const included = [
  '.env.example', 'artisan', 'composer.json', 'composer.lock',
  'app/Models/SyntheticModel.php', 'config/app.php',
  'docker/entrypoint.sh', 'docker/nginx.conf', 'public/index.php',
  'resources/views/fixture.blade.php', 'bootstrap/cache/.gitignore',
];

function docker(args, input) {
  const result = spawnSync('docker', args, {
    cwd: repository, input, encoding: 'utf8', timeout: 120_000,
    maxBuffer: 2 * 1024 * 1024,
  });
  assert(!result.error && result.status === 0,
    'Docker context check failed; diagnostic output suppressed (verify the local Docker engine).');
  return result.stdout.trim();
}

async function inventory(directory, prefix = '') {
  const paths = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) paths.push(...await inventory(join(directory, entry.name), path));
    else paths.push(path);
  }
  return paths.sort();
}

// Refuse remote contexts/builders even if the user's current selection changed.
const endpoint = docker(['context', 'inspect', 'default', '--format', '{{.Endpoints.docker.Host}}']);
assert(/^(?:npipe:\/\/|unix:\/\/)/.test(endpoint), 'Only a local Docker socket is allowed.');
assert(/^Driver:\s+docker\s*$/m.test(docker(['--context', 'default', 'buildx', 'inspect', 'default'])),
  'Only the local engine-backed default builder is allowed.');

const temporaryParent = await realpath(tmpdir());
const temporaryRoot = await mkdtemp(join(temporaryParent, 'observatorio-context-hygiene-'));
const context = join(temporaryRoot, 'context');
const output = join(temporaryRoot, 'result');
try {
  await mkdir(context);
  await writeFile(join(context, '.dockerignore'),
    await readFile(resolve(repository, 'backend/.dockerignore')));
  for (const path of [...excluded, ...included]) {
    const target = resolve(context, path);
    assert(!relative(context, target).startsWith('..'), 'Fixture escaped its temporary context.');
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, 'synthetic-fixture-only\n');
  }
  docker(['--context', 'default', 'build', '--builder', 'default', '--pull=false',
    '--network=none', '--no-cache', '--provenance=false', '--progress=plain',
    '--file', '-', '--output', `type=local,dest=${output}`, context],
  'FROM scratch\nCOPY . /\n');
  const actual = new Set(await inventory(output));
  const leaked = excluded.filter(path => actual.has(path));
  const missing = included.filter(path => !actual.has(path));
  assert.deepEqual(leaked, [], 'Synthetic excluded paths reached the COPY result.');
  assert.deepEqual(missing, [], 'Required synthetic application paths were excluded.');
  console.log(JSON.stringify({
    status: 'PASS', excludedFixtures: excluded.length, includedFixtures: included.length,
    syntheticOnly: true, realApplicationContextRead: false, containersRun: false,
    imagesPulled: false, remoteBuilderUsed: false,
  }, null, 2));
} finally {
  // Delete only this process's freshly-created, validated temporary directory.
  const resolvedTemporaryRoot = await realpath(temporaryRoot);
  assert.equal(dirname(resolvedTemporaryRoot), temporaryParent);
  assert(basename(resolvedTemporaryRoot).startsWith('observatorio-context-hygiene-'));
  await rm(resolvedTemporaryRoot, { recursive: true, force: true });
}
