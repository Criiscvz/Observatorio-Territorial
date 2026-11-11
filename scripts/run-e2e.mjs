import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { checkHealth } from './check-operational-health.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = resolve(root, 'storage/codex-local/e2e');
const project = 'observatorio-e2e-fase5';
const purpose = 'e2e-fase5';
const origin = 'http://localhost:4500';
let operation = 0;
function run(command, args, { input, timeout = 600000, allowFailure = false, cwd = root } = {}) {
  const result = spawnSync(command, args, { cwd, input, encoding: 'utf8', timeout,
    maxBuffer: 16 * 1024 * 1024, windowsHide: true });
  writeFileSync(resolve(output, `operation-${++operation}.log`), String(result.stdout || '') + '\n' + String(result.stderr || ''), { mode: 0o600 });
  if (!allowFailure && (result.error || result.status !== 0)) throw new Error(`E2E operation ${operation} failed. Private diagnostics: storage/codex-local/e2e/operation-${operation}.log`);
  return result;
}
const docker = (args, options) => run('docker', ['--context', 'default', ...args], options);
const prefix = ['compose', '--project-name', project, '--env-file', resolve(output, '.env'),
  '-f', 'deploy/portable/compose.yml', '-f', 'deploy/e2e/compose.yml'];
const compose = (args, options) => docker([...prefix, ...args], options);

function assertOwnership() {
  const ids = docker(['ps', '-aq', '--filter', 'label=com.docker.compose.project=' + project]).stdout.trim().split('\n').filter(Boolean);
  for (const id of ids) {
    const item = JSON.parse(docker(['inspect', id]).stdout)[0];
    assert.equal(item.Config.Labels['observatorio.purpose'], purpose);
  }
  for (const entry of ['pg-data', 'mongo-data', 'app-storage']) {
    const result = docker(['volume', 'inspect', project + '_' + entry], { allowFailure: true });
    if (result.status === 0) {
      const item = JSON.parse(result.stdout)[0];
      assert.equal(item.Labels['observatorio.purpose'], purpose);
      assert.equal(item.Labels['com.docker.compose.project'], project);
    }
  }
}

