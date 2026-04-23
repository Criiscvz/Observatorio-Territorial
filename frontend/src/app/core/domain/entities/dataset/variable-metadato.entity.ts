import { TipoDato } from './tipo-dato.type';

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
