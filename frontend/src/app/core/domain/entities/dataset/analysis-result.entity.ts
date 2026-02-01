import { ColumnConfig } from './column-config.entity';

export interface AnalysisResult {
  dataset_id: string;
  nombre_archivo: string;
  total_filas: number;
  total_columnas: number;
  columnas: ColumnConfig[];
  muestra: Record<string, unknown>[];
}
