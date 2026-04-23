import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { DepartamentoRepository } from '../../repositories';
import { DepartamentoEntity } from '../../entities';

@Injectable({ providedIn: 'root' })
export class GetDepartamentoUseCase {
  private readonly repository = inject(DepartamentoRepository);

  execute(id: string): Observable<DepartamentoEntity> {
    return this.repository.getById(id);
  }
}
