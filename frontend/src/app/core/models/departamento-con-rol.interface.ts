import { DepartamentoRole } from './departamento-role.type';

export interface DepartamentoConRol {
  id: string;
  nombre: string;
  codigo_interno: string;
  descripcion?: string;
  publico?: boolean;
  rol: DepartamentoRole; // Rol del usuario en este departamento
}
