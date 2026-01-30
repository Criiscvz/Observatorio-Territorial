import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { Departamento } from '../models';

@Injectable({
  providedIn: 'root'
})
export class DepartamentoService {
  private api = inject(ApiService);

  getAll(): Observable<Departamento[]> {
    return this.api.get<Departamento[]>('/departamentos');
  }

  getById(id: string): Observable<Departamento> {
    return this.api.get<Departamento>(`/departamentos/${id}`);
  }

  create(data: Partial<Departamento>): Observable<Departamento> {
    return this.api.post<Departamento>('/departamentos', data);
  }

  update(id: string, data: Partial<Departamento>): Observable<Departamento> {
    return this.api.put<Departamento>(`/departamentos/${id}`, data);
  }

  delete(id: string): Observable<{ message: string }> {
    return this.api.delete<{ message: string }>(`/departamentos/${id}`);
  }

  // Público (sin auth)
  getPublicos(): Observable<Departamento[]> {
    return this.api.get<Departamento[]>('/departamentos/publicos');
  }
}
