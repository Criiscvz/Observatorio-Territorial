import { Observable } from 'rxjs';
import { AuthResponse, LoginCredentials, RegisterData, UserEntity } from '../entities';

export abstract class AuthRepository {
  abstract login(credentials: LoginCredentials): Observable<AuthResponse>;
  abstract register(data: RegisterData): Observable<AuthResponse>;
  abstract logout(): Observable<void>;
  abstract getCurrentUser(): Observable<UserEntity>;
  abstract isAuthenticated(): boolean;
  abstract getToken(): string | null;
  abstract setToken(token: string): void;
  abstract clearToken(): void;
}
