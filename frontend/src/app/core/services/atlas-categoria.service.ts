import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';
import { ApiService } from './api.service';

export interface AtlasCategoria {
  id: string;
  nombre: string;
  descripcion: string | null;
}

@Injectable({ providedIn: 'root' })
export class AtlasCategoriaService {
  private readonly api = inject(ApiService);
  list(publico = false) {
    return this.api.get<{ data: AtlasCategoria[] }>(publico ? '/publico/atlas/categorias' : '/atlas/categorias')
      .pipe(map(response => response.data));
  }
  save(data: { nombre: string; descripcion: string | null }, id?: string) {
    return id
      ? this.api.put<{ data: AtlasCategoria; message: string }>(`/atlas/categorias/${id}`, data)
      : this.api.post<{ data: AtlasCategoria; message: string }>('/atlas/categorias', data);
  }
  delete(id: string) {
    return this.api.delete<{ message: string }>(`/atlas/categorias/${id}`);
  }
}
