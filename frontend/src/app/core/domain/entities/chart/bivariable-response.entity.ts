import { ChartData } from './chart-data.entity';
import { ChartStats } from './chart-stats.entity';
import { ChartType } from './chart-type.type';

export interface BivariableResponse {
  variable_x_id: string;
  variable_y_id: string;
  nombre_variable_x: string;
  nombre_variable_y: string;
  chart_type: ChartType;
  data: ChartData;
  stats?: ChartStats;
}
