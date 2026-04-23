import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { AuthRepository } from '../../repositories';
import { AuthResponse, RegisterData } from '../../entities';

@Injectable({ providedIn: 'root' })
export class RegisterUseCase {
  private readonly authRepository = inject(AuthRepository);

  execute(data: RegisterData): Observable<AuthResponse> {
    return this.authRepository.register(data);
  }
}
