import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslateModule } from '@ngx-translate/core';
import { of } from 'rxjs';
import { UserService } from '@core/services/user.service';
import { UsuarioFormComponent } from './usuario-form.component';

describe('retained user form password policy', () => {
  function setup(edit: boolean) {
    const user = { id: 8, name: 'Persona de prueba', email: 'policy@example.test', rol: 'USER', is_active: true };
    const api = { getUserById: vi.fn(() => of({ data: user })), updateUser: vi.fn(() => of({ data: user })), createUser: vi.fn(() => of({ data: user })) };
    TestBed.configureTestingModule({ imports: [UsuarioFormComponent, TranslateModule.forRoot()], providers: [provideNoopAnimations(), provideRouter([]),
      { provide: ActivatedRoute, useValue: { snapshot: { params: edit ? { id: '8' } : {} } } },
      { provide: UserService, useValue: api }, { provide: MatSnackBar, useValue: { open: vi.fn() } }] });
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(UsuarioFormComponent); fixture.detectChanges();
    return { component: fixture.componentInstance, api, fixture };
  }
  it('keeps an empty edit optional while validating a supplied new password after loading', () => {
    const { component, api } = setup(true);
    const password = component.userForm.get('password')!;
    expect(password.valid).toBe(true);
    password.setValue('passwordpassword'); component.onSubmit();
    expect(password.invalid).toBe(true); expect(api.updateUser).not.toHaveBeenCalled();
    password.setValue(''); expect(password.valid).toBe(true);
    component.onSubmit();
    expect(api.updateUser).toHaveBeenCalledTimes(1);
    expect(api.updateUser).toHaveBeenCalledWith(8, expect.not.objectContaining({ password: expect.anything() }));
  });
  it('requires the shared policy when creating an account', () => {
    const { component, api } = setup(false);
    component.userForm.patchValue({ name: 'Persona de prueba', email: 'policy@example.test', password: 'short' });
    component.onSubmit(); expect(api.createUser).not.toHaveBeenCalled();
    component.userForm.get('password')!.setValue('alameda mar sol');
    component.onSubmit(); expect(api.createUser).toHaveBeenCalledTimes(1);
  });
});
