import { Injectable, inject, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, tap, catchError, of } from 'rxjs';
import { ApiService } from './api.service';
import { User, AuthResponse, LoginRequest, RegisterRequest } from '../models';

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private api = inject(ApiService);
  private router = inject(Router);

  // State con signals
  private userSignal = signal<User | null>(this.getStoredUser());
  private tokenSignal = signal<string | null>(this.getStoredToken());
  private loadingSignal = signal<boolean>(false);

  // Computed values
  user = computed(() => this.userSignal());
  token = computed(() => this.tokenSignal());
  isAuthenticated = computed(() => !!this.tokenSignal());
  isLoading = computed(() => this.loadingSignal());

  register(data: RegisterRequest): Observable<AuthResponse> {
    this.loadingSignal.set(true);
    return this.api.post<AuthResponse>('/auth/register', data).pipe(
      tap(response => this.handleAuthSuccess(response)),
      tap(() => this.loadingSignal.set(false)),
      catchError(error => {
        this.loadingSignal.set(false);
        throw error;
      })
    );
  }

  login(data: LoginRequest): Observable<AuthResponse> {
    this.loadingSignal.set(true);
    return this.api.post<AuthResponse>('/auth/login', data).pipe(
      tap(response => this.handleAuthSuccess(response)),
      tap(() => this.loadingSignal.set(false)),
      catchError(error => {
        this.loadingSignal.set(false);
        throw error;
      })
    );
  }

  logout(): Observable<any> {
    return this.api.post('/auth/logout', {}).pipe(
      tap(() => this.clearAuth()),
      catchError(() => {
        this.clearAuth();
        return of(null);
      })
    );
  }

  getCurrentUser(): Observable<{ user: User }> {
    return this.api.get<{ user: User }>('/auth/user').pipe(
      tap(response => {
        this.userSignal.set(response.user);
        this.storeUser(response.user);
      })
    );
  }

  checkAuth(): Observable<boolean> {
    if (!this.tokenSignal()) {
      return of(false);
    }

    return new Observable<boolean>(subscriber => {
      this.getCurrentUser().subscribe({
        next: () => {
          subscriber.next(true);
          subscriber.complete();
        },
        error: () => {
          this.clearAuth();
          subscriber.next(false);
          subscriber.complete();
        }
      });
    });
  }

  hasRoleInDepartamento(departamentoId: string, roles: string[]): boolean {
    const user = this.userSignal();
    if (!user?.departamentos) return false;

    const depto = user.departamentos.find(d => d.id === departamentoId);
    return depto ? roles.includes(depto.pivot.rol) : false;
  }

  private handleAuthSuccess(response: AuthResponse): void {
    this.tokenSignal.set(response.token);
    this.userSignal.set(response.user);
    this.storeToken(response.token);
    this.storeUser(response.user);
  }

  private clearAuth(): void {
    this.tokenSignal.set(null);
    this.userSignal.set(null);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    this.router.navigate(['/auth/login']);
  }

  private getStoredToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(TOKEN_KEY);
  }

  private getStoredUser(): User | null {
    if (typeof window === 'undefined') return null;
    const user = localStorage.getItem(USER_KEY);
    return user ? JSON.parse(user) : null;
  }

  private storeToken(token: string): void {
    localStorage.setItem(TOKEN_KEY, token);
  }

  private storeUser(user: User): void {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }
}
