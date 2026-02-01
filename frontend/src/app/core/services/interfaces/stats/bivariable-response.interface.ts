import { BivariableSeries } from './bivariable-series.interface';

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
