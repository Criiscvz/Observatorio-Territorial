import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { DepartamentoRepository } from '../../domain/repositories';
import { CreateDepartamentoData, DepartamentoEntity, UpdateDepartamentoData } from '../../domain/entities';
import { ApiDatasource } from '../datasources/remote/api.datasource';

@Injectable({ providedIn: 'root' })
export class DepartamentoRepositoryImpl extends DepartamentoRepository {
  private readonly api = inject(ApiDatasource);

  getAll(): Observable<DepartamentoEntity[]> {
    return this.api.get<DepartamentoEntity[]>('/departamentos');
  }

  getPublicos(): Observable<DepartamentoEntity[]> {
    return this.api.get<DepartamentoEntity[]>('/departamentos/publicos');
  }

  getById(id: string): Observable<DepartamentoEntity> {
    return this.api.get<DepartamentoEntity>(`/departamentos/${id}`);
  }

  create(data: CreateDepartamentoData): Observable<DepartamentoEntity> {
    return this.api.post<DepartamentoEntity>('/departamentos', data);
  }

  update(id: string, data: UpdateDepartamentoData): Observable<DepartamentoEntity> {
    return this.api.put<DepartamentoEntity>(`/departamentos/${id}`, data);
  }

  delete(id: string): Observable<void> {
    return this.api.delete<void>(`/departamentos/${id}`);
  }
}
