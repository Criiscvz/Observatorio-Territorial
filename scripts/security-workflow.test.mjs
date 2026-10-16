import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../.github/workflows/security.yml', import.meta.url), 'utf8');
const config = await readFile(new URL('../.gitleaks.toml', import.meta.url), 'utf8');
const installer = await readFile(new URL('./install-gitleaks.mjs', import.meta.url), 'utf8');
const scanner = await readFile(new URL('./scan-secrets.mjs', import.meta.url), 'utf8');
const backendLock = JSON.parse(await readFile(new URL('../backend/composer.lock', import.meta.url), 'utf8'));
const backendDocker = await readFile(new URL('../backend/Dockerfile', import.meta.url), 'utf8');
const backendDevDocker = await readFile(new URL('../backend/Dockerfile.dev', import.meta.url), 'utf8');

test('CI uses normal pull requests and selected branch pushes, not privileged PR events', () => {
  assert.match(source, /^on:\n  pull_request:\n  push:\n    branches: \[main, deploy-gratis\]/m);
  assert(!/pull_request_target|workflow_run|paths-ignore|continue-on-error/.test(source));
  assert.match(source, /cancel-in-progress: true/);
});

test('CI grants only repository read access and does not consume deployment secrets', () => {
  assert.match(source, /^permissions:\n  contents: read\n/m);
  assert(!/\bwrite\b|id-token:|\$\{\{\s*secrets\.|environment:|self-hosted/.test(source.replace(/^#.*$/gm, '')));
  assert(!/\$\{\{[^}]+(?:head\.ref|title|body|client_payload)/.test(source));
  assert(!/vercel deploy|render deploy|db:seed|migrate|--ignore-platform-reqs/.test(source));
});

test('all external actions and the disposable database image are immutable references', () => {
  const uses = [...source.matchAll(/^\s*- uses: ([^\s#]+)/gm)].map(match => match[1]);
  assert.equal(uses.length, 8);
  assert(uses.every(value => /^[\w.-]+\/[\w.-]+@[a-f0-9]{40}$/.test(value)));
  assert.match(source, /image: postgres@sha256:[a-f0-9]{64}/);
  assert.equal((source.match(/persist-credentials: false/g) ?? []).length, 4);
  assert(!/^\s+cache:|restore-keys:|upload-artifact|uses: actions\/cache@/m.test(source));
});

test('every independent job is required by a stable fail-closed result check', () => {
  for (const job of ['secrets', 'hygiene', 'backend', 'frontend', 'result']) {
    assert.match(source, new RegExp(`^  ${job}:$`, 'm'));
  }
  assert.match(source, /name: Resultado\n    if: always\(\)\n    needs: \[secrets, hygiene, backend, frontend\]/);
  assert.match(source, /job\.result !== "success"/);
  assert.equal((source.match(/timeout-minutes:/g) ?? []).length, 5);
});

test('the hygiene and scanner regression suites actually run in CI', () => {
  for (const command of ['node scripts/install-gitleaks.mjs',
    'node --test scripts/secret-scan.test.mjs', 'node scripts/scan-secrets.mjs',
    'node --test scripts/test-repository-hygiene.mjs scripts/security-workflow.test.mjs',
    'node scripts/test-docker-context-hygiene.mjs']) assert(source.includes(command));
});

test('backend uses forced testing settings and only a local disposable PostgreSQL database', () => {
  for (const value of ['APP_ENV: testing', "DATABASE_URL: ''", "DB_URL: ''", "MONGODB_URI: ''",
    "DB_DATABASE: ':memory:'", 'TEST_DB_HOST: 127.0.0.1',
    'TEST_DB_DATABASE: observatorio_ci_test', "TEST_DB_PORT: ${{ job.services.postgres.ports['5432'] }}",
    'composer install --no-interaction --prefer-dist --no-progress --no-scripts --no-plugins',
    'run: composer check-platform-reqs',
    'run: php vendor/bin/phpunit --no-progress',
    'RegistroDatoPostgresTest|EloquentRegistroDatoRepositoryTest|TestDatabaseIsolationTest']) {
    assert(source.includes(value), 'Required backend isolation or suite command is missing.');
  }
  assert(!/cp .*\.env|copy .*\.env|DATABASE_URL: \$\{\{/.test(source));
});

test('frontend uses the lockfile, non-watch tests, header regressions and production build', () => {
  for (const command of ['npm ci --no-audit --no-fund', 'npm test -- --watch=false',
    'npm run test:security-headers', 'npm run build:vercel', 'API_URL: /api',
    "SECURITY_CHECK_BUILD: '1'"]) assert(source.includes(command));
  assert(source.indexOf('run: npm run build:vercel') < source.indexOf('run: npm run test:security-headers'));
  assert(!/npm update|npm install/.test(source));
});

test('scanner retains default rules, redaction and no broad fixture or history suppression', () => {
  assert.match(config, /useDefault = true/);
  assert.match(config, /targetRules = \["grafana-api-key"\]/);
  assert.match(config, /condition = "AND"/);
  assert(!/disabledRules|stopwords|commits\s*=/.test(config));
  assert(!/baseline-path/.test(scanner));
  assert.match(source, /fetch-depth: 0/);
  for (const value of ['SCAN_EVENT:', 'SCAN_BASE:', 'SCAN_HEAD:']) assert(source.includes(value));
  assert(scanner.includes('--no-ext-diff'));
  for (const flag of ['--redact=100', '--ignore-gitleaks-allow', '--gitleaks-ignore-path']) {
    assert(scanner.includes(flag));
  }
  assert(installer.includes("const version = '8.30.1'"));
  assert.equal((installer.match(/sha256: '[a-f0-9]{64}'/g) ?? []).length, 2);
  assert(installer.includes('Gitleaks checksum mismatch; refusing to extract or execute.'));
});

test('the locked MongoDB library has a compatible, identical PHP driver in Docker and CI', () => {
  const library = backendLock.packages.find(pkg => pkg.name === 'mongodb/mongodb');
  const required = /^\^(\d+)\.(\d+)$/.exec(library.require['ext-mongodb']);
  assert(required, 'Review the MongoDB extension constraint before changing its format.');
  const driver = /pecl install mongodb-(\d+)\.(\d+)\.(\d+)\b/.exec(backendDocker);
  assert(driver, 'Production must install a specific, tested MongoDB driver version.');
  assert.equal(Number(driver[1]), Number(required[1]));
  assert(Number(driver[2]) >= Number(required[2]), 'The locked library needs a newer MongoDB driver.');
  const pinnedVersion = driver.slice(1).join('.');
  assert(backendDevDocker.includes(`pecl install mongodb-${pinnedVersion}`));
  assert(source.includes(`mongodb-${pinnedVersion}`));
});
