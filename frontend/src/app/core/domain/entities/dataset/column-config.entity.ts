import { TipoDato } from './tipo-dato.type';

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
