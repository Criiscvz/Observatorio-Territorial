import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

/** Estructura real que devuelve GET /api/reportes */
export interface Reporte {
  id: string;
  nombre_indicador: string;
  descripcion_indicador?: string | null;
  fecha_publicacion?: string | null;
  link_url?: string | null;        // URL de PowerBI
  ficha_indicador?: string | null; // URL del archivo PDF/Word
  download_url?: string | null;
  sharepoint_url?: string | null;
  fuente?: string | null;
  categoria_id?: string | null;
  departamento_id?: string | null;
  visibilidad?: string;
  bloqueado?: boolean;
  categoria?: {
    id: string;
    nombre: string;
    codigo: string;
    color?: string | null;
    icono?: string | null;
  } | null;
  created_at?: string;
  updated_at?: string;
}

@Injectable({ providedIn: 'root' })
export class ReportesService {
  private readonly api = inject(ApiService);

  /**
   * Retorna todos los reportes, opcionalmente filtrados por departamento.
   */
  getAll(departamentoId?: string): Observable<Reporte[]> {
    const params: Record<string, string> = {};
    if (departamentoId) {
      params['departamento_id'] = departamentoId;
    }
    return this.api.get<Reporte[]>('/reportes', params);
  }

  /**
   * Retorna reportes agrupados por categoría.
   */
  agruparPorCategoria(reportes: Reporte[]): { categoria: string; color: string; items: Reporte[] }[] {
    const mapa = new Map<string, { color: string; items: Reporte[] }>();
    for (const rep of reportes) {
      const key = rep.categoria?.nombre ?? 'Reportes ULEAM';
      const color = rep.categoria?.color ?? '#6366F1';
      if (!mapa.has(key)) {
        mapa.set(key, { color, items: [] });
      }
      mapa.get(key)!.items.push(rep);
    }
    return Array.from(mapa.entries()).map(([categoria, { color, items }]) => ({
      categoria,
      color,
      items,
    }));
  }
}
