import { Injectable, inject } from '@angular/core';
import { Observable, of, tap } from 'rxjs';
import { PermisosApiService } from './permisos-api.service';
import {
  ModuloPermiso,
  NivelPermiso,
  PermisoConfig,
  SavePermisosResponse,
  MODULOS_PERMISO,
  NIVEL_LABELS,
} from '../models/permisos';

const STORAGE_KEY = 'observatorio_frontend_permisos';

/**
 * Servicio unificado de permisos.
 *
 * - Atlas y Reportes: se gestionan solo en frontend (localStorage)
 *   porque el backend aún no implementa esos módulos.
 * - Observatorios: se sincronizan con el backend.
 *
 * El servicio mantiene un mapa interno userId -> lista de PermisoConfig.
 */
@Injectable({
  providedIn: 'root',
})
export class PermisosService {
  private readonly permisosApi = inject(PermisosApiService);

  /** Mapa interno: userId → PermisoConfig[] */
  private cache = new Map<number, PermisoConfig[]>();

  // ───────────────────────────────
  //  Lectura
  // ───────────────────────────────

  /**
   * Obtiene los permisos de un usuario.
   * Para observatorios se usa backend, para atlas/reportes se usa localStorage.
   */
  getUserPermisos(userId: number): PermisoConfig[] {
    const cached = this.cache.get(userId);
    if (cached) return cached;

    const stored = localStorage.getItem(`${STORAGE_KEY}_${userId}`);
    const fromStorage: PermisoConfig[] = stored ? JSON.parse(stored) : [];

    // Combinar con permisos de backend (observatorios)
    const combined = this.mergeWithBackendDefaults(fromStorage);
    this.cache.set(userId, combined);
    return combined;
  }

  /**
   * Obtiene el nivel de permiso para un módulo y usuario específicos.
   */
  getNivel(userId: number, modulo: ModuloPermiso, departamentoId?: string | null): NivelPermiso {
    const permisos = this.getUserPermisos(userId);

    // Buscar coincidencia exacta (con departamento_id)
    if (departamentoId !== undefined) {
      const match = permisos.find(
        (p) => p.modulo === modulo && p.departamento_id === departamentoId
      );
      if (match) return match.nivel;
    }

    // Buscar permiso genérico (sin departamento_id)
    const generic = permisos.find(
      (p) => p.modulo === modulo && p.departamento_id === undefined
    );
    if (generic) return generic.nivel;

    // Buscar "todos" para observatorios/departamentos
    const all = permisos.find(
      (p) => p.modulo === modulo && p.departamento_id === null
    );
    if (all) return all.nivel;

    const scoped = permisos
      .filter((p) => p.modulo === modulo)
      .sort((a, b) => this.nivelWeight(b.nivel) - this.nivelWeight(a.nivel));
    if (scoped.length > 0) return scoped[0].nivel;

    return 'ninguno';
  }

  /**
   * Verifica si un usuario tiene un nivel mínimo de permiso.
   */
  hasMinNivel(userId: number, modulo: ModuloPermiso, minNivel: NivelPermiso, departamentoId?: string | null): boolean {
    const nivel = this.getNivel(userId, modulo, departamentoId);
    return this.nivelWeight(nivel) >= this.nivelWeight(minNivel);
  }

  /**
   * Verifica si un usuario puede ver cierto módulo (tiene lectura+).
   */
  puedeVer(userId: number, modulo: ModuloPermiso, departamentoId?: string | null): boolean {
    return this.hasMinNivel(userId, modulo, 'lectura', departamentoId);
  }

  /**
   * Verifica si un usuario puede editar cierto módulo (tiene escritura+).
   */
  puedeEditar(userId: number, modulo: ModuloPermiso, departamentoId?: string | null): boolean {
    return this.hasMinNivel(userId, modulo, 'escritura', departamentoId);
  }

  /**
   * Verifica si un usuario es admin de cierto módulo.
   */
  esAdmin(userId: number, modulo: ModuloPermiso, departamentoId?: string | null): boolean {
    return this.hasMinNivel(userId, modulo, 'admin', departamentoId);
  }

  // ───────────────────────────────
  //  Escritura
  // ───────────────────────────────

  /**
   * Guarda los permisos de un usuario.
   * Para observatorios se envía al backend; para atlas/reportes se guarda en localStorage.
   */
  saveUserPermisos(userId: number, permisos: PermisoConfig[]): Observable<SavePermisosResponse> {
    // Separar observatorios del resto
    const observatorioPermisos = permisos.filter((p) => p.modulo === 'observatorios');
    const frontendPermisos = permisos.filter((p) => p.modulo !== 'observatorios');

    // Guardar atlas/reportes en localStorage
    localStorage.setItem(`${STORAGE_KEY}_${userId}`, JSON.stringify(frontendPermisos));

    if (observatorioPermisos.length === 0) {
      this.cache.set(userId, permisos);
      return of({
        message: 'Permisos guardados localmente.',
        permisos,
      });
    }

    return this.permisosApi.saveUserPermisos(userId, observatorioPermisos).pipe(
      tap((response) => {
        const merged = [
          ...frontendPermisos,
          ...response.permisos.filter((p) => p.modulo === 'observatorios'),
        ];
        this.cache.set(userId, merged);
      }),
    );
  }

  /**
   * Carga permisos de observatorios desde el backend y los fusiona con los locales.
   */
  syncFromBackend(userId: number): Observable<PermisoConfig[]> {
    return this.permisosApi.getUserPermisos(userId).pipe(
      tap((backendPermisos) => {
        const stored = localStorage.getItem(`${STORAGE_KEY}_${userId}`);
        const frontendPermisos: PermisoConfig[] = stored ? JSON.parse(stored) : [];

        // Fusionar: backend (observatorios) + frontend (atlas/reportes)
        const merged = [
          ...frontendPermisos.filter((p) => p.modulo !== 'observatorios'),
          ...backendPermisos,
        ];

        this.cache.set(userId, merged);
      }),
    );
  }

  // ───────────────────────────────
  //  Internos
  // ───────────────────────────────

  private mergeWithBackendDefaults(fromStorage: PermisoConfig[]): PermisoConfig[] {
    // Por ahora, devolvemos lo que hay en storage.
    // Cuando se carguen desde backend, se fusionan.
    return fromStorage;
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
