export type ModuloPermiso = 'atlas' | 'reportes' | 'observatorios';

export type NivelPermiso = 'ninguno' | 'lectura' | 'escritura' | 'admin';

export const MODULOS_PERMISO: ModuloPermiso[] = ['atlas', 'reportes', 'observatorios'];
export const NIVELES_PERMISO: NivelPermiso[] = ['ninguno', 'lectura', 'escritura', 'admin'];

export const MODULO_LABELS: Record<ModuloPermiso, string> = {
  atlas: 'Atlas',
  reportes: 'Reportes',
  observatorios: 'Observatorios',
};

export const MODULO_ICONS: Record<ModuloPermiso, string> = {
  atlas: 'public',
  reportes: 'assessment',
  observatorios: 'visibility',
};

export const NIVEL_LABELS: Record<NivelPermiso, string> = {
  ninguno: 'Sin acceso',
  lectura: 'Solo lectura',
  escritura: 'Lectura y escritura',
  admin: 'Control total',
};

export const NIVEL_ICONS: Record<NivelPermiso, string> = {
  ninguno: 'block',
  lectura: 'visibility',
  escritura: 'edit_note',
  admin: 'admin_panel_settings',
};
