export interface ChartEntity {
  id: string;
  variable_id: string;
  nombre_variable: string;
  tipo_variable: string;
  chart_type: ChartType;
  data: ChartData;
  stats?: ChartStats;
}

export type ChartType = 
  | 'bar' 
  | 'pie' 
  | 'line' 
  | 'histogram' 
  | 'scatter' 
  | 'donut' 
  | 'area' 
  | 'heatmap' 
  | 'grouped_bar' 
  | 'stacked_bar';

export interface ChartData {
  categories?: string[];
  values?: number[];
  points?: [number, number][];
  series?: Record<string, Record<string, number>>;
  counts?: number[];
}

export interface ChartStats {
  count?: number;
  mean?: number;
  min?: number;
  max?: number;
  sum?: number;
  median?: number;
  std?: number;
  unique?: number;
  correlation?: number;
}

export interface UnivariableRequest {
  dataset_id: string;
  variable_id: string;
  chart_type?: ChartType;
  limit?: number;
}

export interface BivariableRequest {
  dataset_id: string;
  variable_x_id: string;
  variable_y_id: string;
  chart_type?: ChartType;
  limit?: number;
}

export interface BivariableResponse {
  variable_x_id: string;
  variable_y_id: string;
  nombre_variable_x: string;
  nombre_variable_y: string;
  chart_type: ChartType;
  data: ChartData;
  stats?: ChartStats;
}

export interface ChartConfig {
  id: string;
  type: 'univariable' | 'bivariable';
  chartType: ChartType;
  variableX: string;
  variableY?: string;
  limit?: number;
}
