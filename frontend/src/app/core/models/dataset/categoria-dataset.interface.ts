import { Dataset } from './dataset.interface';

export interface CategoriaDataset {
  id: string;
  nombre: string;
  codigo: string;
  descripcion?: string;
  icono?: string;
  color?: string;
  orden: number;
  activo: boolean;
  created_at: string;
  updated_at: string;
  datasets?: Dataset[];
  datasets_count?: number;
}

export interface DatasetFuente {
  id: string;
  dataset_id: string;
  titulo: string;
  url: string;
  descripcion?: string;
  orden: number;
  created_at: string;
  updated_at: string;
}

export interface GraficoPredeterminado {
  id: string;
  dataset_id: string;
  titulo: string;
  descripcion?: string;
  tipo_grafico: string;
  tipo_analisis: 'univariable' | 'bivariable';
  variable_x_id: string;
  variable_y_id?: string;
  filtros?: Record<string, any>[];
  configuracion?: Record<string, any>;
  orden: number;
  activo: boolean;
  creado_por: string;
  created_at: string;
  updated_at: string;
}
