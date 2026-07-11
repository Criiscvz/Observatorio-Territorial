import { Injectable, inject } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { PermisosApiService } from './permisos-api.service';
import {
  ModuloPermiso,
  NivelPermiso,
  PermisoConfig,
  SavePermisosResponse,
} from '../models/permisos';

const STORAGE_KEY = 'observatorio_frontend_permisos';

/**
 * Servicio unificado de permisos.
 *
 * El backend persiste todos los módulos del catálogo en la tabla permisos.
 * El módulo observatorios además sincroniza la tabla operativa usuario_departamento.
 */
@Injectable({
  providedIn: 'root',
})
export class PermisosService {
  private readonly permisosApi = inject(PermisosApiService);

  private cache = new Map<number, PermisoConfig[]>();

  getUserPermisos(userId: number): PermisoConfig[] {
    const cached = this.cache.get(userId);
    if (cached) return cached;

    const stored = localStorage.getItem(`${STORAGE_KEY}_${userId}`);
    const fromStorage: PermisoConfig[] = stored ? JSON.parse(stored) : [];
    this.cache.set(userId, fromStorage);
    return fromStorage;
  }

  getNivel(userId: number, modulo: ModuloPermiso, departamentoId?: string | null): NivelPermiso {
    const permisos = this.getUserPermisos(userId);

    if (departamentoId !== undefined) {
      const match = permisos.find(
        (p) => p.modulo === modulo && p.departamento_id === departamentoId,
      );
      if (match) return match.nivel;
    }

    const generic = permisos.find(
      (p) => p.modulo === modulo && p.departamento_id === undefined,
    );
    if (generic) return generic.nivel;

    const all = permisos.find(
      (p) => p.modulo === modulo && p.departamento_id === null,
    );
    if (all) return all.nivel;

    const scoped = permisos
      .filter((p) => p.modulo === modulo)
      .sort((a, b) => this.nivelWeight(b.nivel) - this.nivelWeight(a.nivel));
    if (scoped.length > 0) return scoped[0].nivel;

    return 'ninguno';
  }

  hasMinNivel(
    userId: number,
    modulo: ModuloPermiso,
    minNivel: NivelPermiso,
    departamentoId?: string | null,
  ): boolean {
    const nivel = this.getNivel(userId, modulo, departamentoId);
    return this.nivelWeight(nivel) >= this.nivelWeight(minNivel);
  }

  puedeVer(userId: number, modulo: ModuloPermiso, departamentoId?: string | null): boolean {
    return this.hasMinNivel(userId, modulo, 'lectura', departamentoId);
  }

  puedeEditar(userId: number, modulo: ModuloPermiso, departamentoId?: string | null): boolean {
    return this.hasMinNivel(userId, modulo, 'escritura', departamentoId);
  }

  esAdmin(userId: number, modulo: ModuloPermiso, departamentoId?: string | null): boolean {
    return this.hasMinNivel(userId, modulo, 'admin', departamentoId);
  }

  saveUserPermisos(userId: number, permisos: PermisoConfig[]): Observable<SavePermisosResponse> {
    return this.permisosApi.saveUserPermisos(userId, permisos).pipe(
      tap((response) => {
        this.cache.set(userId, response.permisos);
        localStorage.setItem(`${STORAGE_KEY}_${userId}`, JSON.stringify(response.permisos));
      }),
    );
  }

  syncFromBackend(userId: number): Observable<PermisoConfig[]> {
    return this.permisosApi.getUserPermisos(userId).pipe(
      tap((backendPermisos) => {
        this.cache.set(userId, backendPermisos);
        localStorage.setItem(`${STORAGE_KEY}_${userId}`, JSON.stringify(backendPermisos));
      }),
    );
  }

  private nivelWeight(nivel: NivelPermiso): number {
    const weights: Record<NivelPermiso, number> = {
      ninguno: 0,
      lectura: 1,
      escritura: 2,
      admin: 3,
    };
    return weights[nivel] ?? 0;
  }
}
