import { Injectable, inject } from '@angular/core';
import { Observable, Subject, tap } from 'rxjs';
import { Departamento } from '../models';
import { ApiService } from './api.service';

@Injectable({
  providedIn: 'root',
})
export class DepartamentoService {
  private api = inject(ApiService);

  // Subject para notificar cambios en departamentos
  private departamentosChanged = new Subject<void>();

  /** Observable que emite cuando hay cambios en los departamentos */
  readonly onDepartamentosChanged$ = this.departamentosChanged.asObservable();

  getAll(): Observable<Departamento[]> {
    return this.api.get<Departamento[]>('/departamentos');
  }

  getById(id: string): Observable<Departamento> {
    return this.api.get<Departamento>(`/departamentos/${id}`);
  }

  create(data: Partial<Departamento>): Observable<Departamento> {
    return this.api.post<Departamento>('/departamentos', data).pipe(tap(() => this.notifyChange()));
  }

  update(id: string, data: Partial<Departamento>): Observable<Departamento> {
    return this.api
      .put<Departamento>(`/departamentos/${id}`, data)
      .pipe(tap(() => this.notifyChange()));
  }

  delete(id: string): Observable<{ message: string }> {
    return this.api
      .delete<{ message: string }>(`/departamentos/${id}`)
      .pipe(tap(() => this.notifyChange()));
  }

  /** Notifica manualmente que hubo un cambio (útil para otros componentes) */
  notifyChange(): void {
    this.departamentosChanged.next();
  }

  // Público (sin auth)
  getPublicos(): Observable<Departamento[]> {
    return this.api.get<Departamento[]>('/publico/departamentos');
  }

  getPublicById(id: string): Observable<Departamento> {
    return this.api.get<Departamento>(`/publico/departamentos/${id}`);
  }
}
