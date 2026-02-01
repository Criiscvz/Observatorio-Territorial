import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiService } from './api.service';
import { VariableMetadato } from '../models';

export interface DatasetDataResponse {
  dataset: {
    id: string;
    nombre: string;
    total_registros: number;
    departamento_id?: string;
  };
  variables: VariableMetadato[];
  data: { id: number; data: Record<string, any> }[];
  pagination: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
}

export interface UnivariableRequest {
  dataset_id: string;
  variable_id: string;
  chart_type?: string;
  limit?: number;
}

export interface UnivariableResponse {
  variable_id: string;
  nombre_variable: string;
  tipo_variable: string;
  chart_type: string;
  data: {
    labels?: string[];
    values?: number[];
    categories?: string[];
  };
  stats?: {
    count?: number;
    mean?: number;
    min?: number;
    max?: number;
    sum?: number;
    median?: number;
    unique?: number;
  };
}

export interface BivariableRequest {
  dataset_id: string;
  variable_x_id: string;
  variable_y_id: string;
  chart_type?: string;
  limit?: number;
}

export interface BivariableSeries {
  name: string;
  data: number[];
}

export interface BivariableResponse {
  variable_x_id: string;
  variable_y_id: string;
  nombre_variable_x: string;
  nombre_variable_y: string;
  variable_x: string;
  variable_y: string;
  chart_type: string;
  data: {
    labels?: string[];
    labels_x?: string[];
    labels_y?: string[];
    categories?: string[];
    values?: number[];
    points?: [number, number][];
    counts?: number[];
    series?: BivariableSeries[];
    heatmap?: [number, number, number][];
    correlation?: number;
    stats?: {
      count?: number;
    };
  };
  stats?: {
    correlation?: number;
    count?: number;
  };
}

@Injectable({
  providedIn: 'root'
})
export class DashboardService {
  private api = inject(ApiService);

  getUnivariableStats(request: UnivariableRequest): Observable<UnivariableResponse> {
    return this.api.post<UnivariableResponse>('/stats/univariable', request).pipe(
      map(res => ({
        ...res,
        // Normalizar: convertir categories a labels si existe
        data: {
          ...res.data,
          labels: res.data.labels || res.data.categories || [],
          values: res.data.values || []
        }
      }))
    );
  }

  getBivariableStats(request: BivariableRequest): Observable<BivariableResponse> {
    return this.api.post<BivariableResponse>('/stats/bivariable', request).pipe(
      map(res => ({
        ...res,
        // Añadir aliases para compatibilidad
        variable_x: res.nombre_variable_x || res.variable_x,
        variable_y: res.nombre_variable_y || res.variable_y,
        data: {
          ...res.data,
          // Normalizar: categories -> labels
          labels: res.data.labels || res.data.categories || [],
          labels_x: res.data.labels_x || res.data.categories || [],
        }
      }))
    );
  }

  getDatasetData(datasetId: string, page: number = 1, perPage: number = 50): Observable<DatasetDataResponse> {
    return this.api.get<DatasetDataResponse>(`/datasets/${datasetId}/data`, { page, per_page: perPage });
  }

  updateVariable(variableId: string, data: Partial<VariableMetadato>): Observable<VariableMetadato> {
    return this.api.put<VariableMetadato>(`/variables/${variableId}`, data);
  }

  // =========== MÉTODOS PÚBLICOS (sin auth) ===========

  getPublicDatasetData(datasetId: string, page: number = 1, perPage: number = 50): Observable<DatasetDataResponse> {
    return this.api.get<DatasetDataResponse>(`/publico/datasets/${datasetId}/data`, { page, per_page: perPage });
  }

  getPublicUnivariableStats(request: UnivariableRequest): Observable<UnivariableResponse> {
    return this.api.post<UnivariableResponse>('/publico/stats/univariable', request).pipe(
      map(res => ({
        ...res,
        data: {
          ...res.data,
          labels: res.data.labels || res.data.categories || [],
          values: res.data.values || []
        }
      }))
    );
  }

  getPublicBivariableStats(request: BivariableRequest): Observable<BivariableResponse> {
    return this.api.post<BivariableResponse>('/publico/stats/bivariable', request).pipe(
      map(res => ({
        ...res,
        variable_x: res.nombre_variable_x || res.variable_x,
        variable_y: res.nombre_variable_y || res.variable_y,
        data: {
          ...res.data,
          labels: res.data.labels || res.data.categories || [],
          labels_x: res.data.labels_x || res.data.categories || [],
        }
      }))
    );
  }
}
