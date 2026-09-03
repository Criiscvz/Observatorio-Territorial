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
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-login',
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
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
    private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);
  private readonly route = inject(ActivatedRoute);

  form: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  loading = signal(false);
  error = signal<string | null>(null);
  hidePassword = signal(true);

  constructor() {
    if (this.route.snapshot.queryParamMap.has('google_error')) {
      this.error.set('No fue posible completar el acceso con Google. Inténtalo nuevamente.');
    }
  }

  onSubmit(): void {
    if (this.form.invalid) return;

    this.loading.set(true);
    this.error.set(null);

    this.authService.login(this.form.value).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        // Redirigir según el rol del usuario
        if (this.authService.isAdmin()) {
          this.router.navigate(['/admin/dashboard']);
        } else {
          this.router.navigate(['/publico/departamentos']);
        }
      },
      error: (err) => {
        this.loading.set(false);
        if (err.status === 403 && err.error?.code === 'EMAIL_VERIFICATION_REQUIRED') {
          const email = err.error?.details?.email ?? this.form.value.email;
          this.authService.setPendingVerificationEmail(email);
          this.router.navigate(['/auth/verificar-correo'], { state: { email } });
          return;
        }
        this.error.set(err.error?.message || this.translate.instant('auth.login.errors.loginFailed'));
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
