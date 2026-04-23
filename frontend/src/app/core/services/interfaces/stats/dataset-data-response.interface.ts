import { VariableMetadato } from '../../../models';

export interface DatasetDataResponse {
  dataset: {
    id: string;
    nombre: string;
    total_registros: number;
    departamento_id?: string;
  };
  variables: VariableMetadato[];
  data: { id: number; data: Record<string, any> }[];
  pagination: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
}
