import { FormControl, Validators } from '@angular/forms';
import { PASSWORD_POLICY } from './password-policy.data';
import { PASSWORD_CASES } from './password-policy.fixture';
import { loginPasswordValidator, passwordErrorKey, passwordValidator } from './password.validator';

describe('shared password policy', () => {
  for (const item of PASSWORD_CASES) {
    it('matches the API contract: ' + item.name, () => {
      const created = new FormControl(item.value, [Validators.required, passwordValidator]);
      const login = new FormControl(item.value, [Validators.required, loginPasswordValidator]);
      expect(created.valid).toBe(item.validNew);
      expect(login.valid).toBe(item.validLogin);
    });
  }
  it('rejects every local blocklist entry and does not modify input values', () => {
    for (const value of PASSWORD_POLICY.blockedPasswords) {
      const control = new FormControl(value, passwordValidator);
      expect(control.invalid).toBe(true); expect(control.value).toBe(value);
    }
    const phrase = '   alameda mar sol   ';
    const control = new FormControl(phrase, passwordValidator);
    expect(control.valid).toBe(true); expect(control.value).toBe(phrase);
  });
  it('permits an empty optional edit and rejects malformed scalar input', () => {
    expect(new FormControl('', passwordValidator).valid).toBe(true);
    for (const value of ['\ud800', '\udfff', ['array'], 123]) {
      expect(new FormControl(value, passwordValidator).hasError('passwordInvalidInput')).toBe(true);
      expect(new FormControl(value, loginPasswordValidator).hasError('passwordInvalidInput')).toBe(true);
    }
  });
  it('presents the specific error without disclosing the input', () => {
    const common = new FormControl('passwordpassword', passwordValidator);
    expect(passwordErrorKey(common)).toBe('common.validation.passwordCommon');
    expect(passwordErrorKey(new FormControl('short', passwordValidator))).toBe('common.validation.passwordTooShort');
    expect(passwordErrorKey(new FormControl('é'.repeat(40), passwordValidator))).toBe('common.validation.passwordTooLong');
    expect(passwordErrorKey(new FormControl('', Validators.required))).toBe('common.validation.required');
  });
});
