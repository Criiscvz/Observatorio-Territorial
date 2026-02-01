import { DatasetEstado } from './dataset-estado.type';
import { VariableMetadatoEntity } from './variable-metadato.entity';

export interface DatasetEntity {
  id: string;
  departamento_id: string;
  nombre: string;
  nombre_archivo?: string;
  descripcion?: string;
  estado: DatasetEstado;
  total_registros: number;
  fecha_carga?: string;
  created_at?: string;
  updated_at?: string;
  variables_metadatos?: VariableMetadatoEntity[];
}
