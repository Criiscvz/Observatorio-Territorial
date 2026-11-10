// Conservative documentation/configuration candidates. Values are never returned.
// A match requires classification; it is not proof of a live credential.
export function credentialLines(text) {
  const findings = [];
  const weakExampleStyle = /\b(?:password|secret|post)\d{1,4}\b/i;
  for (const [index, line] of text.split(/\r?\n/).entries()) {
    if (/\b(?:postgres(?:ql)?|mongodb(?:\+srv)?|mysql|redis):\/\/[^\s:@/]+:[^\s@]+@/i.test(line)) {
      findings.push({ line: index + 1, rule: 'embedded-database-password' });
    }
    if (weakExampleStyle.test(line)) {
      findings.push({ line: index + 1, rule: 'retired-example-password' });
    }
    const assignment = line.match(/^\s*(?:APP_KEY|DATABASE_URL|MONGODB_URI|AWS_ACCESS_KEY_ID|(?:[A-Z][A-Z0-9_]*_)?(?:PASSWORD|SECRET|TOKEN|SECRET_ACCESS_KEY))[ \t]*[:=][ \t]*(.*)$/);
    if (assignment) {
      const value = assignment[1].trim().replace(/^(['"])(.*)\1$/, '$2');
      if (value && value !== 'null' && !value.startsWith('#') && !/^\$\{[A-Z_]+:\?[^}]+\}$/.test(value)) {
        findings.push({ line: index + 1, rule: 'literal-documentation-password' });
      }
    }
  }
  return findings;
}
