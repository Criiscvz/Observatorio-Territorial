import { Departamento } from '../departamento/departamento.interface';
import {
  CategoriaDataset,
  DatasetFuente,
  GraficoPredeterminado,
} from './categoria-dataset.interface';
import { VariableMetadato } from './variable-metadato.interface';

export interface Dataset {
  id: string;
  departamento_id: string;
  categoria_id?: string;
  subido_por: number;
  nombre: string;
  nombre_archivo: string;
  descripcion?: string;
  enlace_fuente?: string;
  estado: 'PENDIENTE' | 'PROCESANDO' | 'COMPLETADO' | 'ERROR';
  total_registros: number;
  fecha_carga: string;
  created_at: string;
  updated_at: string;
  variables_metadatos?: VariableMetadato[];
  variables?: VariableMetadato[]; // Alias para variables_metadatos usado en vistas públicas
  departamento?: Departamento;
  categoria?: CategoriaDataset;
  fuentes?: DatasetFuente[];
  graficos_predeterminados?: GraficoPredeterminado[];
}
