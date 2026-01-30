import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { AuthRepository } from '../../repositories';

@Injectable({ providedIn: 'root' })
export class LogoutUseCase {
  private readonly authRepository = inject(AuthRepository);

  execute(): Observable<void> {
    return this.authRepository.logout();
  }
}
