import { Injectable, inject } from '@angular/core';
import { map, Subject, tap } from 'rxjs';
import { ApiService } from './api.service';

export interface AtlasCategoria {
  id: string;
  nombre: string;
  descripcion: string | null;
}

@Injectable({ providedIn: 'root' })
export class AtlasCategoriaService {
  private readonly changed = new Subject<void>();
  readonly onCategoriasChanged$ = this.changed.asObservable();
  private readonly api = inject(ApiService);
  list(publico = false) {
    return this.api.get<{ data: AtlasCategoria[] }>(publico ? '/publico/atlas/categorias' : '/atlas/categorias')
      .pipe(map(response => response.data));
  }
  save(data: { nombre: string; descripcion: string | null }, id?: string) {
    const request = id
      ? this.api.put<{ data: AtlasCategoria; message: string }>(`/atlas/categorias/${id}`, data)
      : this.api.post<{ data: AtlasCategoria; message: string }>('/atlas/categorias', data);
    return request.pipe(tap(() => this.changed.next()));
  }
  delete(id: string) {
    return this.api.delete<{ message: string }>(`/atlas/categorias/${id}`).pipe(tap(() => this.changed.next()));
  }
}
