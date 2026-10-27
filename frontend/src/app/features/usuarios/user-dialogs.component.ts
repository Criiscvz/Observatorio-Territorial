import { Component, DestroyRef, OnDestroy, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { User, UserRole } from '@core/models';
import { USER_ROLE_OPTIONS, userRoleLabel } from '@core/models/user/user-role.presentation';
import { AuthService } from '@core/services/auth.service';
import { ChangeUserPasswordResponse, UserService } from '@core/services/user.service';

const passwordSize = (control: AbstractControl) => new TextEncoder().encode(String(control.value ?? '')).length > 72 ? {passwordTooLong:true} : null;
const nonBlank = (control: AbstractControl) => String(control.value ?? '').trim() ? null : {required:true};
const matchingPasswords = (control: AbstractControl) => control.get('password')?.value === control.get('confirmation')?.value ? null : {mismatch:true};
function message(error: any, fallback: string): string {
  const validation = error?.error?.errors;
  const first = validation ? Object.values(validation).flat()[0] : null;
  return typeof first === 'string' ? first : typeof error?.error?.message === 'string' ? error.error.message : fallback;
}

@Component({selector:'app-user-role-dialog', standalone:true, imports:[ReactiveFormsModule,MatDialogModule,MatIconModule],
  templateUrl:'./user-role-dialog.component.html', styleUrl:'./user-dialogs.component.scss'})
export class UserRoleDialogComponent {
  readonly user = inject<User>(MAT_DIALOG_DATA);
  readonly auth = inject(AuthService);
  private readonly api = inject(UserService);
  private readonly ref = inject(MatDialogRef<UserRoleDialogComponent, User>);
  private readonly destroyRef = inject(DestroyRef);
  readonly roles = USER_ROLE_OPTIONS;
  readonly roleLabel = userRoleLabel;
  readonly saving = signal(false);
  readonly error = signal('');
  readonly form = inject(FormBuilder).nonNullable.group({rol:[this.user.rol, Validators.required]});
  private readonly selectedRole = toSignal(this.form.controls.rol.valueChanges,{initialValue:this.user.rol});
  get selection(): UserRole { return this.selectedRole(); }
  get changesScope(): boolean { return this.selection !== this.user.rol && [this.selection,this.user.rol].includes('ADMIN_OBSERVATORIO'); }
  close(): void { if(!this.saving()) this.ref.close(); }
  save(): void {
    if(this.saving() || this.form.invalid || this.selection === this.user.rol || !this.auth.isAdmin()) return;
    this.saving.set(true);this.error.set('');this.ref.disableClose=true;
    this.api.updateUserRole(this.user.id,{rol:this.selection}).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: response => this.ref.close(response.user),
      error: error => { this.saving.set(false);this.ref.disableClose=false;this.error.set(message(error,'No se pudo actualizar el rol. Inténtalo nuevamente.')); },
    });
  }
}

@Component({selector:'app-user-password-dialog', standalone:true, imports:[ReactiveFormsModule,MatDialogModule,MatIconModule],
  templateUrl:'./user-password-dialog.component.html', styleUrl:'./user-dialogs.component.scss'})
export class UserPasswordDialogComponent implements OnDestroy {
  readonly user = inject<User>(MAT_DIALOG_DATA);
  readonly auth = inject(AuthService);
  private readonly api = inject(UserService);
  private readonly ref = inject(MatDialogRef<UserPasswordDialogComponent, ChangeUserPasswordResponse>);
  private readonly destroyRef = inject(DestroyRef);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly showPassword = signal(false);
  readonly showConfirmation = signal(false);
  readonly form = inject(FormBuilder).nonNullable.group({
    password:['',[Validators.required,Validators.minLength(8),passwordSize]],
    confirmation:['',Validators.required],
  },{validators:matchingPasswords});
  get ownAccount(): boolean { return this.auth.user()?.id === this.user.id; }
  close(): void { if(!this.saving()) this.ref.close(); }
  ngOnDestroy(): void { this.form.reset(); }
  save(): void {
    this.form.markAllAsTouched();
    if(this.saving() || this.form.invalid || !this.auth.isAdmin()) return;
    this.saving.set(true);this.error.set('');this.ref.disableClose=true;
    const values=this.form.getRawValue();
    this.api.changePassword(this.user.id,values.password,values.confirmation).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: response => { this.form.reset();this.ref.close(response); },
      error: error => { this.saving.set(false);this.ref.disableClose=false;this.error.set(message(error,'No se pudo cambiar la contraseña. Inténtalo nuevamente.')); },
    });
  }
}

@Component({selector:'app-user-edit-dialog', standalone:true, imports:[ReactiveFormsModule,MatDialogModule,MatIconModule],
  templateUrl:'./user-edit-dialog.component.html', styleUrl:'./user-dialogs.component.scss'})
export class UserEditDialogComponent implements OnDestroy {
  readonly user = inject<User | null>(MAT_DIALOG_DATA);
  readonly auth = inject(AuthService);
  private readonly api = inject(UserService);
  private readonly ref = inject(MatDialogRef<UserEditDialogComponent, User>);
  private readonly destroyRef = inject(DestroyRef);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly showPassword = signal(false);
  readonly roles = USER_ROLE_OPTIONS;
  readonly form = inject(FormBuilder).nonNullable.group({
    name:[this.user?.name ?? '',[nonBlank,Validators.maxLength(255)]],
    email:[this.user?.email ?? '',[Validators.required,Validators.email,Validators.maxLength(255)]],
    telefono:[this.user?.perfil?.telefono ?? '',Validators.maxLength(20)],
    cargo:[this.user?.perfil?.cargo ?? '',Validators.maxLength(100)],
    bio:[this.user?.perfil?.bio ?? '',Validators.maxLength(500)],
    is_active:[this.user?.is_active ?? true],
    rol:['USER' as UserRole,Validators.required],
    password:['',this.user ? [] : [Validators.required,Validators.minLength(8),passwordSize]],
    confirmation:['',this.user ? [] : [Validators.required]],
  },{validators:matchingPasswords});
  constructor() {
    if(this.user?.id === this.auth.user()?.id) this.form.controls.is_active.disable();
  }
  close(): void { if(!this.saving()) this.ref.close(); }
  ngOnDestroy(): void { this.form.controls.password.reset();this.form.controls.confirmation.reset(); }
  save(): void {
    this.form.markAllAsTouched();
    if(this.saving() || this.form.invalid || !this.auth.isAdmin()) return;
    this.saving.set(true);this.error.set('');this.ref.disableClose=true;
    const values=this.form.getRawValue();
    const base={name:values.name.trim(),email:values.email.trim(),telefono:values.telefono.trim(),cargo:values.cargo.trim(),bio:values.bio.trim(),is_active:values.is_active};
    const request=this.user ? this.api.updateUser(this.user.id,base)
      : this.api.createUser({...base,rol:values.rol,password:values.password});
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: response => { this.form.controls.password.reset();this.form.controls.confirmation.reset();this.ref.close(response.data); },
      error: error => { this.saving.set(false);this.ref.disableClose=false;this.error.set(message(error,'No se pudieron guardar los datos del usuario.')); },
    });
  }
}
