import {
  BivariableResponse,
  ChartEntity,
  ChartType,
  VariableMetadatoEntity,
} from '@core/domain/entities';

export interface ActiveChart {
  id: string;
  type: 'univariable' | 'bivariable';
  chartType: ChartType;
  variableX: VariableMetadatoEntity;
  variableY?: VariableMetadatoEntity;
  data: ChartEntity | BivariableResponse;
  isLoading: boolean;
}
