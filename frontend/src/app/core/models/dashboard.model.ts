import { VariableMetadato } from './departamento.model';

export interface DashboardResponse {
  departamento: {
    id: string;
    nombre: string;
  };
  dashboards: DashboardData[];
}

export interface DashboardData {
  dataset: {
    id: string;
    nombre: string;
    total_registros: number;
    fecha_carga: string;
  };
  variables: VariableMetadato[];
  charts: ChartData[];
}

export interface ChartData {
  variable: string;
  tipo: 'categorical' | 'numeric' | 'date';
  chart_type: 'bar' | 'pie' | 'donut' | 'line' | 'area' | 'histogram' | 'scatter' | 'heatmap' | 'grouped_bar' | 'stacked_bar';
  data: {
    labels?: string[];
    values?: number[];
    points?: [number, number][];
    series?: { name: string; data: number[] }[];
  };
  stats?: {
    count?: number;
    mean?: number;
    median?: number;
    min?: number;
    max?: number;
    sum?: number;
  };
}

export interface StatsRequest {
  dataset_id: string;
  variable: string;
  tipo_grafico?: 'bar' | 'pie' | 'line' | 'histogram' | 'scatter';
  variable_y?: string;
}

export interface StatsResponse {
  variable: string;
  tipo_dato: string;
  tipo_grafico: string;
  data: {
    labels: string[];
    values: number[];
    points?: [number, number][];
  };
}
