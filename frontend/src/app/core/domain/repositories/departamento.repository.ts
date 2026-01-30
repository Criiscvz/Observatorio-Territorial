import { Observable } from 'rxjs';
import { CreateDepartamentoData, DepartamentoEntity, UpdateDepartamentoData } from '../entities';

export abstract class DepartamentoRepository {
  abstract getAll(): Observable<DepartamentoEntity[]>;
  abstract getPublicos(): Observable<DepartamentoEntity[]>;
  abstract getById(id: string): Observable<DepartamentoEntity>;
  abstract create(data: CreateDepartamentoData): Observable<DepartamentoEntity>;
  abstract update(id: string, data: UpdateDepartamentoData): Observable<DepartamentoEntity>;
  abstract delete(id: string): Observable<void>;
}
