import { ModuloPermiso, NivelPermiso } from './modulo-permiso.type';

/**
 * Configuración de permiso para un módulo específico.
 */
export interface PermisoConfig {
  id?: string;
  user_id?: number;
  modulo: ModuloPermiso;
  nivel: NivelPermiso;
  /** Solo aplica para el módulo 'observatorios':
   *  - string = departamento específico
   *  - null = todos los departamentos */
  departamento_id?: string | null;
}

/**
 * Representación UI de un módulo con su permiso.
 */
export interface ModuloPermisoUI {
  modulo: ModuloPermiso;
  label: string;
  icon: string;
  habilitado: boolean;
  nivel: NivelPermiso;
  departamentoId?: string | null;
}

/**
 * Agrupación de permisos por usuario.
 */
export interface UserPermisos {
  userId: number;
  permisos: PermisoConfig[];
}

/**
 * Respuesta al guardar permisos en el backend.
 */
export interface SavePermisosResponse {
  message: string;
  permisos: PermisoConfig[];
}
