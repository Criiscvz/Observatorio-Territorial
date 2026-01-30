import { Injectable, inject } from '@angular/core';
import { Observable, tap, map } from 'rxjs';
import { AuthRepository } from '../../domain/repositories';
import { AuthResponse, LoginCredentials, RegisterData, UserEntity } from '../../domain/entities';
import { ApiDatasource } from '../datasources/remote/api.datasource';
import { StorageDatasource } from '../datasources/local/storage.datasource';

const TOKEN_KEY = 'auth_token';

@Injectable({ providedIn: 'root' })
export class AuthRepositoryImpl extends AuthRepository {
  private readonly api = inject(ApiDatasource);
  private readonly storage = inject(StorageDatasource);

  login(credentials: LoginCredentials): Observable<AuthResponse> {
    return this.api.post<AuthResponse>('/login', credentials).pipe(
      tap(response => this.setToken(response.token))
    );
  }

  register(data: RegisterData): Observable<AuthResponse> {
    return this.api.post<AuthResponse>('/register', data).pipe(
      tap(response => this.setToken(response.token))
    );
  }

  logout(): Observable<void> {
    return this.api.post<void>('/logout', {}).pipe(
      tap(() => this.clearToken())
    );
  }

  getCurrentUser(): Observable<UserEntity> {
    return this.api.get<UserEntity>('/user');
  }

  isAuthenticated(): boolean {
    return !!this.getToken();
  }

  getToken(): string | null {
    return this.storage.get(TOKEN_KEY);
  }

  setToken(token: string): void {
    this.storage.set(TOKEN_KEY, token);
  }

  clearToken(): void {
    this.storage.remove(TOKEN_KEY);
  }
}
