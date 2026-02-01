import { Dataset } from './dataset.interface';

export interface Departamento {
  id: string;
  nombre: string;
  codigo_interno: string;
  descripcion?: string;
  icono?: string;
  publico: boolean;
  created_at: string;
  updated_at: string;
  datasets?: Dataset[];
  datasets_count?: number;
}
