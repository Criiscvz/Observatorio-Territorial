import { Departamento } from './departamento.interface';
import { VariableMetadato } from './variable-metadato.interface';

export interface Dataset {
  id: string;
  departamento_id: string;
  subido_por: number;
  nombre: string;
  nombre_archivo: string;
  descripcion?: string;
  estado: 'PENDIENTE' | 'PROCESANDO' | 'COMPLETADO' | 'ERROR';
  total_registros: number;
  fecha_carga: string;
  created_at: string;
  updated_at: string;
  variables_metadatos?: VariableMetadato[];
  variables?: VariableMetadato[]; // Alias para variables_metadatos usado en vistas públicas
  departamento?: Departamento;
}
