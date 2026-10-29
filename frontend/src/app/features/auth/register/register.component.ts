import { Component, DestroyRef, ElementRef, ViewChild, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Router, RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { APP_CONFIG } from '@core/config';
import { AuthService } from '@core/services/auth.service';
import { ThemeService } from '@core/services/theme.service';
import { communityProfilePayload, createCommunityProfileForm } from '@core/models/user/community-profile';
import { CommunityProfileFieldsComponent } from '../../../shared/components/community-profile-fields/community-profile-fields.component';

@Component({
  selector: 'app-register', standalone: true,
  imports: [ReactiveFormsModule, RouterLink, MatButtonModule, MatIconModule, MatProgressSpinnerModule, TranslateModule, CommunityProfileFieldsComponent],
  templateUrl: './register.component.html', styleUrl: './register.component.scss',
})
export class RegisterComponent {
  @ViewChild('stepHeading') stepHeading?: ElementRef<HTMLElement>;
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);
  // Initialize the saved appearance on direct visits to this route as well.
  private readonly themeService = inject(ThemeService);
  readonly appConfig = APP_CONFIG;
  readonly form = this.fb.nonNullable.group({
    given_name: ['', [Validators.required, Validators.pattern(/\S/), Validators.maxLength(125)]],
    family_name: ['', [Validators.required, Validators.pattern(/\S/), Validators.maxLength(125)]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(255)]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    password_confirmation: ['', Validators.required],
  }, { validators: group => group.get('password')?.value !== group.get('password_confirmation')?.value ? { passwordMismatch: true } : null });
  readonly profileForm = createCommunityProfileForm(this.fb);
  readonly step = signal(1);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly hidePassword = signal(true);
  readonly hideConfirmation = signal(true);

  invalid(name: string): boolean { const control = this.form.get(name); return !!control?.invalid && control.touched; }
  private validAccount(): boolean {
    this.form.markAllAsTouched();
    if (this.form.hasError('passwordMismatch')) this.error.set(this.translate.instant('common.validation.passwordMismatch'));
    return this.form.valid;
  }
  private focusHeading(): void { queueMicrotask(() => this.stepHeading?.nativeElement.focus()); }
  nextStep(): void {
    if (this.loading()) return;
    this.error.set(null);
    if (!this.validAccount()) return;
    this.step.set(2); this.focusHeading();
  }
  previousStep(): void {
    if (this.loading()) return;
    this.error.set(null); this.step.set(1); this.focusHeading();
  }
  onSubmit(skipProfile = false): void {
    if (this.loading()) return;
    if (this.step() === 1) { this.nextStep(); return; }
    this.error.set(null);
    if (!this.validAccount()) { this.step.set(1); this.focusHeading(); return; }
    if (!skipProfile && this.profileForm.invalid) { this.profileForm.markAllAsTouched(); return; }
    const value = this.form.getRawValue();
    const data = {
      name: `${value.given_name.trim()} ${value.family_name.trim()}`,
      email: value.email.trim().toLowerCase(), password: value.password, password_confirmation: value.password_confirmation,
      ...(skipProfile ? {} : communityProfilePayload(this.profileForm.getRawValue())),
    };
    this.loading.set(true);
    this.authService.register(data).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: response => {
        this.form.controls.password.reset(); this.form.controls.password_confirmation.reset();
        this.router.navigate(['/auth/verificar-correo'], { state: { email: response.email, emailSent: response.email_sent, resendAfter: response.resend_after } });
      },
      error: err => {
        this.loading.set(false);
        const errors = err.error?.errors;
        if (errors?.name || errors?.email || errors?.password) { this.step.set(1); this.focusHeading(); }
        this.error.set(errors ? Object.values(errors).flat().join(' ') : err.error?.message || this.translate.instant('auth.register.errors.registrationFailed'));
      },
    });
  }
  continueWithGoogle(): void {
    if (this.loading()) return;
    this.loading.set(true); this.error.set(null);
    this.authService.getGoogleAuthorizationUrl().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ url }) => window.location.assign(url),
      error: err => { this.loading.set(false); this.error.set(err.error?.message || this.translate.instant('auth.register.googleUnavailable')); },
    });
  }
}
