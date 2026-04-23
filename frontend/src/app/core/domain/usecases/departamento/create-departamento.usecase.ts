import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { DepartamentoRepository } from '../../repositories';
import { CreateDepartamentoData, DepartamentoEntity } from '../../entities';

@Injectable({ providedIn: 'root' })
export class CreateDepartamentoUseCase {
  private readonly repository = inject(DepartamentoRepository);

  execute(data: CreateDepartamentoData): Observable<DepartamentoEntity> {
    return this.repository.create(data);
  }
}
