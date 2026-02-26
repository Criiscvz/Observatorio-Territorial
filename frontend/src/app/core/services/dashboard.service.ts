import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { VariableMetadato } from '../models';
import { ApiService } from './api.service';
import {
  BivariableRequest,
  BivariableResponse,
  DatasetDataResponse,
  TextAnalysisRequest,
  TextAnalysisResponse,
  UnivariableRequest,
  UnivariableResponse,
} from './interfaces';

@Injectable({
  providedIn: 'root',
})
export class DashboardService {
  private readonly api = inject(ApiService);

  getUnivariableStats(request: UnivariableRequest): Observable<UnivariableResponse> {
    return this.api.post<UnivariableResponse>('/stats/univariable', request).pipe(
      map((res) => ({
        ...res,
        // Normalizar: convertir categories a labels si existe
        data: {
          ...res.data,
          labels: res.data.labels || res.data.categories || [],
          values: res.data.values || [],
        },
      })),
    );
  }

  getBivariableStats(request: BivariableRequest): Observable<BivariableResponse> {
    return this.api.post<BivariableResponse>('/stats/bivariable', request).pipe(
      map((res) => ({
        ...res,
        // Añadir aliases para compatibilidad
        variable_x: res.nombre_variable_x || res.variable_x,
        variable_y: res.nombre_variable_y || res.variable_y,
        data: {
          ...res.data,
          // Normalizar: categories -> labels
          labels: res.data.labels || res.data.categories || [],
          labels_x: res.data.labels_x || res.data.categories || [],
        },
      })),
    );
  }

  getDatasetData(
    datasetId: string,
    page: number = 1,
    perPage: number = 50,
  ): Observable<DatasetDataResponse> {
    return this.api.get<DatasetDataResponse>(`/datasets/${datasetId}/data`, {
      page,
      per_page: perPage,
    });
  }

  updateVariable(
    variableId: string,
    data: Partial<VariableMetadato>,
  ): Observable<VariableMetadato> {
    return this.api.put<VariableMetadato>(`/variables/${variableId}`, data);
  }

  // =========== MÉTODOS PÚBLICOS (sin auth) ===========

  getPublicDatasetData(
    datasetId: string,
    page: number = 1,
    perPage: number = 50,
  ): Observable<DatasetDataResponse> {
    return this.api.get<DatasetDataResponse>(`/publico/datasets/${datasetId}/data`, {
      page,
      per_page: perPage,
    });
  }

  getPublicUnivariableStats(request: UnivariableRequest): Observable<UnivariableResponse> {
    return this.api.post<UnivariableResponse>('/publico/stats/univariable', request).pipe(
      map((res) => ({
        ...res,
        data: {
          ...res.data,
          labels: res.data.labels || res.data.categories || [],
          values: res.data.values || [],
        },
      })),
    );
  }

  getPublicBivariableStats(request: BivariableRequest): Observable<BivariableResponse> {
    return this.api.post<BivariableResponse>('/publico/stats/bivariable', request).pipe(
      map((res) => ({
        ...res,
        variable_x: res.nombre_variable_x || res.variable_x,
        variable_y: res.nombre_variable_y || res.variable_y,
        data: {
          ...res.data,
          labels: res.data.labels || res.data.categories || [],
          labels_x: res.data.labels_x || res.data.categories || [],
        },
      })),
    );
  }

  // =========== TEXT ANALYSIS (NLP) ===========

  getTextAnalysis(request: TextAnalysisRequest): Observable<TextAnalysisResponse> {
    return this.api.post<TextAnalysisResponse>('/stats/text-analysis', request);
  }

  getPublicTextAnalysis(request: TextAnalysisRequest): Observable<TextAnalysisResponse> {
    return this.api.post<TextAnalysisResponse>('/publico/stats/text-analysis', request);
  }

  // =========== CUSTOM STOPWORDS ===========

  getDatasetStopwords(datasetId: string): Observable<{ stopwords: string[]; count: number }> {
    return this.api.get<{ stopwords: string[]; count: number }>(
      `/stats/datasets/${datasetId}/stopwords`,
    );
  }

  updateDatasetStopwords(
    datasetId: string,
    stopwords: string[],
  ): Observable<{ stopwords: string[]; count: number }> {
    return this.api.put<{ stopwords: string[]; count: number }>(
      `/stats/datasets/${datasetId}/stopwords`,
      { stopwords },
    );
  }
}
