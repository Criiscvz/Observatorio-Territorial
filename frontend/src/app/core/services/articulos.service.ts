import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiService } from './api.service';

/** Estructura real que devuelve GET /api/articulos */
export interface Articulo {
  id: string;
  titulo: string;
  descripcion?: string | null;
  autor?: string | null;
  fuente?: string | null;
  estado?: string | null;
  enlace?: string | null;
  fecha_publicacion?: string | null;
  fecha_recepcion?: string | null;
  categoria_id?: string | null;
  departamento_id?: string | null;
  visibilidad?: string;
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
export class ArticulosService {
  private readonly api = inject(ApiService);

  /**
   * Retorna todos los artículos, opcionalmente filtrados por departamento.
   */
  getAll(departamentoId?: string): Observable<Articulo[]> {
    const params: Record<string, string> = {};
    if (departamentoId) {
      params['departamento_id'] = departamentoId;
    }
    return this.api.get<Articulo[]>('/articulos', params);
  }

  /**
   * Retorna artículos agrupados por categoría.
   */
  agruparPorCategoria(articulos: Articulo[]): { categoria: string; color: string; items: Articulo[] }[] {
    const mapa = new Map<string, { color: string; items: Articulo[] }>();
    for (const art of articulos) {
      const key = art.categoria?.nombre ?? 'Sin categoría';
      const color = art.categoria?.color ?? '#6366F1';
      if (!mapa.has(key)) {
        mapa.set(key, { color, items: [] });
      }
      mapa.get(key)!.items.push(art);
    }
    return Array.from(mapa.entries()).map(([categoria, { color, items }]) => ({
      categoria,
      color,
      items,
    }));
  }
}
