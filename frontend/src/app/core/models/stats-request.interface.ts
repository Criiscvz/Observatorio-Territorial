export interface StatsRequest {
  dataset_id: string;
  variable: string;
  tipo_grafico?: 'bar' | 'pie' | 'line' | 'histogram' | 'scatter';
  variable_y?: string;
}
