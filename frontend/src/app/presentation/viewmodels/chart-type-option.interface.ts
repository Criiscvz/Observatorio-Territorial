import { ChartType } from '@core/domain/entities';

export interface ChartTypeOption {
  id: ChartType;
  name: string;
  icon: string;
  description: string;
  forTypes: string[];
  bivariable: boolean;
}
