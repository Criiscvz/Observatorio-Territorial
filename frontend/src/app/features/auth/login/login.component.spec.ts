import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Pipe, PipeTransform } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';
import { Router } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { LoginComponent } from './login.component';
import { AuthService } from '@core/services/auth.service';
import { ThemeService } from '@core/services/theme.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

@Pipe({ name: 'translate', standalone: true })
class MockTranslatePipe implements PipeTransform {
  transform(value: string): string { return value; }
}

describe('LoginComponent', () => {
  let component: LoginComponent;
  let fixture: ComponentFixture<LoginComponent>;
  let authServiceSpy: any;
  let routerSpy: any;
  let translateSpy: any;

  beforeEach(async () => {
    authServiceSpy = {
      login: vi.fn(),
      isAdmin: vi.fn().mockReturnValue(false),
      isEditor: vi.fn().mockReturnValue(false),
      setPendingVerificationEmail: vi.fn(),
      getGoogleAuthorizationUrl: vi.fn(),
    };
    translateSpy = { instant: vi.fn().mockImplementation((k) => k) };

    TestBed.overrideComponent(LoginComponent, {
      remove: { imports: [TranslateModule] },
      add: { imports: [MockTranslatePipe] }
    });
    TestBed.overrideProvider(AuthService, { useValue: authServiceSpy });
    TestBed.overrideProvider(TranslateService, { useValue: translateSpy });
    TestBed.overrideProvider(ThemeService, { useValue: {isDark:()=>true, toggleTheme:vi.fn()} });

    await TestBed.configureTestingModule({
      imports: [LoginComponent, ReactiveFormsModule, NoopAnimationsModule, RouterTestingModule.withRoutes([])],
      providers: [
        FormBuilder
      ]
    }).compileComponents();

    routerSpy = TestBed.inject(Router);
    vi.spyOn(routerSpy, 'navigate').mockImplementation(() => Promise.resolve(true));

    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create with form initialized', () => {
    expect(component).toBeTruthy();
    expect(component.form.controls['email']).toBeTruthy();
    expect(component.form.controls['password']).toBeTruthy();
  });
  it('lleva al editor a su espacio de trabajo al iniciar sesión', () => {
    authServiceSpy.isEditor.mockReturnValue(true);
    authServiceSpy.login.mockReturnValue(of({}));
    component.form.setValue({email:'editor@local.invalid',password:'password123'});
    component.onSubmit();
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/admin/dashboard']);
  });

  it('should start with loading=false and error=null', () => {
    expect(component.loading()).toBe(false);
    expect(component.error()).toBeNull();
  });

  it('muestra los errores al enviar el formulario vacío sin llamar a la API', () => {
    const element = fixture.nativeElement as HTMLElement;
    element.querySelector<HTMLButtonElement>('.login-submit')!.click();
    fixture.detectChanges();
    expect(authServiceSpy.login).not.toHaveBeenCalled();
    expect(element.querySelector<HTMLInputElement>('#login-email')!.getAttribute('aria-invalid')).toBe('true');
    expect(element.querySelector<HTMLElement>('#login-email-error')!.hidden).toBe(false);
    expect(element.querySelector<HTMLElement>('#login-password-error')!.hidden).toBe(false);
    expect(element.querySelector('.login-back')!.getAttribute('href')).toBe('/');
  });

  it('permite mostrar la contraseña sin enviar el formulario', () => {
    const element = fixture.nativeElement as HTMLElement;
    component.form.patchValue({password:'prueba-local'});
    element.querySelector<HTMLButtonElement>('.password-toggle')!.click();
    fixture.detectChanges();
    expect(element.querySelector<HTMLInputElement>('#login-password')!.type).toBe('text');
    expect(element.querySelector('.password-toggle')!.getAttribute('aria-pressed')).toBe('true');
    expect(authServiceSpy.login).not.toHaveBeenCalled();
  });

  it('impide solicitudes duplicadas y cambios de método mientras inicia sesión', () => {
    const pending = new Subject<any>();
    authServiceSpy.login.mockReturnValue(pending);
    component.form.setValue({email:'prueba@example.test',password:'prueba'});
    component.onSubmit();component.onSubmit();component.continueWithGoogle();fixture.detectChanges();
    expect(authServiceSpy.login).toHaveBeenCalledTimes(1);
    expect(authServiceSpy.getGoogleAuthorizationUrl).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('fieldset').disabled).toBe(true);
    expect(fixture.nativeElement.querySelector('.login-google').disabled).toBe(true);
    pending.error({error:{message:'Error de prueba'}});fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('fieldset').disabled).toBe(false);
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain('Error de prueba');
  });

  it('mantiene el flujo de verificación de correo', () => {
    component.form.setValue({email:'pendiente@example.test',password:'prueba'});
    authServiceSpy.login.mockReturnValue(throwError(()=>({status:403,error:{code:'EMAIL_VERIFICATION_REQUIRED',details:{email:'pendiente@example.test'}}})));
    component.onSubmit();
    expect(authServiceSpy.setPendingVerificationEmail).toHaveBeenCalledWith('pendiente@example.test');
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/auth/verificar-correo'],{state:{email:'pendiente@example.test'}});
  });

  it('muestra el error de Google y permite volver a intentar', () => {
    authServiceSpy.getGoogleAuthorizationUrl.mockReturnValue(throwError(()=>({})));
    component.continueWithGoogle();fixture.detectChanges();
    expect(component.loading()).toBe(false);
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain('auth.login.design.googleUnavailable');
  });

  describe('onSubmit()', () => {
    it('should not call login if form is invalid', () => {
      component.form.setValue({ email: 'not-email', password: '' });
      component.onSubmit();
      expect(authServiceSpy.login).not.toHaveBeenCalled();
    });

    it('should navigate to /admin/dashboard if user is ADMIN', () => {
      component.form.setValue({ email: 'admin@test.com', password: 'password123' });
      authServiceSpy.login.mockReturnValue(of({}));
      authServiceSpy.isAdmin.mockReturnValue(true);

      component.onSubmit();

      expect(authServiceSpy.login).toHaveBeenCalledWith({ email: 'admin@test.com', password: 'password123' });
      expect(routerSpy.navigate).toHaveBeenCalledWith(['/admin/dashboard']);
    });

    it('should navigate to /publico/departamentos if user is not ADMIN', () => {
      component.form.setValue({ email: 'user@test.com', password: 'password123' });
      authServiceSpy.login.mockReturnValue(of({}));
      authServiceSpy.isAdmin.mockReturnValue(false);

      component.onSubmit();

      expect(routerSpy.navigate).toHaveBeenCalledWith(['/publico/departamentos']);
    });

    it('should set error signal and stop loading on login failure', () => {
      component.form.setValue({ email: 'user@test.com', password: 'wrong' });
      authServiceSpy.login.mockReturnValue(throwError(() => ({ error: { message: 'Credenciales incorrectas' } })));

      component.onSubmit();

      expect(component.error()).toBe('Credenciales incorrectas');
      expect(component.loading()).toBe(false);
    });

    it('should use translate fallback on error without message', () => {
      component.form.setValue({ email: 'user@test.com', password: 'wrong' });
      authServiceSpy.login.mockReturnValue(throwError(() => ({})));

      component.onSubmit();

      expect(translateSpy.instant).toHaveBeenCalledWith('auth.login.errors.loginFailed');
    });
  });
});
