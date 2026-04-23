import { ChartData } from './chart-data.entity';
import { ChartStats } from './chart-stats.entity';
import { ChartType } from './chart-type.type';

export interface ChartEntity {
  id: string;
  variable_id: string;
  nombre_variable: string;
  tipo_variable: string;
  chart_type: ChartType;
  data: ChartData;
  stats?: ChartStats;
}
