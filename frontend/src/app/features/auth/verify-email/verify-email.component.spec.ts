import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter, Router } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { AuthService } from '@core/services/auth.service';
import { VerifyEmailComponent } from './verify-email.component';

describe('VerifyEmailComponent', () => {
  const email = 'pendiente@example.test';
  const paused = new HttpErrorResponse({status: 409, error: {code: 'EMAIL_VERIFICATION_PAUSED'}});

  function setup(options: { pendingEmail?: string; navigationState?: object; observatoryAdmin?: boolean } = {}) {
    history.replaceState(options.navigationState ?? {}, '');
    const auth = {
      getPendingVerificationEmail: vi.fn(() => options.pendingEmail ?? email),
      setPendingVerificationEmail: vi.fn(),
      clearPendingVerificationEmail: vi.fn(),
      verifyEmail: vi.fn(),
      resendVerificationCode: vi.fn(),
      isAdmin: vi.fn(() => false),
      isEditor: vi.fn(() => false),
      isObservatoryAdmin: vi.fn(() => options.observatoryAdmin ?? false),
    };
    TestBed.configureTestingModule({
      imports: [VerifyEmailComponent],
      providers: [provideRouter([]), provideNoopAnimations(), {provide: AuthService, useValue: auth}],
    });
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(VerifyEmailComponent);
    fixture.detectChanges();
    return {auth, navigate, fixture, component: fixture.componentInstance};
  }

  let initialState: unknown;
  beforeEach(() => { initialState = history.state; });
  afterEach(() => { history.replaceState(initialState, ''); });

  it('returns to sign-in when no verification email is pending', () => {
    const {auth, navigate} = setup({pendingEmail: ''});

    expect(navigate).toHaveBeenCalledExactlyOnceWith(['/auth/login']);
    expect(auth.verifyEmail).not.toHaveBeenCalled();
    expect(auth.resendVerificationCode).not.toHaveBeenCalled();
  });

  it('keeps the form available after a rejected code and accepts a new code', () => {
    const {auth, component, fixture, navigate} = setup();
    const firstResponse = new Subject<void>();
    auth.verifyEmail.mockReturnValueOnce(firstResponse).mockReturnValueOnce(of(undefined));
    const form = fixture.nativeElement.querySelector('form') as HTMLFormElement;
    const code = form.querySelector('input') as HTMLInputElement;
    const submit = form.querySelector('button') as HTMLButtonElement;
    const enterCode = (value: string) => {
      code.value = value;
      code.dispatchEvent(new Event('input', {bubbles: true}));
      fixture.detectChanges();
    };

    enterCode('12345');
    expect(submit.disabled).toBe(true);
    expect(auth.verifyEmail).not.toHaveBeenCalled();

    enterCode('123456');
    submit.click();
    fixture.detectChanges();
    expect(submit.disabled).toBe(true);
    expect(auth.verifyEmail).toHaveBeenCalledExactlyOnceWith(email, '123456');
    firstResponse.error(new HttpErrorResponse({status: 422, error: {errors: {code: ['El código expiró.']}}}));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.alert-error').textContent).toContain('El código expiró.');
    expect(submit.disabled).toBe(false);
    expect(navigate).not.toHaveBeenCalled();

    enterCode('987654');
    submit.click();
    expect(auth.verifyEmail).toHaveBeenLastCalledWith(email, '987654');
    expect(component.error()).toBeNull();
    expect(navigate).toHaveBeenCalledExactlyOnceWith(['/publico/departamentos']);
  });

  it('honors the resend cooldown and retries after an unsuccessful delivery', () => {
    vi.useFakeTimers();
    const {auth, component, fixture} = setup({navigationState: {email, emailSent: false, resendAfter: 2}});
    try {
      auth.resendVerificationCode
        .mockReturnValueOnce(throwError(() => new HttpErrorResponse({status: 503})))
        .mockReturnValueOnce(of({message: 'Código enviado.', resend_after: 60}));
      const resend = fixture.nativeElement.querySelector('.resend') as HTMLButtonElement;
      expect(auth.setPendingVerificationEmail).toHaveBeenCalledExactlyOnceWith(email);
      expect(fixture.nativeElement.textContent).toContain('No pudimos enviar el código');
      expect(resend.disabled).toBe(true);
      expect(auth.resendVerificationCode).not.toHaveBeenCalled();

      vi.advanceTimersByTime(2_000);
      fixture.detectChanges();
      expect(resend.disabled).toBe(false);
      resend.click();
      fixture.detectChanges();
      expect(component.error()).toBe('No fue posible reenviar el código.');
      expect(resend.disabled).toBe(false);

      resend.click();
      fixture.detectChanges();
      expect(auth.resendVerificationCode).toHaveBeenCalledTimes(2);
      expect(component.success()).toBe('Código enviado.');
      expect(component.emailSent()).toBe(true);
      expect(component.resendSeconds()).toBe(60);
      expect(resend.disabled).toBe(true);
    } finally {
      fixture.destroy();
      vi.useRealTimers();
    }
  });

  it.each(['verify', 'resend'] as const)('returns to sign-in when %s finds that verification is paused', action => {
    const {auth, component, navigate} = setup();
    auth.verifyEmail.mockReturnValue(throwError(() => paused));
    auth.resendVerificationCode.mockReturnValue(throwError(() => paused));
    component.form.controls.code.setValue('123456');

    component[action]();

    expect(auth.clearPendingVerificationEmail).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledExactlyOnceWith(['/auth/login'], {replaceUrl: true});
    expect(component.loading()).toBe(false);
    expect(component.error()).toBeNull();
  });

  it('routes a verified supervisor to the administration panel', () => {
    const {auth, component, navigate} = setup({observatoryAdmin: true});
    auth.verifyEmail.mockReturnValue(of(undefined));
    component.form.controls.code.setValue('012345');

    component.verify();

    expect(auth.verifyEmail).toHaveBeenCalledExactlyOnceWith(email, '012345');
    expect(navigate).toHaveBeenCalledExactlyOnceWith(['/admin/dashboard']);
  });
});
