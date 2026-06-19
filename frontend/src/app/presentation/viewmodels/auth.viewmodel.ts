import { Injectable, computed, inject, signal, DestroyRef } from '@angular/core';
import { Router } from '@angular/router';
import { LoginCredentials, RegisterData, UserEntity } from '@core/domain/entities';
import { AuthRepository } from '@core/domain/repositories';
import { LoginUseCase, LogoutUseCase, RegisterUseCase } from '@core/domain/usecases/auth';
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";

@Injectable({ providedIn: 'root' })
export class AuthViewModel {
    private readonly destroyRef = inject(DestroyRef);
  private readonly loginUseCase = inject(LoginUseCase);
  private readonly registerUseCase = inject(RegisterUseCase);
  private readonly logoutUseCase = inject(LogoutUseCase);
  private readonly authRepository = inject(AuthRepository);
  private readonly router = inject(Router);

  // State
  readonly currentUser = signal<UserEntity | null>(null);
  readonly isLoading = signal(false);
  readonly error = signal<string | null>(null);

  // Computed
  readonly isAuthenticated = computed(() => this.authRepository.isAuthenticated());

  login(credentials: LoginCredentials): void {
    this.isLoading.set(true);
    this.error.set(null);

    this.loginUseCase.execute(credentials).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (response) => {
        this.currentUser.set(response.user);
        this.isLoading.set(false);
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.error.set(err.error?.message || 'Error al iniciar sesión');
        this.isLoading.set(false);
      },
    });
  }

  register(data: RegisterData): void {
    this.isLoading.set(true);
    this.error.set(null);

    this.registerUseCase.execute(data).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (response) => {
        this.currentUser.set(response.user);
        this.isLoading.set(false);
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.error.set(err.error?.message || 'Error al registrarse');
        this.isLoading.set(false);
      },
    });
  }

  logout(): void {
    this.isLoading.set(true);

    this.logoutUseCase.execute().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.currentUser.set(null);
        this.isLoading.set(false);
        this.router.navigate(['/login']);
      },
      error: () => {
        // Limpiar de todas formas
        this.authRepository.clearToken();
        this.currentUser.set(null);
        this.isLoading.set(false);
        this.router.navigate(['/login']);
      },
    });
  }

  loadCurrentUser(): void {
    if (!this.isAuthenticated()) return;

    this.authRepository.getCurrentUser().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (user) => this.currentUser.set(user),
      error: () => this.authRepository.clearToken(),
    });
  }
}
