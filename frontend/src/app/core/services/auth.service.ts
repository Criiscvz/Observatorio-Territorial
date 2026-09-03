import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, finalize, map, of, tap } from 'rxjs';
import { AuthResponse, LoginRequest, RegisterRequest, User, UserRole } from '../models';
import { ApiService } from './api.service';

/**
 * Claves usadas para restaurar la sesión después de recargar la página.
 */
const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';
const EXPIRES_AT_KEY = 'auth_expires_at';
const VERIFICATION_EMAIL_KEY = 'verification_email';

export interface RegisterPendingResponse {
  message: string;
  verification_required: true;
  email: string;
  email_sent: boolean;
  resend_after: number;
}

export interface VerificationMessageResponse {
  message: string;
  resend_after: number;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);

  // State con signals
  private readonly userSignal = signal<User | null>(this.getStoredUser());
  private readonly tokenSignal = signal<string | null>(this.getStoredToken());
  private readonly loadingSignal = signal<boolean>(false);

  // Computed values
  readonly user = computed(() => this.userSignal());
  readonly token = computed(() => this.tokenSignal());
  readonly isAuthenticated = computed(() => !!this.tokenSignal());
  readonly isLoading = computed(() => this.loadingSignal());

  // Computed values para roles
  readonly isAdmin = computed(() => this.userSignal()?.rol === 'ADMIN');
  readonly isUser = computed(() => this.userSignal()?.rol === 'USER');
  readonly isEditor = computed(() => this.userSignal()?.rol === 'EDITOR');
  readonly isSubscriber = computed(() => this.userSignal()?.rol === 'SUBSCRIBER');
  readonly userRole = computed(() => this.userSignal()?.rol ?? null);

  register(data: RegisterRequest): Observable<RegisterPendingResponse> {
    this.loadingSignal.set(true);
    return this.api.post<RegisterPendingResponse>('/register', data).pipe(
      tap((response) => this.setPendingVerificationEmail(response.email)),
      finalize(() => this.loadingSignal.set(false))
    );
  }

  verifyEmail(email: string, code: string): Observable<AuthResponse> {
    this.loadingSignal.set(true);
    return this.api.post<AuthResponse>('/verify-email-code', { email, code }).pipe(
      tap((response) => {
        this.clearPendingVerificationEmail();
        this.handleAuthSuccess(response);
      }),
      finalize(() => this.loadingSignal.set(false)),
    );
  }

  resendVerificationCode(email: string): Observable<VerificationMessageResponse> {
    return this.api.post<VerificationMessageResponse>('/resend-verification-code', { email });
  }

  getGoogleAuthorizationUrl(): Observable<{ url: string }> {
    return this.api.get<{ url: string }>('/auth/google/redirect');
  }

  exchangeGoogleCode(code: string): Observable<AuthResponse> {
    this.loadingSignal.set(true);
    return this.api.post<AuthResponse>('/auth/google/exchange', { code }).pipe(
      tap((response) => this.handleAuthSuccess(response)),
      finalize(() => this.loadingSignal.set(false)),
    );
  }

  setPendingVerificationEmail(email: string): void {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(VERIFICATION_EMAIL_KEY, email);
    }
  }

  getPendingVerificationEmail(): string {
    return typeof window !== 'undefined' ? (sessionStorage.getItem(VERIFICATION_EMAIL_KEY) ?? '') : '';
  }

  clearPendingVerificationEmail(): void {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem(VERIFICATION_EMAIL_KEY);
    }
  }

  login(data: LoginRequest): Observable<AuthResponse> {
    this.loadingSignal.set(true);
    return this.api.post<AuthResponse>('/login', data).pipe(
      tap((response) => this.handleAuthSuccess(response)),
      finalize(() => this.loadingSignal.set(false))
    );
  }

  logout(): Observable<any> {
    return this.api.post('/logout', {}).pipe(
      tap(() => this.completeLogout()),
      catchError(() => {
        this.completeLogout();
        return of(null);
      })
    );
  }

  getCurrentUser(): Observable<User> {
    return this.api.get<User>('/user').pipe(
      tap((user) => {
        const normalizedUser = this.normalizeUser(user);
        this.userSignal.set(normalizedUser);
        this.storeUser(normalizedUser);
      })
    );
  }

  checkAuth(): Observable<boolean> {
    if (!this.tokenSignal() || this.isSessionExpired()) {
      this.clearAuthSilent();
      return of(false);
    }

    return this.getCurrentUser().pipe(
      map(() => true),
      catchError(() => {
        this.clearAuth();
        return of(false);
      })
    );
  }

  /**
   * Verificar si el usuario tiene un rol global específico
   */
  hasRole(role: UserRole): boolean {
    return this.userSignal()?.rol === role;
  }

  /**
   * Verificar si el usuario tiene alguno de los roles especificados
   */
  hasAnyRole(roles: UserRole[]): boolean {
    const userRole = this.userSignal()?.rol;
    return userRole ? roles.includes(userRole) : false;
  }

  /**
   * Verificar si el usuario tiene un rol específico en un departamento
   */
  hasRoleInDepartamento(departamentoId: string, roles: string[]): boolean {
    const user = this.userSignal();
    if (!user?.departamentos) return false;

    const depto = user.departamentos.find((d) => String(d.id) === String(departamentoId));
    return depto ? roles.includes(String(depto.rol).toUpperCase()) : false;
  }

  /**
   * Obtener token actual (para uso en interceptors).
   */
  getToken(): string | null {
    if (this.tokenSignal()) {
      return this.tokenSignal();
    }

    const storedToken = this.getStoredToken();
    if (storedToken) {
      this.tokenSignal.set(storedToken);
    }

    return storedToken;
  }

  /**
   * Actualizar datos del usuario en el estado local
   */
  updateUser(user: User): void {
    const normalizedUser = this.normalizeUser(user);
    this.userSignal.set(normalizedUser);
    this.storeUser(normalizedUser);
  }

  /**
   * Limpiar autenticación sin redireccionar
   */
  clearAuthSilent(): void {
    this.tokenSignal.set(null);
    this.userSignal.set(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      localStorage.removeItem(EXPIRES_AT_KEY);
      sessionStorage.removeItem(USER_KEY);
    }
  }

  private handleAuthSuccess(response: AuthResponse): void {
    // El token se mantiene SOLO en la señal en memoria para evitar exposición por XSS.
    const normalizedUser = this.normalizeUser(response.user);
    this.tokenSignal.set(response.token);
    this.userSignal.set(normalizedUser);
    this.storeToken(response.token);
    this.storeUser(normalizedUser);
    this.storeExpiration(response.expires_at);
  }

  private clearAuth(): void {
    this.clearAuthSilent();
    this.router.navigate(['/auth/login']);
  }

  private completeLogout(): void {
    this.clearAuthSilent();
    this.router.navigate(['/publico/departamentos']);
  }

  /**
   * El usuario se recupera para restaurar roles y permisos despues de recargar.
   */
  private getStoredUser(): User | null {
    if (typeof window === 'undefined') return null;
    if (!localStorage.getItem(TOKEN_KEY)) {
      localStorage.removeItem(USER_KEY);
      sessionStorage.removeItem(USER_KEY);
      return null;
    }

    if (this.isStoredSessionExpired()) return null;

    const user = localStorage.getItem(USER_KEY) ?? sessionStorage.getItem(USER_KEY);
    if (!user) return null;

    try {
      return this.normalizeUser(JSON.parse(user));
    } catch {
      localStorage.removeItem(USER_KEY);
      sessionStorage.removeItem(USER_KEY);
      return null;
    }
  }

  private getStoredToken(): string | null {
    if (typeof window === 'undefined') return null;
    if (this.isStoredSessionExpired()) {
      this.clearStoredSession();
      return null;
    }

    return localStorage.getItem(TOKEN_KEY);
  }

  private storeToken(token: string): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem(TOKEN_KEY, token);
    }
  }

  private storeUser(user: User): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
      sessionStorage.removeItem(USER_KEY);
    }
  }

  private storeExpiration(expiresAt?: string | null): void {
    if (typeof window === 'undefined') return;

    if (!expiresAt) {
      localStorage.removeItem(EXPIRES_AT_KEY);
      return;
    }

    const expiresAtTime = new Date(expiresAt).getTime();
    if (Number.isNaN(expiresAtTime)) {
      localStorage.removeItem(EXPIRES_AT_KEY);
      return;
    }

    localStorage.setItem(EXPIRES_AT_KEY, expiresAt);
  }

  private isSessionExpired(): boolean {
    if (typeof window === 'undefined') return false;
    return this.isStoredSessionExpired();
  }

  private isStoredSessionExpired(): boolean {
    if (typeof window === 'undefined') return false;

    const expiresAt = localStorage.getItem(EXPIRES_AT_KEY);
    if (!expiresAt) {
      return false;
    }

    const expiresAtTime = new Date(expiresAt).getTime();
    return Number.isNaN(expiresAtTime) || expiresAtTime <= Date.now();
  }

  private clearStoredSession(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      localStorage.removeItem(EXPIRES_AT_KEY);
      sessionStorage.removeItem(USER_KEY);
    }
  }

  private normalizeUser(user: User | (Partial<User> & Record<string, any>)): User {
    const rawRole =
      user.rol ??
      user['role'] ??
      (Array.isArray(user['roles'])
        ? (user['roles'][0]?.nombre ?? user['roles'][0]?.name ?? user['roles'][0])
        : undefined);

    return {
      ...(user as User),
      rol: this.normalizeRole(rawRole),
      departamentos: (user.departamentos ?? []).map((departamento: any) => ({
        ...departamento,
        id: String(departamento.id),
        rol: String(departamento.rol ?? departamento.role ?? '').toUpperCase(),
      })),
    };
  }

  private normalizeRole(role: unknown): UserRole {
    const normalized = String(role ?? 'USER').trim().toUpperCase();
    if (normalized === 'SUSCRIPTOR' || normalized === 'SUBSCRIPTOR') {
      return 'SUBSCRIBER';
    }
    if (['ADMIN', 'USER', 'SUBSCRIBER', 'EDITOR'].includes(normalized)) {
      return normalized as UserRole;
    }
    return 'USER';
  }
}