async function main() {
  mkdirSync(output, { recursive: true });
  const ignored = run('git', ['check-ignore', 'storage/codex-local/e2e/.env']);
  assert.equal(ignored.status, 0);
  assert(/^(npipe:\/\/|unix:\/\/)/.test(docker(['context', 'inspect', 'default', '--format', '{{.Endpoints.docker.Host}}']).stdout.trim()), 'Local Docker engine required.');
  // A previous unfinished run must be reviewed explicitly, never silently reset.
  const volumes = new Set(docker(['volume', 'ls', '--format', '{{.Name}}']).stdout.trim().split('\n'));
  for (const name of ['pg-data', 'mongo-data', 'app-storage']) assert(!volumes.has(project + '_' + name), 'Previous E2E volumes exist; inspect and clean only that labelled project before rerunning.');
  assert.equal(docker(['ps', '-aq', '--filter', 'label=com.docker.compose.project=' + project]).stdout.trim(), '', 'Previous E2E containers exist; inspect them before rerunning.');
  const env = { PORTABLE_APP_KEY: 'base64:' + randomBytes(32).toString('base64'),
    PORTABLE_DB_OWNER_PASSWORD: randomBytes(32).toString('hex'), PORTABLE_DB_APP_PASSWORD: randomBytes(32).toString('hex'),
    PORTABLE_MONGO_ROOT_PASSWORD: randomBytes(32).toString('hex'), PORTABLE_MONGO_APP_PASSWORD: randomBytes(32).toString('hex'), PORTABLE_HTTP_PORT: '4500' };
  writeFileSync(resolve(output, '.env'), Object.entries(env).map(([key, value]) => key + '=' + value).join('\n') + '\n', { mode: 0o600 });
  const config = JSON.parse(compose(['--profile', 'tools', 'config', '--format', 'json']).stdout);
  assert.equal(config.services.api.environment.DB_HOST, 'postgres');
  assert.equal(config.services.api.environment.DB_DATABASE, 'observatorio_portable_test');
  assert.equal(config.services.api.environment.APP_URL, origin);
  assert.equal(config.services.api.environment.APP_ENV, 'production');
  assert.equal(config.services.api.environment.OBSERVATORIO_E2E, '1');
  assert.equal(config.networks.portable.internal, true);
  assert(config.services.web.ports.every(p => p.host_ip === '127.0.0.1' && Number(p.published) === 4500));
  for (const name of ['api', 'schema', 'postgres', 'mongo']) assert(!config.services[name].ports?.length);
  console.log('E2E: building the current API and SPA in isolated images.');
  docker(['build', '--builder', 'default', '-f', 'backend/Dockerfile.portable', '-t', 'observatorio-e2e-base:phase5', 'backend']);
  docker(['build', '--builder', 'default', '-f', 'backend/Dockerfile.e2e', '-t', 'observatorio-e2e-api:phase5', 'backend']);
  docker(['build', '--builder', 'default', '-f', 'frontend/Dockerfile.portable', '-t', 'observatorio-e2e-web:phase5', 'frontend']);
  // Test image must refuse use without the isolated environment, before any DB access.
  const refused = docker(['run', '--rm', '--network', 'none', '--entrypoint', 'php', 'observatorio-e2e-api:phase5', '-r',
    'require "vendor/autoload.php"; $app=require "bootstrap/app.php"; $app->make(Illuminate\\Contracts\\Console\\Kernel::class)->bootstrap();'], { allowFailure: true });
  assert.notEqual(refused.status, 0); assert((refused.stdout + refused.stderr).includes('Isolated E2E environment required.'));
  let started = false;
  try {
    started = true;
    compose(['up', '-d', '--no-build', '--wait', 'postgres', 'mongo']);
    assertOwnership();
    compose(['run', '--rm', '--no-deps', 'schema']);
    compose(['up', '-d', '--no-build', '--wait', 'api', 'web']);
    const fixture = { run: randomUUID(), password: randomBytes(24).toString('base64url') };
    const source = readFileSync(resolve(root, 'scripts/e2e/seed.php'), 'utf8')
      .replace('__E2E_INPUT_BASE64__', Buffer.from(JSON.stringify(fixture)).toString('base64'));
    const seedOutput = compose(['exec', '-T', 'api', 'php'], { input: source }).stdout;
    let seeded;
    try { seeded = JSON.parse(seedOutput); }
    catch { throw new Error('E2E fixture failed; inspect the private operation log.'); }
    writeFileSync(resolve(output, 'document.pdf'), Buffer.from(seeded.pdf, 'base64'), { mode: 0o600 });
    delete seeded.pdf;
    writeFileSync(resolve(output, 'fixture.json'), JSON.stringify({ ...fixture, ...seeded }, null, 2), { mode: 0o600 });
    const mongoVerification = JSON.parse(compose(['exec', '-T', 'api', 'php'], {
      input: readFileSync(resolve(root, 'scripts/e2e/verify-mongo.php'), 'utf8'),
    }).stdout);
    assert.equal(mongoVerification.ok, true);
    assert.equal(mongoVerification.checks, 8);
    writeFileSync(resolve(output, 'mongodb-results.json'), JSON.stringify(mongoVerification, null, 2));
    console.log('E2E: MongoDB persistence, pagination, BSON dates and scoped deletion verified.');
    const health = await (await fetch(origin + '/api/health?deep=1')).json();
    assert.equal(health.ok, true); assert.deepEqual(health.services, { postgres: 'ok', mongodb: 'ok' });
    const operational = await checkHealth(origin);
    assert(operational.ok && operational.checks.every(check=>check.correlation_available), 'Operational health/correlation failed.');
    // Prove production CSRF remains enabled even in the test-only image.
    const denied = await fetch(origin + '/api/login', { method: 'POST', headers: { Origin: origin, Referer: origin + '/',
      'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ email: 'admin@example.test', password: fixture.password }) });
    assert.equal(denied.status, 419);
    console.log('E2E: running desktop and mobile browser journeys against the real local API.');
    const npm = process.env.npm_execpath;
    assert(npm?.endsWith('npm-cli.js'), 'Run npm run test:e2e from frontend.');
    rmSync(resolve(output, 'playwright-results.json'), {force:true});
    const result = run(process.execPath, [resolve(root, 'frontend/node_modules/@playwright/test/cli.js'), 'test'],
      { cwd: resolve(root, 'frontend'), timeout: 900000, allowFailure: true });
    if (existsSync(resolve(output, 'playwright-results.json'))) {
      const report = JSON.parse(readFileSync(resolve(output, 'playwright-results.json'), 'utf8'));
      console.log(JSON.stringify({ e2e: report.stats, projects: ['escritorio', 'movil'], syntheticOnly: true }));
    }
    assert(!result.error && result.status === 0, 'Browser journeys failed; private report: storage/codex-local/e2e/playwright-results.json');
    const observed = compose(['logs', '--no-color', '--no-log-prefix', 'api']);
    const log = observed.stdout + observed.stderr;
    for (const sensitive of [fixture.password, fixture.health, 'admin@example.test', 'Importacion E2E.pdf'])
      assert(!log.includes(sensitive), 'Sensitive synthetic value reached runtime logs; diagnostics remain private.');
    const records = log.split('\n').flatMap(line => { try { return [JSON.parse(line)]; } catch { return []; } });
    const spans = records.filter(r => r.message === 'OTEL_SPAN').map(r => r.context);
    for (const system of ['postgresql','mongodb']) assert(spans.some(s => s.db_system === system), 'Missing database trace: ' + system);
    for (const target of ['microsoft_graph','microsoft_identity']) assert(spans.some(s => s.target === target), 'Missing SharePoint trace: ' + target);
    assert(records.some(r => r.message === 'HTTP_REQUEST_COMPLETED' && r.context.status === 419));
    const summary = {structuredRecords:records.length, databaseSystems:['postgresql','mongodb'],
      externalTargets:['microsoft_graph','microsoft_identity'], sensitiveFixturesFound:0};
    for (const service of Object.values(config.services)) assert.deepEqual(service.logging,
      {driver:'json-file',options:{'max-size':'10m','max-file':'3'}});
    writeFileSync(resolve(output, 'observability-results.json'), JSON.stringify(summary,null,2));
    console.log('E2E: structured telemetry and redaction verified for real SQL/MongoDB and simulated Graph.');
  } catch (error) {
    compose(['logs', '--no-color', '--tail', '200'], {allowFailure:true});
    throw error;
  } finally {
    if (started) { assertOwnership(); compose(['down', '--volumes', '--remove-orphans']); }
  }
  console.log('E2E: disposable services and volumes removed; private evidence retained locally.');
}

try { await main(); }
catch (error) { console.error(error.message); process.exitCode = 1; }
