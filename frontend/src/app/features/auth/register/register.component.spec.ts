import { Component, Input, Pipe } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormGroup } from '@angular/forms';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { Router, provideRouter } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subject, of, throwError } from 'rxjs';
import { AuthService } from '@core/services/auth.service';
import { CommunityProfileFieldsComponent } from '../../../shared/components/community-profile-fields/community-profile-fields.component';
import { RegisterComponent } from './register.component';

@Pipe({ name: 'translate', standalone: true })
class MockTranslatePipe { transform(value: string) { return value; } }
@Component({ selector: 'app-community-profile-fields', standalone: true, template: '' })
class MockCommunityFields { @Input() form!: FormGroup; }

describe('RegisterComponent two-step registration', () => {
  let component: RegisterComponent;
  let fixture: ComponentFixture<RegisterComponent>;
  let auth: { register: ReturnType<typeof vi.fn> };
  let router: Router;
  const account = { given_name: ' Persona ', family_name: ' Ejemplo ', email: 'PERSONA@example.test', password: 'test-password-alameda', password_confirmation: 'test-password-alameda' };
  const pending = { email: 'persona@example.test', email_sent: true, resend_after: 60, verification_required: true };
  beforeEach(async () => {
    auth = { register: vi.fn().mockReturnValue(of(pending)) };
    TestBed.overrideComponent(RegisterComponent, { remove: { imports: [TranslateModule, CommunityProfileFieldsComponent] }, add: { imports: [MockTranslatePipe, MockCommunityFields] } });
    await TestBed.configureTestingModule({ imports: [RegisterComponent], providers: [provideRouter([]), provideNoopAnimations(),
      { provide: AuthService, useValue: auth }, { provide: TranslateService, useValue: { instant: (key: string) => key } }] }).compileComponents();
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    fixture = TestBed.createComponent(RegisterComponent);
    component = fixture.componentInstance; fixture.detectChanges();
  });
  it('hides the Google option and its separator on the account step', () => {
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('.google-button, .auth-divider')).toBeNull();
    expect(element.querySelector('.registration-primary')).not.toBeNull();
  });
  it('validates the account before advancing and does not create it on the first step', () => {
    component.nextStep(); expect(component.step()).toBe(1);
    component.form.setValue(account); component.onSubmit();
    expect(component.step()).toBe(2); expect(auth.register).not.toHaveBeenCalled();
    component.previousStep(); expect(component.form.value.given_name).toBe(account.given_name);
  });
  it('rejects mismatched passwords and whitespace-only names', () => {
    component.form.setValue({ ...account, given_name: ' ', password_confirmation: 'different' });
    component.nextStep(); expect(component.step()).toBe(1); expect(component.error()).toBe('common.validation.passwordMismatch');
  });
  it('blocks weak, common and oversized passwords before creating an account', () => {
    for (const password of ['short', 'passwordpassword', 'é'.repeat(40)]) {
      component.form.setValue({ ...account, password, password_confirmation: password });
      component.nextStep(); expect(component.step()).toBe(1);
      expect(component.form.controls.password.invalid).toBe(true);
      expect(auth.register).not.toHaveBeenCalled();
    }
  });
  it('sends selected public interest and institutional profile', () => {
    component.form.setValue(account); component.nextStep();
    component.profileForm.setValue({ vinculo: 'DOCENTE', institucion_tipo: 'OTRA', institucion: ' Universidad ', interes_departamento_id: 'observatory-id' });
    component.onSubmit();
    expect(auth.register).toHaveBeenCalledWith({ name: 'Persona Ejemplo', email: 'persona@example.test', password: account.password, password_confirmation: account.password,
      vinculo: 'DOCENTE', institucion_tipo: 'OTRA', institucion: 'Universidad', interes_departamento_id: 'observatory-id' });
    expect(router.navigate).toHaveBeenCalledWith(['/auth/verificar-correo'], { state: { email: pending.email, emailSent: true, resendAfter: 60 } });
  });
  it('requires another institution name unless the entire profile is skipped', () => {
    component.form.setValue(account); component.nextStep();
    component.profileForm.patchValue({ vinculo: 'DOCENTE', institucion_tipo: 'OTRA', institucion: '' });
    component.onSubmit(); expect(auth.register).not.toHaveBeenCalled();
    component.onSubmit(true);
    expect(auth.register).toHaveBeenCalledExactlyOnceWith({ name: 'Persona Ejemplo', email: 'persona@example.test', password: account.password, password_confirmation: account.password });
  });
  it('sends newly created accounts to login when verification is paused', () => {
    auth.register.mockReturnValue(of({ email: pending.email, verification_required: false }));
    component.form.setValue(account);
    component.nextStep();
    component.onSubmit(true);

    expect(router.navigate).toHaveBeenCalledExactlyOnceWith(['/auth/login'], {
      state: { registered: true, email: pending.email },
    });
    expect(component.form.controls.password.value).toBe('');
  });
  it('blocks duplicate submissions and sends account errors back to the first step', () => {
    const request = new Subject<any>(); auth.register.mockReturnValue(request);
    component.form.setValue(account); component.nextStep(); component.onSubmit(true); component.onSubmit(true);
    expect(auth.register).toHaveBeenCalledTimes(1);
    request.error({ error: { errors: { email: ['Ya registrado'] } } });
    expect(component.step()).toBe(1); expect(component.error()).toBe('Ya registrado'); expect(component.loading()).toBe(false);
  });
  it('keeps a usable failure state when registration fails', () => {
    auth.register.mockReturnValue(throwError(() => ({})));
    component.form.setValue(account); component.nextStep(); component.onSubmit(true);
    expect(component.error()).toBe('auth.register.errors.registrationFailed'); expect(component.loading()).toBe(false);
  });
});
