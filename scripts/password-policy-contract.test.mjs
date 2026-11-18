import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = file => readFile(new URL('../' + file, import.meta.url), 'utf8');

test('the backend and browser ship exactly the same policy and synthetic contract', async () => {
  const canonical = JSON.parse(await read('backend/resources/security/password-policy.json'));
  const browser = await read('frontend/src/app/shared/validators/password-policy.data.ts');
  const prefix = '/*! @license Derived from SecLists, copyright (c) 2018 Daniel Miessler, MIT. Full notice: /assets/licenses/seclists-MIT.txt. */\n// Generated from backend/resources/security/password-policy.json; CI checks equality.\nexport const PASSWORD_POLICY = ';
  assert.equal(browser.replaceAll('\r\n', '\n'), prefix + JSON.stringify(canonical, null, 2) + ' as const;\n');
  assert.equal(canonical.minimumCharacters, 15);
  assert.equal(canonical.maximumBytes, 72);
  assert.equal(canonical.loginMaximumBytes, 4096);
  assert.equal(canonical.blockedPasswords.length, 76);
  assert.equal(new Set(canonical.blockedPasswords).size, 76);
  for (const value of canonical.blockedPasswords) {
    assert(value.length >= 15 && Buffer.byteLength(value) <= 72 && /^[\x20-\x7e]+$/.test(value));
    assert.equal(value, value.toLowerCase());
  }
  assert.equal(canonical.source.commit, '0247dfd46495df842868b2ab6a2cce0c75709215');
  assert.equal(canonical.source.sha256, '1472aafa2561df5e3293aee252aee3ca660c12b399a283cf808bb01b39be388b');
  assert.equal(canonical.source.entries, 99999);
  const cases = JSON.parse(await read('backend/tests/Fixtures/password-policy-cases.json'));
  assert.equal(cases.length, 26);
  assert.equal((await read('frontend/src/app/shared/validators/password-policy.fixture.ts')).replaceAll('\r\n', '\n'),
    '// Synthetic shared contract; imported only by tests.\nexport const PASSWORD_CASES = ' + JSON.stringify(cases, null, 2) + ' as const;\n');
  assert(cases.some(value => value.name === 'legacy' && !value.validNew && value.validLogin));
});

test('both distributions retain the public blocklist license and explain the same minimum', async () => {
  const license = await read('backend/resources/security/SECLISTS-LICENSE.txt');
  assert.equal(await read('frontend/src/assets/licenses/seclists-MIT.txt'), license);
  assert(license.includes('MIT License') && license.includes('Copyright (c) 2018 Daniel Miessler'));
  for (const language of ['es', 'en']) {
    const data = JSON.parse(await read('frontend/src/assets/i18n/' + language + '.json'));
    assert(data.common.validation.passwordHelp.includes('15'));
    assert(data.common.validation.passwordTooShort.includes('15'));
    for (const key of ['passwordTooLong', 'passwordCommon', 'passwordInvalidInput']) assert(data.common.validation[key]);
  }
});
