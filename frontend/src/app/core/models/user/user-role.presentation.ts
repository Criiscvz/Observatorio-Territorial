import { UserRole } from './user-role.type';

export const USER_ROLE_OPTIONS: ReadonlyArray<{value: UserRole; label: string; icon: string; description: string}> = [
  {value:'ADMIN', label:'Administrador', icon:'verified_user', description:'Control completo de la plataforma.'},
  {value:'ADMIN_OBSERVATORIO', label:'Supervisor', icon:'manage_accounts', description:'Revisa publicaciones y gestiona editores en sus observatorios.'},
  {value:'EDITOR', label:'Editor', icon:'edit_note', description:'Crea artículos, reportes y libros en sus observatorios.'},
  {value:'SUBSCRIBER', label:'Suscriptor', icon:'workspace_premium', description:'Consulta publicaciones exclusivas para suscriptores.'},
  {value:'USER', label:'Usuario', icon:'person_outline', description:'Consulta el contenido público del portal.'},
];

export function userRoleLabel(role: string): string {
  return USER_ROLE_OPTIONS.find(option => option.value === role)?.label ?? 'Usuario';
}

export function userRoleIcon(role: string): string {
  return USER_ROLE_OPTIONS.find(option => option.value === role)?.icon ?? 'person_outline';
}
