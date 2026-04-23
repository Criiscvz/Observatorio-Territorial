import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { DatasetRepository } from '../../domain/repositories';
import { 
  AnalysisResult, 
  ColumnConfig, 
  DatasetDataResponse, 
  DatasetEntity, 
  UploadDatasetData, 
  VariableMetadatoEntity 
} from '../../domain/entities';
import { ApiDatasource } from '../datasources/remote/api.datasource';

@Injectable({ providedIn: 'root' })
export class DatasetRepositoryImpl extends DatasetRepository {
  private readonly api = inject(ApiDatasource);

  getAll(departamentoId?: string): Observable<DatasetEntity[]> {
    const params = departamentoId ? { departamento_id: departamentoId } : undefined;
    return this.api.get<DatasetEntity[]>('/datasets', params);
  }

  getById(id: string): Observable<DatasetEntity> {
    return this.api.get<DatasetEntity>(`/datasets/${id}`);
  }

  upload(data: UploadDatasetData): Observable<DatasetEntity> {
    const formData = new FormData();
    formData.append('departamento_id', data.departamento_id);
    formData.append('nombre', data.nombre);
    formData.append('archivo', data.archivo);
    if (data.descripcion) {
      formData.append('descripcion', data.descripcion);
    }
    return this.api.upload<DatasetEntity>('/datasets', formData);
  }

  analyze(id: string): Observable<AnalysisResult> {
    return this.api.post<AnalysisResult>(`/datasets/${id}/analyze`, {});
  }

  confirmImport(id: string, columnas: ColumnConfig[]): Observable<DatasetEntity> {
    return this.api.post<DatasetEntity>(`/datasets/${id}/import`, { columnas });
  }

  getData(id: string, page?: number, perPage?: number): Observable<DatasetDataResponse> {
    const params: Record<string, number> = {};
    if (page) params['page'] = page;
    if (perPage) params['per_page'] = perPage;
    return this.api.get<DatasetDataResponse>(`/datasets/${id}/data`, params);
  }

  updateVariable(variableId: string, data: Partial<VariableMetadatoEntity>): Observable<VariableMetadatoEntity> {
    return this.api.put<VariableMetadatoEntity>(`/variables/${variableId}`, data);
  }
}
