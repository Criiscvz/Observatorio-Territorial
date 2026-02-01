import { VariableMetadato } from '../models';

export interface DatasetDataResponse {
  dataset: {
    id: string;
    nombre: string;
    total_registros: number;
    departamento_id?: string;
  };
  variables: VariableMetadato[];
  data: { id: number; data: Record<string, any> }[];
  pagination: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
}

export interface UnivariableRequest {
  dataset_id: string;
  variable_id: string;
  chart_type?: string;
  limit?: number;
}

export interface UnivariableResponse {
  variable_id: string;
  nombre_variable: string;
  tipo_variable: string;
  chart_type: string;
  data: {
    labels?: string[];
    values?: number[];
    categories?: string[];
  };
  stats?: {
    count?: number;
    mean?: number;
    min?: number;
    max?: number;
    sum?: number;
    median?: number;
    unique?: number;
  };
}

export interface BivariableRequest {
  dataset_id: string;
  variable_x_id: string;
  variable_y_id: string;
  chart_type?: string;
  limit?: number;
}

export interface BivariableSeries {
  name: string;
  data: number[];
}

export interface BivariableResponse {
  variable_x_id: string;
  variable_y_id: string;
  nombre_variable_x: string;
  nombre_variable_y: string;
  variable_x: string;
  variable_y: string;
  chart_type: string;
  data: {
    labels?: string[];
    labels_x?: string[];
    labels_y?: string[];
    categories?: string[];
    values?: number[];
    points?: [number, number][];
    counts?: number[];
    series?: BivariableSeries[];
    heatmap?: [number, number, number][];
    correlation?: number;
    stats?: {
      count?: number;
    };
  };
  stats?: {
    correlation?: number;
    count?: number;
  };
}
