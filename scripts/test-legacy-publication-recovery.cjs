// No production endpoints, environment files, image builds or external networking.
// Every database, file and identity is a new synthetic disposable fixture.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'storage/codex-local', 'phase2-recovery-' + crypto.randomBytes(6).toString('hex'));
const phpImage = 'backend-backend-dev:latest';
const dbImage = 'postgres:16-alpine';
const dbName = 'observatorio_phase2_recovery_test';
const restoredDb = 'observatorio_phase2_restore_test';
let databaseId;
function docker(args) {
  const r = spawnSync('docker', args, {encoding: 'utf8', windowsHide: true, timeout: 120000, maxBuffer: 2 * 1024 * 1024});
  assert(!r.error && r.status === 0, 'Disposable recovery operation failed; raw diagnostics suppressed.');
  return r.stdout.trim();
}
function sql(database, statement) {
  assert([dbName, restoredDb].includes(database));
  return docker(['exec', databaseId, 'psql', '-X', '-qAt', '-U', 'recovery_test', '-d', database, '-v', 'ON_ERROR_STOP=1', '-c', statement]);
}
function manifest(database) {
  const tables = ['articulos', 'reportes', 'observatorio_publicaciones', 'phase2_publication_imports',
    'publicacion_contadores', 'users', 'departamentos', 'categorias_dataset', 'migrations'];
  const entries = tables.map(t => `'${t}', (SELECT jsonb_build_object('rows',count(*),'hash',md5(coalesce(string_agg(md5(to_jsonb(r)::text),'' ORDER BY md5(to_jsonb(r)::text)),''))) FROM ${t} r)`);
  return JSON.parse(sql(database, `SELECT jsonb_build_object(${entries.join(',')})::text;`));
}
function fileManifest(directory) {
  const rows = [];
  function walk(current) {
    if (!fs.existsSync(current)) return;
    for (const item of fs.readdirSync(current, {withFileTypes: true})) {
      const name = path.join(current, item.name);
      assert(!item.isSymbolicLink());
      if (item.isDirectory()) walk(name);
      else { const bytes = fs.readFileSync(name); rows.push({path: path.relative(directory, name).replaceAll('\\', '/'), bytes: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex')}); }
    }
  }
  walk(directory); return rows.sort((a, b) => a.path.localeCompare(b.path));
}
function php(database, storage, action) {
  const args = ['run', '--rm', '--pull', 'never', '--network', 'container:' + databaseId,
    '--entrypoint', 'sh', '--workdir', '/app', '--tmpfs', '/app/bootstrap/cache',
    '--mount', `type=bind,source=${storage},target=/app/storage`];
  for (const folder of ['app', 'bootstrap', 'config', 'database', 'resources', 'routes', 'tests']) {
    args.push('--mount', `type=bind,source=${path.join(root, 'backend', folder)},target=/app/${folder},readonly`);
  }
  for (const file of ['artisan', 'composer.json', 'composer.lock']) {
    args.push('--mount', `type=bind,source=${path.join(root, 'backend', file)},target=/app/${file},readonly`);
  }
  for (const value of ['APP_ENV=testing', 'APP_KEY=base64:' + Buffer.alloc(32, 71).toString('base64'),
    'LEGACY_PUBLICATION_REHEARSAL_ENABLED=true', 'LEGACY_RECOVERY_FIXTURES_ENABLED=yes',
    'FILESYSTEM_DISK=phase2-rehearsal', 'CACHE_STORE=array', 'SESSION_DRIVER=array', 'MAIL_MAILER=array',
    'QUEUE_CONNECTION=sync', 'LOG_CHANNEL=stderr', 'BCRYPT_ROUNDS=4', 'MONGODB_URI=',
    'TEST_DB_CONNECTION=pgsql', 'TEST_DB_HOST=127.0.0.1', 'TEST_DB_DATABASE=' + database,
    'TEST_DB_USERNAME=recovery_test', 'TEST_DB_PASSWORD=synthetic-disposable-recovery-only']) args.push('-e', value);
  const result = docker([...args, phpImage, '-c',
    `test ! -f .env && test ! -f .env.testing && mkdir -p bootstrap/cache storage/framework/cache/data storage/framework/sessions storage/framework/views storage/logs && php tests/Fixtures/legacy-publication-recovery.php ${action}`]);
  return JSON.parse(result);
}
try {
  fs.mkdirSync(output, {recursive: true});
  const lock = crypto.createHash('sha256').update(fs.readFileSync(path.join(root, 'backend/composer.lock'))).digest('hex');
  assert.equal(docker(['run', '--rm', '--pull', 'never', '--network', 'none', '--entrypoint', 'sha256sum', phpImage, '/app/composer.lock']).split(/\s+/)[0], lock);
  databaseId = docker(['run', '-d', '--rm', '--pull', 'never', '--network', 'none', '--label', 'observatorio.purpose=phase2-recovery',
    '--tmpfs', '/var/lib/postgresql/data:rw,nosuid,size=256m', '--memory', '512m',
    '-e', 'POSTGRES_USER=recovery_test', '-e', 'POSTGRES_DB=' + dbName,
    '-e', 'POSTGRES_PASSWORD=synthetic-disposable-recovery-only', dbImage]);
  assert(/^[a-f0-9]{64}$/.test(databaseId));
  let ready = false;
  for (let i = 0; i < 35; i++) {
    const r = spawnSync('docker', ['exec', databaseId, 'pg_isready', '-q', '-U', 'recovery_test', '-d', dbName], {windowsHide: true});
    if (r.status === 0) { ready = true; break; }
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500);
  }
  assert(ready);
  const storage = path.join(output, 'storage'); const restoreStorage = path.join(output, 'restored-storage');
  fs.mkdirSync(storage); fs.mkdirSync(restoreStorage);
  assert.equal(php(dbName, storage, 'seed').legacy_records, 4);
  const before = manifest(dbName);
  const sourceFiles = path.join(storage, 'app/private/phase2-rehearsal');
  const filesBefore = fileManifest(sourceFiles);
  docker(['exec', databaseId, 'pg_dump', '-U', 'recovery_test', '-d', dbName, '-Fc', '--no-owner', '--no-privileges', '-f', '/tmp/before.dump']);
  docker(['cp', databaseId + ':/tmp/before.dump', path.join(output, 'before.dump')]);
  docker(['run', '--rm', '--pull', 'never', '--network', 'none', '--entrypoint', 'tar',
    '--mount', `type=bind,source=${sourceFiles},target=/files,readonly`, '--mount', `type=bind,source=${output},target=/backup`,
    dbImage, '-cf', '/backup/before-files.tar', '-C', '/files', '.']);
  const applied = php(dbName, storage, 'apply');
  assert.equal(applied.repeat_unchanged, 4);
  assert.equal(applied.catalog_handoff_verified, true);
  assert.equal(php(dbName, storage, 'rollback').removed, 4);
  assert.deepEqual(manifest(dbName), before, 'Rollback changed the source/target/counter manifests.');
  assert.deepEqual(fileManifest(sourceFiles), filesBefore, 'Rollback changed the original files.');
  // Leave the first DB imported; recovery must use the pre-import backup into a NEW DB.
  assert.equal(php(dbName, storage, 'apply').applied, 4);
  docker(['exec', databaseId, 'createdb', '-U', 'recovery_test', restoredDb]);
  docker(['exec', databaseId, 'pg_restore', '-U', 'recovery_test', '-d', restoredDb, '--exit-on-error', '--no-owner', '--no-privileges', '/tmp/before.dump']);
  assert.deepEqual(manifest(restoredDb), before, 'Restored rows differ from pre-import backup.');
  const restoredFiles = path.join(restoreStorage, 'app/private/phase2-rehearsal'); fs.mkdirSync(restoredFiles, {recursive: true});
  docker(['run', '--rm', '--pull', 'never', '--network', 'none', '--entrypoint', 'tar',
    '--mount', `type=bind,source=${restoredFiles},target=/restore`, '--mount', `type=bind,source=${output},target=/backup,readonly`,
    dbImage, '-xf', '/backup/before-files.tar', '-C', '/restore']);
  assert.deepEqual(fileManifest(restoredFiles), filesBefore);
  const restored = php(restoredDb, restoreStorage, 'verify-restored');
  assert.equal(restored.reapply_after_restore, true);
  assert.equal(restored.catalog_handoff_verified, true);
  assert.deepEqual(manifest(restoredDb), before); assert.deepEqual(fileManifest(restoredFiles), filesBefore);
  const result = {ok: true, syntheticLegacyRecords: 4, syntheticPdfs: 1, repeatWithoutDuplicates: true,
    rollbackRowsAndFilesMatch: true, restoredIntoEmptyDatabase: true, restoredRowsAndFilesMatch: true,
    reapplyAfterRestore: true, catalogHandoffAfterRestore: true, privateAndDeletedPreserved: true, productionRequests: 0, externalNetworking: false,
    checkedAt: new Date().toISOString(), before, filesBefore};
  fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify(result, null, 2));
  fs.writeFileSync(path.join(root, 'storage/codex-local/phase2-recovery-latest.json'), JSON.stringify({ok: true, output, checkedAt: result.checkedAt}, null, 2));
  console.log(JSON.stringify({ok: true, syntheticLegacyRecords: 4, restoredIntoEmptyDatabase: true, rowsAndFilesMatch: true, productionRequests: 0,
    result: path.relative(root, path.join(output, 'results.json')).replaceAll('\\', '/')}));
} finally {
  if (databaseId && /^[a-f0-9]{64}$/.test(databaseId)) docker(['stop', '--time', '5', databaseId]);
}
