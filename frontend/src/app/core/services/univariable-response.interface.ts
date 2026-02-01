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
