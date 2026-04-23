import { ChartFilter } from './univariable-request.interface';

export interface BivariableRequest {
  dataset_id: string;
  variable_x_id: string;
  variable_y_id: string;
  chart_type?: string;
  limit?: number;
  filters?: ChartFilter[];
}
