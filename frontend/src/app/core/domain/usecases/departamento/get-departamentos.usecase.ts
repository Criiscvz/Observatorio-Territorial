import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { DepartamentoRepository } from '../../repositories';
import { DepartamentoEntity } from '../../entities';

@Injectable({ providedIn: 'root' })
export class GetDepartamentosUseCase {
  private readonly repository = inject(DepartamentoRepository);

  execute(): Observable<DepartamentoEntity[]> {
    return this.repository.getAll();
  }

  executePublicos(): Observable<DepartamentoEntity[]> {
    return this.repository.getPublicos();
  }
}
