import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { Dataset, AnalisisResponse, ColumnaAnalizada } from '../models';
import { PaginatedResponse } from './dataset.interfaces';

// Re-export interfaces for convenience
export * from './dataset.interfaces';

@Injectable({
  providedIn: 'root'
})
export class DatasetService {
  private readonly api = inject(ApiService);

  getAll(departamentoId?: string): Observable<PaginatedResponse<Dataset>> {
    const params = departamentoId ? { departamento_id: departamentoId } : {};
    return this.api.get<PaginatedResponse<Dataset>>('/datasets', params);
  }

  getById(id: string): Observable<Dataset> {
    return this.api.get<Dataset>(`/datasets/${id}`);
  }

  create(departamentoId: string, nombre: string, descripcion: string, archivo: File): Observable<Dataset> {
    const formData = new FormData();
    formData.append('departamento_id', departamentoId);
    formData.append('nombre', nombre);
    formData.append('descripcion', descripcion);
    formData.append('archivo', archivo);

    return this.api.upload<Dataset>('/datasets', formData);
  }

  analizar(datasetId: string): Observable<AnalisisResponse> {
    return this.api.post<AnalisisResponse>(`/datasets/${datasetId}/analyze`, {});
  }

  confirmar(datasetId: string, columnas: ColumnaAnalizada[]): Observable<{ message: string; total_registros: number }> {
    return this.api.post<{ message: string; total_registros: number }>(
      `/datasets/${datasetId}/import`,
      { columnas }
    );
  }

  delete(id: string): Observable<{ message: string }> {
    return this.api.delete<{ message: string }>(`/datasets/${id}`);
  }
}
