import { ChartType } from './chart-type.type';

export interface ChartConfig {
  id: string;
  type: 'univariable' | 'bivariable';
  chartType: ChartType;
  variableX: string;
  variableY?: string;
  limit?: number;
}
