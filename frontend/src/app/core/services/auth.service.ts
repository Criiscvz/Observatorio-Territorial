import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, finalize, map, of, tap } from 'rxjs';
import { AuthResponse, LoginRequest, RegisterRequest, User, UserRole } from '../models';
import { ApiService } from './api.service';

/**
 * Clave para almacenar el perfil del usuario en sessionStorage.
 * NOTA DE SEGURIDAD: El token JWT ya NO se persiste en localStorage ni en
 * sessionStorage. Vive únicamente en memoria (señal Angular) para minimizar
 * la superficie de ataque frente a inyecciones XSS.
 */
const USER_KEY = 'auth_user';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);

  // State con signals
  private readonly userSignal = signal<User | null>(this.getStoredUser());
  /**
   * El token vive únicamente en memoria. No se inicializa desde ningún
   * almacenamiento persistente para evitar robo de sesión por XSS.
   */
  private readonly tokenSignal = signal<string | null>(null);
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

  register(data: RegisterRequest): Observable<AuthResponse> {
    this.loadingSignal.set(true);
    return this.api.post<AuthResponse>('/register', data).pipe(
      tap((response) => this.handleAuthSuccess(response)),
      finalize(() => this.loadingSignal.set(false))
    );
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
      tap(() => this.clearAuth()),
      catchError(() => {
        this.clearAuth();
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
    if (!this.tokenSignal()) {
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
   * El token solo existe en memoria durante la sesión activa.
   */
  getToken(): string | null {
    return this.tokenSignal();
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
      sessionStorage.removeItem(USER_KEY);
    }
  }

  private handleAuthSuccess(response: AuthResponse): void {
    // El token se mantiene SOLO en la señal en memoria para evitar exposición por XSS.
    const normalizedUser = this.normalizeUser(response.user);
    this.tokenSignal.set(response.token);
    this.userSignal.set(normalizedUser);
    // El perfil del usuario se guarda en sessionStorage (mismo tab, se elimina al cerrar).
    this.storeUser(normalizedUser);
  }

  private clearAuth(): void {
    this.clearAuthSilent();
    this.router.navigate(['/auth/login']);
  }

  /**
   * El usuario se recupera de sessionStorage para mostrar datos básicos
   * tras una recarga de página, sin exponer el token de sesión.
   * Al recargar, checkAuth() verificará con el backend si la sesión es válida.
   */
  private getStoredUser(): User | null {
    if (typeof window === 'undefined') return null;
    const user = sessionStorage.getItem(USER_KEY);
    return user ? this.normalizeUser(JSON.parse(user)) : null;
  }

  /**
   * El perfil del usuario se almacena en sessionStorage:
   * - No es accesible desde otras pestañas del navegador.
   * - Se elimina automáticamente al cerrar la pestaña/navegador.
   * - No contiene el token JWT.
   */
  private storeUser(user: User): void {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(USER_KEY, JSON.stringify(user));
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
