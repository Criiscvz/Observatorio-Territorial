import { VariableMetadato } from '../dataset/variable-metadato.interface';
import { ChartData } from './chart-data.interface';

export interface DashboardData {
  dataset: {
    id: string;
    nombre: string;
    total_registros: number;
    fecha_carga: string;
  };
  variables: VariableMetadato[];
  charts: ChartData[];
}
