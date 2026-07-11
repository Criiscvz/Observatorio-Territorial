import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  ObservatorioPublicacion,
  SharePointFile,
} from '../models/publicacion/publicacion.interface';
import { ApiService } from './api.service';

interface ResourceResponse<T> {
  data: T;
}

type PdfSource = Pick<ObservatorioPublicacion, 'download_url' | 'sharepoint_url'>;

export interface CanUploadPublicacionResponse {
  can_upload: boolean;
  role: string;
  has_permission: boolean;
  departamento_role?: string | null;
}

@Injectable({ providedIn: 'root' })
export class PublicacionService {
  private readonly api = inject(ApiService);
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  getAll(departamentoId: string): Observable<ObservatorioPublicacion[]> {
    return this.api
      .get<ResourceResponse<ObservatorioPublicacion[]>>(
        `/departamentos/${departamentoId}/publicaciones`,
      )
      .pipe(map((response) => response.data));
  }

  getRecentAtlasReports(): Observable<ObservatorioPublicacion[]> {
    return this.api
      .get<ResourceResponse<ObservatorioPublicacion[]>>('/departamentos/publicaciones/atlas/recientes')
      .pipe(map((response) => response.data));
  }

  getPublicAtlas(): Observable<ObservatorioPublicacion[]> {
    return this.api
      .get<ResourceResponse<ObservatorioPublicacion[]>>('/publico/atlas')
      .pipe(map((response) => response.data));
  }

  canUpload(departamentoId: string): Observable<CanUploadPublicacionResponse> {
    return this.api.get<CanUploadPublicacionResponse>(
      `/departamentos/${departamentoId}/publicaciones/can-upload`,
    );
  }

  getAtlasSharePointFiles(departamentoId: string): Observable<SharePointFile[]> {
    return this.api
      .get<ResourceResponse<SharePointFile[]>>(
        `/departamentos/${departamentoId}/publicaciones/atlas/sharepoint/files`,
      )
      .pipe(map((response) => response.data));
  }

  getReporteSharePointFiles(departamentoId: string): Observable<SharePointFile[]> {
    return this.api
      .get<ResourceResponse<SharePointFile[]>>(
        `/departamentos/${departamentoId}/publicaciones/reportes/sharepoint/files`,
      )
      .pipe(map((response) => response.data));
  }

  importSharePointAtlas(
    departamentoId: string,
    sharepointFileId: string,
  ): Observable<ObservatorioPublicacion> {
    return this.api
      .post<ResourceResponse<ObservatorioPublicacion>>(
        `/departamentos/${departamentoId}/publicaciones/atlas/sharepoint/import`,
        { sharepoint_file_id: sharepointFileId },
      )
      .pipe(map((response) => response.data));
  }

  importSharePointReporte(
    departamentoId: string,
    sharepointFileId: string,
  ): Observable<ObservatorioPublicacion> {
    return this.api
      .post<ResourceResponse<ObservatorioPublicacion>>(
        `/departamentos/${departamentoId}/publicaciones/reportes/sharepoint/import`,
        { sharepoint_file_id: sharepointFileId },
      )
      .pipe(map((response) => response.data));
  }

  syncSharePointAtlas(departamentoId: string): Observable<ObservatorioPublicacion[]> {
    return this.api
      .post<ResourceResponse<ObservatorioPublicacion[]>>(
        `/departamentos/${departamentoId}/publicaciones/atlas/sharepoint/sync`,
        {},
      )
      .pipe(map((response) => response.data));
  }

  syncSharePointReportes(departamentoId: string): Observable<ObservatorioPublicacion[]> {
    return this.api
      .post<ResourceResponse<ObservatorioPublicacion[]>>(
        `/departamentos/${departamentoId}/publicaciones/reportes/sharepoint/sync`,
        {},
      )
      .pipe(map((response) => response.data));
  }

  create(departamentoId: string, formData: FormData): Observable<ObservatorioPublicacion> {
    return this.api
      .upload<ResourceResponse<ObservatorioPublicacion>>(
        `/departamentos/${departamentoId}/publicaciones`,
        formData,
      )
      .pipe(map((response) => response.data));
  }

  update(publicacionId: string, formData: FormData): Observable<ObservatorioPublicacion> {
    formData.append('_method', 'PATCH');
    return this.api
      .upload<ResourceResponse<ObservatorioPublicacion>>(
        `/departamentos/publicaciones/${publicacionId}`,
        formData,
      )
      .pipe(map((response) => response.data));
  }

  getPdfUrl(publicacion: PdfSource): string | null {
    if (publicacion.sharepoint_url) {
      return publicacion.sharepoint_url;
    }

    if (!publicacion.download_url) {
      return null;
    }

    if (/^https?:\/\//i.test(publicacion.download_url)) {
      return publicacion.download_url;
    }

    return `${this.apiUrl}${publicacion.download_url.replace('/api', '')}`;
  }

  openPdf(publicacion: PdfSource): Observable<boolean> {
    const pdfUrl = this.getPdfUrl(publicacion);

    if (!pdfUrl) {
      return of(false);
    }

    if (publicacion.sharepoint_url) {
      window.open(pdfUrl, '_blank', 'noopener,noreferrer');
      return of(true);
    }

    return this.http.get(pdfUrl, { responseType: 'blob' }).pipe(
      map((blob) => {
        const objectUrl = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
        window.open(objectUrl, '_blank', 'noopener,noreferrer');
        window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
        return true;
      }),
      catchError(() => of(false)),
    );
  }

  download(publicacion: ObservatorioPublicacion): void {
    this.openPdf(publicacion).subscribe();
  }
}
