import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

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
  ],
  template: `
    <div class="auth-container">
      <mat-card class="auth-card">
        <mat-card-header class="justify-center mb-6">
          <div class="text-center w-full">
            <img src="ULEAM.png" alt="ULEAM" class="auth-logo">
            <mat-card-title class="auth-title">
              Observatorio ULEAM
            </mat-card-title>
            <mat-card-subtitle>Ingresa a tu cuenta</mat-card-subtitle>
          </div>
        </mat-card-header>

        <mat-card-content>
          @if (error()) {
            <div class="alert alert-error">
              <mat-icon>error_outline</mat-icon>
              <span>{{ error() }}</span>
            </div>
          }

          <form [formGroup]="form" (ngSubmit)="onSubmit()">
            <mat-form-field class="w-full" appearance="outline">
              <mat-label>Correo electrónico</mat-label>
              <input matInput type="email" formControlName="email" placeholder="correo@uleam.edu.ec">
              <mat-icon matSuffix>email</mat-icon>
              @if (form.get('email')?.hasError('required') && form.get('email')?.touched) {
                <mat-error>El correo es requerido</mat-error>
              }
              @if (form.get('email')?.hasError('email')) {
                <mat-error>Ingresa un correo válido</mat-error>
              }
            </mat-form-field>

            <mat-form-field class="w-full" appearance="outline">
              <mat-label>Contraseña</mat-label>
              <input matInput [type]="hidePassword() ? 'password' : 'text'" formControlName="password">
              <button mat-icon-button matSuffix type="button" (click)="hidePassword.set(!hidePassword())">
                <mat-icon>{{ hidePassword() ? 'visibility_off' : 'visibility' }}</mat-icon>
              </button>
              @if (form.get('password')?.hasError('required') && form.get('password')?.touched) {
                <mat-error>La contraseña es requerida</mat-error>
              }
            </mat-form-field>

            <button mat-raised-button color="primary" type="submit" class="w-full mt-4" 
                    [disabled]="form.invalid || loading()">
              @if (loading()) {
                <mat-spinner diameter="20" class="inline-block mr-2"></mat-spinner>
                Ingresando...
              } @else {
                Iniciar Sesión
              }
            </button>
          </form>
        </mat-card-content>

        <mat-card-actions class="justify-center">
          <p class="auth-footer-text">
            ¿No tienes cuenta? 
            <a routerLink="/auth/register" class="auth-link">
              Regístrate aquí
            </a>
          </p>
        </mat-card-actions>
      </mat-card>
    </div>
  `,
  styles: [`
    :host { display: block; }
    
    .auth-container {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--bg-primary);
      padding: 1rem;
    }
    
    .auth-card {
      width: 100%;
      max-width: 28rem;
      padding: 2rem;
    }
    
    .auth-logo {
      height: 5rem;
      margin: 0 auto 1rem;
      display: block;
    }
    
    .auth-title {
      font-size: 1.5rem;
      font-weight: 700;
      color: var(--text-primary);
    }
    
    .auth-footer-text {
      color: var(--text-secondary);
    }
    
    .auth-link {
      color: var(--primary-600);
      font-weight: 500;
      text-decoration: none;
    }
    
    .auth-link:hover {
      text-decoration: underline;
    }
    
    mat-card-header {
      margin-bottom: 1.5rem;
    }
  `]
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  form: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  loading = signal(false);
  error = signal<string | null>(null);
  hidePassword = signal(true);

  onSubmit(): void {
    if (this.form.invalid) return;

    this.loading.set(true);
    this.error.set(null);

    this.authService.login(this.form.value).subscribe({
      next: () => {
        this.router.navigate(['/admin/dashboard']);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err.error?.message || 'Error al iniciar sesión');
      }
    });
  }
}
