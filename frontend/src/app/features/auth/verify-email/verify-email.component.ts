import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '@core/services/auth.service';

@Component({
  selector: 'app-verify-email', standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, MatButtonModule, MatCardModule, MatFormFieldModule, MatIconModule, MatInputModule, MatProgressSpinnerModule],
  templateUrl: './verify-email.component.html', styleUrl: './verify-email.component.scss',
})
export class VerifyEmailComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  readonly email = signal(this.readEmail());
  readonly emailSent = signal(this.readInitialEmailSent());
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly success = signal<string | null>(null);
  readonly resendSeconds = signal(this.readInitialCooldown());
  readonly form = this.fb.nonNullable.group({ code: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]] });

  constructor() {
    if (!this.email()) { this.router.navigate(['/auth/login']); return; }
    if (!this.isBrowser) return;
    const timer = window.setInterval(() => {
      if (this.resendSeconds() > 0) this.resendSeconds.update((value) => value - 1);
    }, 1000);
    this.destroyRef.onDestroy(() => window.clearInterval(timer));
  }

  verify(): void {
    if (this.form.invalid || this.loading()) return;
    this.loading.set(true); this.error.set(null);
    this.auth.verifyEmail(this.email(), this.form.controls.code.value).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.success.set('Correo verificado correctamente.');
        this.router.navigate([this.auth.isAdmin() || this.auth.isEditor() ? '/admin/dashboard' : '/publico/departamentos']);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err.error?.errors?.code?.[0] ?? err.error?.message ?? 'No fue posible verificar el código.');
      },
    });
  }

  resend(): void {
    if (this.resendSeconds() > 0 || this.loading()) return;
    this.loading.set(true); this.error.set(null);
    this.auth.resendVerificationCode(this.email()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (response) => {
        this.loading.set(false);
        this.emailSent.set(true);
        this.success.set(response.message);
        this.resendSeconds.set(response.resend_after || 60);
      },
      error: (err) => { this.loading.set(false); this.error.set(err.error?.errors?.email?.[0] ?? err.error?.message ?? 'No fue posible reenviar el código.'); },
    });
  }

  private readEmail(): string {
    if (!this.isBrowser) return '';
    const value = history.state?.email;
    if (typeof value === 'string' && value) { this.auth.setPendingVerificationEmail(value); return value; }
    return this.auth.getPendingVerificationEmail();
  }

  private readInitialCooldown(): number {
    return this.isBrowser ? Number(history.state?.resendAfter ?? 0) : 0;
  }

  private readInitialEmailSent(): boolean {
    return this.isBrowser ? history.state?.emailSent !== false : true;
  }
}
