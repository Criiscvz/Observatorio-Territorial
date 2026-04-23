import { DashboardData } from './dashboard-data.interface';
import { DashboardDepartamento } from './dashboard-departamento.interface';

export interface DashboardResponse {
  departamento: DashboardDepartamento;
  dashboards: DashboardData[];
}
