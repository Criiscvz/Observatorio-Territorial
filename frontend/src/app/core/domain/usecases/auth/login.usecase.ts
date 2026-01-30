import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { AuthRepository } from '../../repositories';
import { AuthResponse, LoginCredentials } from '../../entities';

@Injectable({ providedIn: 'root' })
export class LoginUseCase {
  private readonly authRepository = inject(AuthRepository);

  execute(credentials: LoginCredentials): Observable<AuthResponse> {
    return this.authRepository.login(credentials);
  }
}
