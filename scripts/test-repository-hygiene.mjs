import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import test from 'node:test';
import { credentialLines } from './credential-patterns.mjs';

// Narrow repository regressions, not a general-purpose secret scanner.
// Read tracked path metadata and the explicitly named examples only: never .env.
const root = fileURLToPath(new URL('../', import.meta.url));
const removedArtifacts = [
  'backend/toArray())',
  'backend/_ide_helper_models.php',
  'backend/.phpstorm.meta.php',
  'backend/Dockerfile.devpatch',
  'frontend/src/app/features/datasets/dataset-view/dataset-view.component.ts.bak',
];
const reviewedDocuments = [
  'docs/SDD-Integracion-MongoDB.md',
  'docs/SISTEMA.md',
  'docs/comandos.md',
  'docs/DEPLOY_GRATIS.md',
];

function git(args, input) {
  const result = spawnSync('git', args, { cwd: root, input, encoding: 'utf8' });
  const allowedStatuses = args[0] === 'check-ignore' ? [0, 1] : [0];
  assert(!result.error && allowedStatuses.includes(result.status), 'Git metadata check failed; output suppressed');
  return { status: result.status, output: result.stdout };
}

function isSecretFile(path) {
  const basename = path.split('/').at(-1);
  if (/^\.env(?:\.|$)/.test(basename)) {
    return !/^\.env(?:\.[\w-]+)*\.example$/.test(basename);
  }
  return basename === 'auth.json' || /\.(?:pem|key|p12|pfx)$/i.test(basename);
}

test('the five reviewed artifacts are absent from the Git index', () => {
  const tracked = new Set(git(['ls-files', '-z']).output.split('\0').filter(Boolean));
  assert.deepEqual(removedArtifacts.filter(path => tracked.has(path)), []);
});

test('tracked files contain no environment secrets or local review outputs', () => {
  const paths = git(['ls-files', '-z']).output.split('\0').filter(Boolean);
  const forbidden = paths.filter(path => isSecretFile(path)
    || /^(?:\.worktrees|output|tmp|storage)\//.test(path)
    || /^backend\/storage\/app\/private\/(?!\.gitignore$)/.test(path)
    || /\.(?:log|bak)$/i.test(path));
  assert.deepEqual(forbidden, [], 'Unexpected credential/output paths; no contents read');
});

test('Git ignores local credentials, reviewed artifacts, worktrees and private output', () => {
  const paths = [
    '.env', '.env.production', 'backend/.env', 'backend/.env.testing',
    'frontend/.env.local', 'backend/nested/.env', 'backend/nested/deep/.env.production',
    'backend/auth.json', 'backend/nested/auth.json', 'backend/local.key',
    'backend/nested/local.pem', 'backend/nested/deep/local.p12', 'backend/local.pfx',
    'frontend/nested/debug.log', 'frontend/nested/component.ts.bak', 'root-debug.log',
    '.worktrees/another-checkout/file.txt', 'output/report.pdf',
    'tmp/review.json', 'storage/local.txt',
    'backend/storage/app/private/visual-review/report.json',
    ...removedArtifacts,
  ];
  const ignored = new Set(git(['check-ignore', '--no-index', '--stdin', '-z'], paths.join('\0') + '\0')
    .output.split('\0').filter(Boolean));
  assert.deepEqual(paths.filter(path => !ignored.has(path)), []);
});

test('Git still allows explicit example templates and application sources', () => {
  const paths = ['backend/.env.example', 'frontend/.env.example', 'backend/.env.local.example',
    'backend/composer.json', 'backend/app/Models/User.php',
    'frontend/src/app/features/datasets/dataset-view/dataset-view.component.ts', 'docs/SISTEMA.md'];
  assert.equal(git(['check-ignore', '--no-index', '--stdin', '-z'], paths.join('\0') + '\0').output, '');
});

test('the production Docker context excludes private data and the local dump', async () => {
  const patterns = (await readFile(resolve(root, 'backend/.dockerignore'), 'utf8')).split(/\r?\n/);
  for (const pattern of ['.env', '.env.*', '**/.env', '**/.env.*', 'auth.json',
    '**/auth.json', '**/*.pem', '**/*.key', '**/*.p12', '**/*.pfx', '**/*.log', '**/*.bak', '.phpstorm.meta.php',
    '_ide_helper_models.php', '/storage/app/private', '/storage/app/public/*',
    '/storage/*.key', '/storage/codex-logs/', '/.docker-codex/', '/tmp/', '/output/',
    '/toArray())', 'Dockerfile*']) {
    assert(patterns.includes(pattern), `Missing Docker exclusion: ${pattern}`);
  }
});

