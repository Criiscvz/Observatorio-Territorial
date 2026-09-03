import { CommonModule } from '@angular/common';
import { Component, inject, signal, DestroyRef } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Router, RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AuthService } from '@core/services/auth.service';
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    TranslateModule,
  ],
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss',
})
export class RegisterComponent {
    private readonly destroyRef = inject(DestroyRef);
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  private translate = inject(TranslateService);

  form: FormGroup = this.fb.group({
    name: ['', [Validators.required]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    password_confirmation: ['', [Validators.required]],
  });

  loading = signal(false);
  error = signal<string | null>(null);
  hidePassword = signal(true);

  onSubmit(): void {
    if (this.form.invalid) return;

    if (this.form.value.password !== this.form.value.password_confirmation) {
      this.error.set(this.translate.instant('common.validation.passwordMismatch'));
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    this.authService.register(this.form.value).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (response) => {
        this.router.navigate(['/auth/verificar-correo'], {
          state: {
            email: response.email,
            emailSent: response.email_sent,
            resendAfter: response.resend_after,
          },
        });
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err.error?.message || this.translate.instant('auth.register.errors.registrationFailed'));
      },
    });
  }

  continueWithGoogle(): void {
    this.loading.set(true);
    this.error.set(null);
    this.authService.getGoogleAuthorizationUrl().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ url }) => window.location.assign(url),
      error: (err) => {
        this.loading.set(false);
        this.error.set(err.error?.message || 'Google no está disponible en este momento.');
      },
    });
  }
}
