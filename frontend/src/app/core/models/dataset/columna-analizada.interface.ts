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
