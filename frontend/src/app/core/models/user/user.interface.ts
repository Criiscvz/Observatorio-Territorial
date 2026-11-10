import { DepartamentoConRol } from './departamento-con-rol.interface';
import { Perfil } from './perfil.interface';
import { UserRole } from './user-role.type';

export interface AccessCapabilities {
  can_view_access: boolean;
  can_manage_access: boolean;
  can_assign_editors: boolean;
  can_revoke_access: boolean;
}

export interface User {
  access_capabilities?: AccessCapabilities;
  id: number;
  name: string;
  email: string;
  rol: UserRole;
  is_active?: boolean;
  email_verified_at?: string;
  created_at?: string;
  updated_at?: string;
  perfil?: Perfil | null;
  departamentos?: DepartamentoConRol[];
  intereses?: { id: string; nombre: string }[];
}
