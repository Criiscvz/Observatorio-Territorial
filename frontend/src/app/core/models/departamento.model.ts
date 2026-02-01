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

export interface Dataset {
  id: string;
  departamento_id: string;
  subido_por: number;
  nombre: string;
  nombre_archivo: string;
  descripcion?: string;
  estado: 'PENDIENTE' | 'PROCESANDO' | 'COMPLETADO' | 'ERROR';
  total_registros: number;
  fecha_carga: string;
  created_at: string;
  updated_at: string;
  variables_metadatos?: VariableMetadato[];
  variables?: VariableMetadato[]; // Alias para variables_metadatos usado en vistas públicas
  departamento?: Departamento;
}

export interface VariableMetadato {
  id: string;
  dataset_id: string;
  nombre_columna: string;
  nombre_original: string;
  tipo_dato: 'NUMERICO' | 'CATEGORICO' | 'FECHA' | 'TEXTO';
  tipo_detectado: 'NUMERICO' | 'CATEGORICO' | 'FECHA' | 'TEXTO';
  es_visible: boolean;
  orden: number;
  opciones?: string[];
}

export interface RegistroDato {
  id: number;
  dataset_id: string;
  data: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface ColumnaAnalizada {
  nombre_columna: string;
  nombre_original: string;
  tipo_detectado: string;
  tipo_dato: string;
  es_visible: boolean;
  orden: number;
  opciones?: string[];
  muestra_valores?: any[];
}

export interface AnalisisResponse {
  message: string;
  columnas: ColumnaAnalizada[];
  preview: Record<string, any>[];
  total_filas: number;
}
