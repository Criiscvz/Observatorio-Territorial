import { Injectable, inject } from '@angular/core';
import { ApiService } from './api.service';

export const BAROMETRO_SECTIONS = [
  {code: 'investigacion', name: 'Resultados Investigación ULEAM', icon: 'science', description: 'Consulta los reportes de investigación de la ULEAM.'},
  {code: 'vinculacion', name: 'Resultados Vinculación ULEAM', icon: 'handshake', description: 'Consulta los resultados de vinculación de la ULEAM.'},
  {code: 'barometro', name: 'Barómetro ULEAM', icon: 'speed', description: 'Consulta los indicadores y reportes del Barómetro institucional.'},
] as const;

export type BarometroSection = typeof BAROMETRO_SECTIONS[number]['code'];
export type BarometroState = 'EN_REVISION' | 'PUBLICACION' | 'ARCHIVADO';

export interface BarometroPublicationInput {
  titulo: string;
  fecha_publicacion: string;
  fuente: string;
  descripcion: string;
  link_url: string;
  estado: BarometroState;
}

export interface BarometroPublication extends Omit<BarometroPublicationInput, 'fuente' | 'descripcion'> {
  id: number;
  seccion: BarometroSection;
  fuente: string | null;
  descripcion: string | null;
}

export interface BarometroPage {
  data: BarometroPublication[];
  meta: {total: number; current_page: number; last_page: number; per_page: number};
}

@Injectable({providedIn: 'root'})
export class BarometroService {
  private readonly api = inject(ApiService);

  published(section: BarometroSection, page: number, q: string) {
    return this.api.get<BarometroPage>(`/publico/barometro/${section}/publicaciones`, {page, q});
  }

  counts() {
    return this.api.get<{data: Partial<Record<BarometroSection, number>>}>('/admin/barometro/secciones');
  }

  list(section: BarometroSection, page: number, q: string, estado: BarometroState | '') {
    return this.api.get<BarometroPage>(`/admin/barometro/${section}/publicaciones`, {page, q, estado: estado || undefined});
  }

  save(section: BarometroSection, publication: BarometroPublicationInput, id?: number) {
    const path = `/admin/barometro/${section}/publicaciones`;
    return id === undefined
      ? this.api.post<{data: BarometroPublication}>(path, publication)
      : this.api.patch<{data: BarometroPublication}>(`${path}/${id}`, publication);
  }
}
