import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
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
    <div class="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <mat-card class="w-full max-w-md">
        <mat-card-header class="justify-center mb-6">
          <div class="text-center w-full">
            <img src="ULEAM.png" alt="ULEAM" class="h-20 mx-auto mb-4">
            <mat-card-title class="text-2xl font-bold text-gray-800">
              Observatorio ULEAM
            </mat-card-title>
            <mat-card-subtitle>Ingresa a tu cuenta</mat-card-subtitle>
          </div>
        </mat-card-header>

        <mat-card-content>
          @if (error()) {
            <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              {{ error() }}
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
          <p class="text-gray-600">
            ¿No tienes cuenta? 
            <a routerLink="/auth/register" class="text-red-600 hover:underline font-medium">
              Regístrate aquí
            </a>
          </p>
        </mat-card-actions>
      </mat-card>
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }
    mat-card {
      padding: 2rem;
    }
    mat-card-header {
      margin-bottom: 1.5rem;
    }
  `]
})
export class LoginComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);

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
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err.error?.message || 'Error al iniciar sesión');
      }
    });
  }
}
