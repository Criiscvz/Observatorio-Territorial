import { Injectable, inject } from '@angular/core';
import { CategoriaDataset, Dataset, DatasetFuente, GraficoPredeterminado } from '@core/models';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

@Injectable({
  providedIn: 'root',
})
export class CategoriaService {
  private readonly api = inject(ApiService);

  // ─── Categorías ───

  getCategorias(): Observable<CategoriaDataset[]> {
    return this.api.get<CategoriaDataset[]>('/categorias');
  }

  getCategoriaByCodigo(codigo: string): Observable<CategoriaDataset> {
    return this.api.get<CategoriaDataset>(`/categorias/${codigo}`);
  }

  getDatasetsByCategoria(codigo: string): Observable<Dataset[]> {
    return this.api.get<Dataset[]>(`/categorias/${codigo}/datasets`);
  }

  // ─── Fuentes de Dataset ───

  getFuentes(datasetId: string): Observable<DatasetFuente[]> {
    return this.api.get<DatasetFuente[]>(`/datasets/${datasetId}/fuentes`);
  }

  createFuente(datasetId: string, data: Partial<DatasetFuente>): Observable<DatasetFuente> {
    return this.api.post<DatasetFuente>(`/datasets/${datasetId}/fuentes`, data);
  }

  updateFuente(id: string, data: Partial<DatasetFuente>): Observable<DatasetFuente> {
    return this.api.put<DatasetFuente>(`/fuentes/${id}`, data);
  }

  deleteFuente(id: string): Observable<void> {
    return this.api.delete<void>(`/fuentes/${id}`);
  }

  // ─── Gráficos Predeterminados ───

  getGraficosPredeterminados(datasetId: string): Observable<GraficoPredeterminado[]> {
    return this.api.get<GraficoPredeterminado[]>(`/datasets/${datasetId}/graficos-predeterminados`);
  }

  createGraficoPredeterminado(
    datasetId: string,
    data: Partial<GraficoPredeterminado>,
  ): Observable<GraficoPredeterminado> {
    return this.api.post<GraficoPredeterminado>(
      `/datasets/${datasetId}/graficos-predeterminados`,
      data,
    );
  }

  updateGraficoPredeterminado(
    id: string,
    data: Partial<GraficoPredeterminado>,
  ): Observable<GraficoPredeterminado> {
    return this.api.put<GraficoPredeterminado>(`/graficos-predeterminados/${id}`, data);
  }

  deleteGraficoPredeterminado(id: string): Observable<void> {
    return this.api.delete<void>(`/graficos-predeterminados/${id}`);
  }
}
