import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { PASSWORD_POLICY } from './password-policy.data';

const commonPasswords = new Set<string>(PASSWORD_POLICY.blockedPasswords);
const paddingCharacters = new Set<string>(PASSWORD_POLICY.paddingCharacters);

function inputErrors(value: unknown, maximumBytes: number): ValidationErrors | null {
  if (typeof value !== 'string') return { passwordInvalidInput: true };
  if (value.includes('\0') || Array.from(value).some(character => {
    const code = character.charCodeAt(0);
    return character.length === 1 && code >= 0xd800 && code <= 0xdfff;
  })) return { passwordInvalidInput: true };
  return new TextEncoder().encode(value).length > maximumBytes ? { passwordTooLong: true } : null;
}

/** Local, synchronous checks. The original value is never normalized or sent elsewhere. */
export const passwordValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const value: unknown = control.value;
  if (value === '' || value === null || value === undefined) return null; // Validators.required owns requiredness.
  const errors = inputErrors(value, PASSWORD_POLICY.maximumBytes);
  if (errors || typeof value !== 'string') return errors;
  const characters = Array.from(value);
  if (characters.length < PASSWORD_POLICY.minimumCharacters) {
    return { minlength: { requiredLength: PASSWORD_POLICY.minimumCharacters, actualLength: characters.length } };
  }
  let start = 0, end = characters.length;
  while (start < end && paddingCharacters.has(characters[start])) start++;
  while (end > start && paddingCharacters.has(characters[end - 1])) end--;
  const candidate = characters.slice(start, end).join('').replace(/[A-Z]/g, letter => letter.toLowerCase());
  return end - start < PASSWORD_POLICY.minimumCharacters || new Set(characters).size === 1 || commonPasswords.has(candidate)
    ? { passwordCommon: true } : null;
};

/** Login checks transport bounds only, preserving credentials accepted before this policy. */
export const loginPasswordValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const value: unknown = control.value;
  if (typeof value === 'string' && value.length > 0 && Array.from(value).every(character => {
    const code = character.charCodeAt(0);
    return code === 0 || code === 32 || (code >= 9 && code <= 13);
  })) return { required: true };
  return value === '' || value === null || value === undefined ? null : inputErrors(value, PASSWORD_POLICY.loginMaximumBytes);
};

export function passwordErrorKey(control: AbstractControl | null): string {
  if (control?.hasError('required')) return 'common.validation.required';
  if (control?.hasError('passwordInvalidInput')) return 'common.validation.passwordInvalidInput';
  if (control?.hasError('passwordTooLong')) return 'common.validation.passwordTooLong';
  if (control?.hasError('minlength')) return 'common.validation.passwordTooShort';
  if (control?.hasError('passwordCommon')) return 'common.validation.passwordCommon';
  return '';
}
