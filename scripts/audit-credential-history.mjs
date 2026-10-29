import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { credentialLines } from './credential-patterns.mjs';

// Complements entropy/token scanning with low-entropy password examples in docs/config.
// Source is processed only in memory. Neither values nor Git diagnostics are returned.
export function scanCredentialHistory(repository) {
  const result = spawnSync('git', ['log', '--all', '--root', '-p', '--no-ext-diff', '--no-textconv',
    '--format=@@COMMIT:%H', '--', ':(glob)**/*.md', ':(glob)**/.env*', ':(glob)**/*.yml',
    ':(glob)**/*.yaml', ':(glob)**/Dockerfile*', ':(glob)**/database/seeders/*.php'],
  { cwd: repository, encoding: 'utf8', windowsHide: true, timeout: 120000, maxBuffer: 64 * 1024 * 1024 });
  assert(!result.error && result.status === 0, 'Credential inventory failed; raw diagnostics suppressed.');
  const findings = [];
  let commit, file, line;
  for (const source of result.stdout.split(/\r?\n/)) {
    if (/^@@COMMIT:[a-f0-9]{40}$/.test(source)) {
      commit = source.slice(9); file = undefined; line = undefined;
    } else if (source.startsWith('+++ b/')) {
      file = source.slice(6); line = undefined;
    } else if (source.startsWith('@@ ')) {
      const match = source.match(/^@@ -\d+(?:,\d+)? \+(\d+)/);
      line = match ? Number(match[1]) : undefined;
    } else if (commit && file && line !== undefined) {
      if (source.startsWith('+')) {
        for (const finding of credentialLines(source.slice(1))) {
          findings.push({ commit, file, line, rule: finding.rule });
        }
        line++;
      } else if (source.startsWith(' ')) {
        line++;
      }
    }
  }
  return findings;
}
