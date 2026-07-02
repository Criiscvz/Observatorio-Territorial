export type TipoPublicacion = 'ARTICULO' | 'REPORTE' | 'ATLAS';

export interface ObservatorioPublicacion {
  id: string;
  departamento_id: string;
  tipo: Exclude<TipoPublicacion, 'ATLAS'>;
  codigo: string;
  titulo: string;
  fecha_publicacion: string;
  link_url: string;
  descripcion?: string | null;
  autores?: string | null;
  fuente: string;
  nombre_archivo_original: string;
  download_url: string;
  created_at: string;
  updated_at: string;
}
