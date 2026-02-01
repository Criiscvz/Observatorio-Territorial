import { ChartData } from './chart-data.interface';
import { VariableMetadato } from './variable-metadato.interface';

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
