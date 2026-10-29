import { Injectable, inject, signal } from '@angular/core';
import { Observable, switchMap, tap } from 'rxjs';
import { AuthRepository } from '../../domain/repositories';
import { AuthResponse, LoginCredentials, RegisterData, UserEntity } from '../../domain/entities';
import { ApiDatasource } from '../datasources/remote/api.datasource';

@Injectable({ providedIn: 'root' })
export class AuthRepositoryImpl extends AuthRepository {
  private readonly api = inject(ApiDatasource);
  private readonly authenticated = signal(false);

  login(credentials: LoginCredentials): Observable<AuthResponse> {
    return this.api.getCsrfCookie().pipe(
      switchMap(() => this.api.post<AuthResponse>('/login', credentials)),
      tap(response => this.setSession(response))
    );
  }

  register(data: RegisterData): Observable<AuthResponse> {
    return this.api.getCsrfCookie().pipe(
      switchMap(() => this.api.post<AuthResponse>('/register', data)),
      tap(response => this.setSession(response))
    );
  }

  logout(): Observable<void> {
    return this.api.post<void>('/logout', {}).pipe(
      tap(() => this.clearToken())
    );
  }

  getCurrentUser(): Observable<UserEntity> {
    return this.api.get<UserEntity>('/user').pipe(tap(() => this.authenticated.set(true)));
  }

  isAuthenticated(): boolean {
    return this.authenticated();
  }

  clearToken(): void {
    this.authenticated.set(false);
  }

  private setSession(response: AuthResponse): void {
    this.authenticated.set(!!response.user);
  }
}
