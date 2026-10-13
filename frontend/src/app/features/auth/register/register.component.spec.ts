import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Pipe, PipeTransform } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { RegisterComponent } from './register.component';
import { AuthService, RegisterPendingResponse } from '@core/services/auth.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

@Pipe({ name: 'translate', standalone: true })
class MockTranslatePipe implements PipeTransform {
  transform(value: string): string { return value; }
}

describe('RegisterComponent', () => {
  let component: RegisterComponent;
  let fixture: ComponentFixture<RegisterComponent>;
  let authServiceSpy: any;
  let routerSpy: any;
  let translateSpy: any;

  beforeEach(async () => {
    authServiceSpy = {
      register: vi.fn()
    };
    translateSpy = { instant: vi.fn().mockImplementation((k) => k) };

    TestBed.overrideComponent(RegisterComponent, {
      remove: { imports: [TranslateModule] },
      add: { imports: [MockTranslatePipe] }
    });
    TestBed.overrideProvider(AuthService, { useValue: authServiceSpy });
    TestBed.overrideProvider(TranslateService, { useValue: translateSpy });

    await TestBed.configureTestingModule({
      imports: [RegisterComponent, ReactiveFormsModule, NoopAnimationsModule, RouterTestingModule.withRoutes([])],
      providers: [
        FormBuilder
      ]
    }).compileComponents();

    routerSpy = TestBed.inject(Router);
    vi.spyOn(routerSpy, 'navigate').mockImplementation(() => Promise.resolve(true));

    fixture = TestBed.createComponent(RegisterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create with 4 form fields', () => {
    expect(component).toBeTruthy();
    expect(Object.keys(component.form.controls)).toHaveLength(4);
  });

  it('should start with loading=false and error=null', () => {
    expect(component.loading()).toBe(false);
    expect(component.error()).toBeNull();
  });

  describe('onSubmit()', () => {
    it('should not call register if form is invalid', () => {
      component.form.setValue({ name: '', email: '', password: '', password_confirmation: '' });
      component.onSubmit();
      expect(authServiceSpy.register).not.toHaveBeenCalled();
      expect(routerSpy.navigate).not.toHaveBeenCalled();
    });

    it('should set error if passwords do not match', () => {
      component.form.setValue({
        name: 'Test User',
        email: 'test@test.com',
        password: 'password123',
        password_confirmation: 'different'
      });
      component.onSubmit();

      expect(authServiceSpy.register).not.toHaveBeenCalled();
      expect(translateSpy.instant).toHaveBeenCalledWith('common.validation.passwordMismatch');
      expect(routerSpy.navigate).not.toHaveBeenCalled();
    });

    it.each([
      { emailSent: true, resendAfter: 60 },
      { emailSent: false, resendAfter: 0 }
    ])('should navigate to email verification when emailSent=$emailSent', ({ emailSent, resendAfter }) => {
      const formValue = {
        name: 'Test User',
        email: 'test@test.com',
        password: 'password123',
        password_confirmation: 'password123'
      };
      const response: RegisterPendingResponse = {
        message: 'Cuenta creada. Verifica tu correo.',
        verification_required: true,
        email: 'test@test.com',
        email_sent: emailSent,
        resend_after: resendAfter
      };
      component.form.setValue(formValue);
      authServiceSpy.register.mockReturnValue(of(response));

      component.onSubmit();

      expect(authServiceSpy.register).toHaveBeenCalledExactlyOnceWith(formValue);
      expect(routerSpy.navigate).toHaveBeenCalledExactlyOnceWith(['/auth/verificar-correo'], {
        state: {
          email: response.email,
          emailSent: response.email_sent,
          resendAfter: response.resend_after
        }
      });
    });

    it('should set error signal on registration failure', () => {
      component.form.setValue({
        name: 'Test User',
        email: 'test@test.com',
        password: 'password123',
        password_confirmation: 'password123'
      });
      authServiceSpy.register.mockReturnValue(throwError(() => ({ error: { message: 'Email ya registrado' } })));

      component.onSubmit();

      expect(component.error()).toBe('Email ya registrado');
      expect(component.loading()).toBe(false);
      expect(routerSpy.navigate).not.toHaveBeenCalled();
    });

    it('should use translate fallback on error without message', () => {
      component.form.setValue({
        name: 'Test',
        email: 'test@test.com',
        password: 'password123',
        password_confirmation: 'password123'
      });
      authServiceSpy.register.mockReturnValue(throwError(() => ({})));

      component.onSubmit();

      expect(translateSpy.instant).toHaveBeenCalledWith('auth.register.errors.registrationFailed');
      expect(component.loading()).toBe(false);
      expect(routerSpy.navigate).not.toHaveBeenCalled();
    });
  });
});
