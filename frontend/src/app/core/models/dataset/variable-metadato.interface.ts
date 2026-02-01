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
