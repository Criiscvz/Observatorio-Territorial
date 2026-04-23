import { ChartType } from './chart-type.type';

export interface UnivariableRequest {
  dataset_id: string;
  variable_id: string;
  chart_type?: ChartType;
  limit?: number;
}
