export interface DatasetEntity {
  id: string;
  departamento_id: string;
  nombre: string;
  nombre_archivo?: string;
  descripcion?: string;
  estado: DatasetEstado;
  total_registros: number;
  fecha_carga?: string;
  created_at?: string;
  updated_at?: string;
  variables_metadatos?: VariableMetadatoEntity[];
}

export type DatasetEstado = 'PENDIENTE' | 'PROCESANDO' | 'COMPLETADO' | 'ERROR';

export interface VariableMetadatoEntity {
  id: string;
  dataset_id: string;
  nombre_columna: string;
  nombre_original: string;
  tipo_dato: TipoDato;
  tipo_detectado: TipoDato;
  es_visible: boolean;
  orden: number;
  opciones?: string[];
}

export type TipoDato = 'NUMERICO' | 'CATEGORICO' | 'FECHA' | 'TEXTO';

export interface AnalysisResult {
  dataset_id: string;
  nombre_archivo: string;
  total_filas: number;
  total_columnas: number;
  columnas: ColumnConfig[];
  muestra: Record<string, unknown>[];
}

export interface ColumnConfig {
  nombre_columna: string;
  nombre_original: string;
  tipo_dato: TipoDato;
  tipo_detectado: TipoDato;
  es_visible: boolean;
  orden: number;
  opciones?: string[];
  muestra_valores?: unknown[];
  excluida?: boolean;
}

export interface UploadDatasetData {
  departamento_id: string;
  nombre: string;
  descripcion?: string;
  archivo: File;
}

export interface DatasetDataResponse {
  dataset: {
    id: string;
    nombre: string;
    total_registros: number;
  };
  data: { id: number; data: Record<string, unknown> }[];
  pagination: {
    current_page: number;
    per_page: number;
    total: number;
    last_page: number;
  };
}
