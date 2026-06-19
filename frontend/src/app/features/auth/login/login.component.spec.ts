import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EventEmitter, Pipe, PipeTransform } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { LoginComponent } from './login.component';
import { AuthService } from '@core/services/auth.service';
import { TranslateService } from '@ngx-translate/core';

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
      isAdmin: vi.fn().mockReturnValue(false)
    };
    translateSpy = { instant: vi.fn().mockImplementation((k) => k) };

    TestBed.overrideComponent(LoginComponent, {
      remove: { imports: [] },
      add: { imports: [MockTranslatePipe] }
    });
    TestBed.overrideProvider(AuthService, { useValue: authServiceSpy });
    TestBed.overrideProvider(TranslateService, { useValue: translateSpy });

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

  it('should start with loading=false and error=null', () => {
    expect(component.loading()).toBe(false);
    expect(component.error()).toBeNull();
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
