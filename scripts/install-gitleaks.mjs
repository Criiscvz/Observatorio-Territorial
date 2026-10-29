import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { chmod, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

// Release assets and SHA-256 values from the official v8.30.1 checksums file.
// No "latest", shell pipe, credentials or repository configuration is used.
const version = '8.30.1';
const releases = {
  'linux-x64': {
    asset: `gitleaks_${version}_linux_x64.tar.gz`, executable: 'gitleaks',
    sha256: '551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb',
  },
  'win32-x64': {
    asset: `gitleaks_${version}_windows_x64.zip`, executable: 'gitleaks.exe',
    sha256: 'd29144deff3a68aa93ced33dddf84b7fdc26070add4aa0f4513094c8332afc4e',
  },
};

try {
  const release = releases[`${process.platform}-${process.arch}`];
  assert(release, 'Supported installer platforms: Linux x64 and Windows x64.');
  const response = await fetch(`https://github.com/gitleaks/gitleaks/releases/download/v${version}/${release.asset}`,
    { signal: AbortSignal.timeout(60000) });
  assert(response.ok, 'Official Gitleaks download failed.');
  const archive = Buffer.from(await response.arrayBuffer());
  assert.equal(createHash('sha256').update(archive).digest('hex'), release.sha256,
    'Gitleaks checksum mismatch; refusing to extract or execute.');
  const directory = await mkdtemp(join(tmpdir(), 'observatorio-gitleaks-'));
  const archivePath = join(directory, release.asset);
  await writeFile(archivePath, archive, { mode: 0o600 });
  const extraction = spawnSync('tar', ['-xf', archivePath, '-C', directory, release.executable],
    { encoding: 'utf8', timeout: 30000, windowsHide: true });
  assert(!extraction.error && extraction.status === 0, 'Gitleaks extraction failed.');
  const binary = join(directory, release.executable);
  await chmod(binary, 0o700);
  const probe = spawnSync(binary, ['version'], { encoding: 'utf8', timeout: 10000, windowsHide: true });
  assert(!probe.error && probe.status === 0 && probe.stdout.trim() === version,
    'Unexpected Gitleaks version.');
  // The caller sets GITLEAKS_BIN from this path. The runner removes its temp dir.
  console.log(binary);
} catch (error) {
  console.error(error instanceof assert.AssertionError ? error.message : 'Gitleaks installation failed; diagnostics suppressed.');
  process.exitCode = 1;
}
