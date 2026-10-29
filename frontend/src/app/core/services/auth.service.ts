import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, Subject, catchError, finalize, map, of, shareReplay, switchMap, tap, timeout } from 'rxjs';
import { AuthResponse, LoginRequest, RegisterRequest, User, UserRole } from '../models';
import { ApiService } from './api.service';

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
  private readonly sessionChanges = new Subject<'login' | 'logout'>();
  readonly sessionChanges$ = this.sessionChanges.asObservable();
  private sessionCheck?: Observable<boolean>;
  private authRevision = 0;
  get sessionVersion(): number { return this.authRevision; }

  // State con signals
  private readonly userSignal = signal<User | null>(null);
  private readonly loadingSignal = signal<boolean>(false);

  // Computed values
  readonly user = computed(() => this.userSignal());
  readonly isAuthenticated = computed(() => !!this.userSignal());
  readonly isLoading = computed(() => this.loadingSignal());

  // Computed values para roles
  readonly isAdmin = computed(() => this.userSignal()?.rol === 'ADMIN');
  readonly isUser = computed(() => this.userSignal()?.rol === 'USER');
  readonly isEditor = computed(() => this.userSignal()?.rol === 'EDITOR');
  readonly isObservatoryAdmin = computed(() => this.userSignal()?.rol === 'ADMIN_OBSERVATORIO');
  readonly hasWorkspace = computed(() => this.isAdmin() || this.isEditor() || this.isObservatoryAdmin());

  canReviewObservatory(id?: string | null): boolean {
    return this.isAdmin() || (this.isObservatoryAdmin() && !!this.user()?.departamentos?.some(
      department => (!id || department.id === id) && department.puede_revisar));
  }

  canAssignEditors(): boolean {
    return this.isAdmin() || (this.isObservatoryAdmin() && !!this.user()?.departamentos?.some(department => department.puede_agregar_editores));
  }
  readonly isSubscriber = computed(() => this.userSignal()?.rol === 'SUBSCRIBER');
  readonly userRole = computed(() => this.userSignal()?.rol ?? null);

  register(data: RegisterRequest): Observable<RegisterPendingResponse> {
    this.loadingSignal.set(true);
    return this.api.getCsrfCookie().pipe(
      switchMap(() => this.api.post<RegisterPendingResponse>('/register', data)),
      tap((response) => this.setPendingVerificationEmail(response.email)),
      finalize(() => this.loadingSignal.set(false))
    );
  }

  verifyEmail(email: string, code: string): Observable<AuthResponse> {
    this.loadingSignal.set(true);
    return this.api.getCsrfCookie().pipe(
      switchMap(() => this.api.post<AuthResponse>('/verify-email-code', { email, code })),
      tap((response) => {
          this.clearPendingVerificationEmail();
          this.handleAuthSuccess(response);
        }),
      finalize(() => this.loadingSignal.set(false)),
    );
  }

  resendVerificationCode(email: string): Observable<VerificationMessageResponse> {
    return this.api.getCsrfCookie().pipe(
      switchMap(() => this.api.post<VerificationMessageResponse>('/resend-verification-code', { email })),
    );
  }

  getGoogleAuthorizationUrl(): Observable<{ url: string }> {
    return this.api.get<{ url: string }>('/auth/google/redirect');
  }

  exchangeGoogleCode(code: string): Observable<AuthResponse> {
    this.loadingSignal.set(true);
    return this.api.getCsrfCookie().pipe(
      switchMap(() => this.api.post<AuthResponse>('/auth/google/exchange', { code })),
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
    return this.api.getCsrfCookie().pipe(
      switchMap(() => this.api.post<AuthResponse>('/login', data)),
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
    const revision = this.authRevision;
    return this.api.get<User>('/user').pipe(
      tap((user) => {
        // A response started before login/logout must not replace the newer session.
        if (revision !== this.authRevision) return;
        const normalizedUser = this.normalizeUser(user);
        this.userSignal.set(normalizedUser);
      })
    );
  }

  checkAuth(): Observable<boolean> {
    if (!this.sessionCheck) {
      const revision = this.authRevision;
      this.sessionCheck = this.getCurrentUser().pipe(
        // Includes the existing Render warmup gate and its cold-start retries.
        // Bootstrap has its own short deadline; the shared check keeps running.
        timeout({ first: 60000 }),
        map(() => this.isAuthenticated()),
        catchError((error) => {
          if ((error.status === 401 || error.status === 419) && revision === this.authRevision) this.clearAuthSilent();
          // A temporary outage is not a logout. Unknown sessions remain anonymous.
          return of(this.isAuthenticated());
        }),
        finalize(() => { this.sessionCheck = undefined; }),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
    }
    return this.sessionCheck;
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
   * Actualizar datos del usuario en el estado local
   */
  updateUser(user: User): void {
    this.authRevision++;
    const normalizedUser = this.normalizeUser(user);
    this.userSignal.set(normalizedUser);
  }

  /**
   * Limpiar autenticación sin redireccionar. Los guards e interceptores
   * deciden si corresponde una redirección.
   */
  clearAuthSilent(): void {
    this.authRevision++;
    this.userSignal.set(null);
  }

  private handleAuthSuccess(response: AuthResponse): void {
    this.authRevision++;
    const normalizedUser = this.normalizeUser(response.user);
    this.userSignal.set(normalizedUser);
    this.sessionChanges.next('login');
  }

  private completeLogout(): void {
    this.clearAuthSilent();
    this.sessionChanges.next('logout');
    this.router.navigate(['/publico/departamentos']);
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
    if (['ADMIN', 'USER', 'SUBSCRIBER', 'EDITOR', 'ADMIN_OBSERVATORIO'].includes(normalized)) {
      return normalized as UserRole;
    }
    return 'USER';
  }
}
