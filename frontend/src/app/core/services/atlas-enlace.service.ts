import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';
import { ApiService } from './api.service';
import { ObservatorioPublicacion } from '../models/publicacion/publicacion.interface';
import { AtlasCategoria } from './atlas-categoria.service';

export interface AtlasEnlaceData {
  atlas_categoria_id: string;
  titulo: string;
  fecha_publicacion: string;
  link_url: string;
  fuente: string;
  descripcion: string;
  mostrar_en_portal: boolean;
}
@Injectable({ providedIn: 'root' })
export class AtlasEnlaceService {
  private readonly api = inject(ApiService);
  save(data: AtlasEnlaceData, id?: string) {
    return (id
      ? this.api.patch<{data: ObservatorioPublicacion}>(`/atlas/enlaces/${id}`, data)
      : this.api.post<{data: ObservatorioPublicacion}>(`/atlas/categorias/${data.atlas_categoria_id}/enlaces`, data)
    ).pipe(map(response => response.data));
  }
  select(categoryId: string, publicationId: string) {
    return this.api.put<{data: AtlasCategoria; message: string}>(`/atlas/categorias/${categoryId}/seleccion`, {publicacion_id: publicationId});
  }
}