for (const path of reviewedDocuments) {
  test(`${path}: reviewed credential examples do not return`, async () => {
    assert.deepEqual(credentialLines(await readFile(resolve(root, path), 'utf8')), [],
      `${path}: credential candidate detected; source values suppressed`);
  });
}

test('the environment template contains no literal credentials', async () => {
  const example = await readFile(resolve(root, 'backend/.env.example'), 'utf8');
  const values = new Map(example.split(/\r?\n/).map(line => line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/))
    .filter(Boolean).map(match => [match[1], match[2].trim()]));
  const keys = ['APP_KEY', 'DATABASE_URL', 'DB_PASSWORD', 'MONGODB_URI',
    'REDIS_PASSWORD', 'MAIL_PASSWORD', 'GOOGLE_CLIENT_SECRET', 'AWS_ACCESS_KEY_ID',
    'AWS_SECRET_ACCESS_KEY', 'ADMIN_PASSWORD', 'INITIAL_USER_PASSWORD',
    'SUBSCRIBER_PASSWORD', 'MICROSOFT_CLIENT_SECRET'];
  for (const key of keys) {
    assert(values.has(key), `Missing example key: ${key}`);
    if (!['', 'null'].includes(values.get(key))) {
      assert.fail(`${key}: example value must stay empty or null; value suppressed`);
    }
  }
});

test('the documentation detector distinguishes empty values from the next line', () => {
  assert.deepEqual(credentialLines('DB_PASSWORD=\nDB_HOST=localhost'), []);
  assert.deepEqual(credentialLines('MONGO_INITDB_ROOT_PASSWORD: ${MONGODB_ROOT_PASSWORD:?required}'), []);
  assert.deepEqual(credentialLines("DATABASE_URL: ''\nMONGODB_URI: \"\"\nAPP_KEY=null"), []);
  assert.equal(credentialLines("DB_PASSWORD='synthetic-fixture-only'").length, 1);
  assert.equal(credentialLines('MAIL_PASSWORD=synthetic-fixture-only').length, 1);
});

test('the PostgreSQL guide distinguishes a prompt from password authentication', async () => {
  const source = await readFile(resolve(root, 'docs/comandos.md'), 'utf8');
  const start = source.indexOf('## Configuración de Base de Datos');
  assert(start >= 0, 'The database connection guidance is required.');
  const section = source.slice(start).split(/\r?\n---/)[0];
  const command = section.split(/\r?\n/)
    .find(line => /^docker exec -it observatorio_db psql\b/.test(line));
  assert(typeof command === 'string', 'The documented Docker psql command is required.');
  const args = command.trim().split(/\s+/);
  const hostIndex = args.indexOf('-h');
  // The root Compose service resolves this name to a non-loopback address.
  // Do not log the command/section on failure: future edits may contain secrets.
  assert(hostIndex >= 0 && args[hostIndex + 1] === 'observatorio_db',
    'Use the Compose container hostname, not its local socket or loopback.');
  assert(args.includes('-W'), 'Keep an interactive password prompt; never inline a password.');
  assert(!/PGPASSWORD\s*=|--password\s*=/.test(command),
    'Do not put a password assignment in the connection example.');
  assert(/-W[^\r\n]*solo[^\r\n]*solicita[^\r\n]*no verifica/i.test(section),
    'Explain that the prompt alone does not verify the password.');
  assert(section.includes('pg_hba.conf') && section.includes('scram-sha-256')
    && section.includes('trust'), 'Explain the effective HBA rule and its trust limitation.');
});

test('the documentation detector flags synthetic literals without returning their values', () => {
  const synthetic = 'synthetic-fixture-only';
  const findings = credentialLines(`DB_PASSWORD=${synthetic}\npostgresql://test:${synthetic}@localhost/test`);
  assert.equal(findings.length, 2);
  assert(findings.every(item => Object.keys(item).sort().join(',') === 'line,rule'));
  assert(!JSON.stringify(findings).includes(synthetic));
  const weakFixture = 'secret987';
  const weakFindings = credentialLines(`| synthetic-account | ${weakFixture} |`);
  assert.deepEqual(weakFindings, [{ line: 1, rule: 'retired-example-password' }]);
  assert(!JSON.stringify(weakFindings).includes(weakFixture));
});

test('secret filename rules do not confuse example templates with runtime files', () => {
  assert(isSecretFile('backend/.env'));
  assert(isSecretFile('backend/.env.production'));
  assert(isSecretFile('backend/auth.json'));
  assert(!isSecretFile('backend/.env.example'));
  assert(!isSecretFile('backend/.env.local.example'));
});
