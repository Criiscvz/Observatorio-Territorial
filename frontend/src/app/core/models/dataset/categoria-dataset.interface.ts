import { Dataset } from './dataset.interface';
import { VariableMetadato } from './variable-metadato.interface';

export interface CategoriaDataset {
  id: string;
  nombre: string;
  codigo: string;
  descripcion?: string | null;
  icono?: string | null;
  color?: string | null;
  orden: number;
  activo: boolean;
  created_at?: string;
  updated_at?: string;
  datasets?: Dataset[];
  datasets_count?: number;
}

export type DatasetVariableSummary = Pick<
  VariableMetadato,
  'id' | 'nombre_columna' | 'nombre_original' | 'tipo_dato'
>;

/** Public category cards do not receive uploader identities, file paths or dataset options. */
export interface CategoriaDatasetItem {
  id: string;
  departamento_id: string;
  categoria_id: string | null;
  nombre: string;
  descripcion: string | null;
  enlace_fuente: string | null;
  estado: Dataset['estado'];
  total_registros: number;
  fecha_carga: string | null;
  created_at: string | null;
  departamento?: { id: string; nombre: string; icono: string | null };
  variables_metadatos?: DatasetVariableSummary[];
}

export interface CategoriaDatasetsResponse {
  categoria: CategoriaDataset;
  datasets: CategoriaDatasetItem[];
}

export interface DatasetFuente {
  id: string;
  dataset_id: string;
  titulo: string;
  url: string;
  descripcion?: string | null;
  orden: number;
  created_at?: string;
  updated_at?: string;
}

export interface GraficoPredeterminado {
  id: string;
  dataset_id: string;
  titulo: string;
  descripcion?: string | null;
  analisis?: string | null;
  tipo_grafico: string;
  tipo_analisis: 'univariable' | 'bivariable';
  variable_x_id: string;
  variable_y_id?: string | null;
  filtros?: Record<string, unknown>[] | null;
  configuracion?: Record<string, unknown> | null;
  orden: number;
  activo: boolean;
  creado_por?: string;
  created_at?: string;
  updated_at?: string;
  variable_x?: DatasetVariableSummary | null;
  variable_y?: DatasetVariableSummary | null;
}
