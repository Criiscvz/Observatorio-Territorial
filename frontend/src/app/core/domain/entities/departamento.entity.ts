import { DatasetEntity } from './dataset.entity';

export interface DepartamentoEntity {
  id: string;
  nombre: string;
  codigo_interno: string;
  descripcion?: string;
  icono?: string;
  publico: boolean;
  created_at?: string;
  updated_at?: string;
  datasets?: DatasetEntity[];
  user_role?: string;
}

export interface CreateDepartamentoData {
  nombre: string;
  codigo_interno: string;
  descripcion?: string;
  icono?: string;
  publico?: boolean;
}

export interface UpdateDepartamentoData {
  nombre?: string;
  descripcion?: string;
  icono?: string;
  publico?: boolean;
}
