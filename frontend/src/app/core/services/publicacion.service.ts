import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ObservatorioPublicacion } from '../models/publicacion/publicacion.interface';
import { ApiService } from './api.service';

interface ResourceResponse<T> {
  data: T;
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

  download(publicacion: ObservatorioPublicacion): void {
    this.http
      .get(`${this.apiUrl}${publicacion.download_url.replace('/api', '')}`, {
        responseType: 'blob',
      })
      .subscribe((blob) => {
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = publicacion.nombre_archivo_original;
        anchor.click();
        URL.revokeObjectURL(url);
      });
  }
}
