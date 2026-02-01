import { ChartType } from './chart-type.type';

export interface BivariableRequest {
  dataset_id: string;
  variable_x_id: string;
  variable_y_id: string;
  chart_type?: ChartType;
  limit?: number;
}
