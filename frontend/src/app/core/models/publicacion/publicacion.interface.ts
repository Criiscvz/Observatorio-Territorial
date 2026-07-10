export type TipoPublicacion = 'ARTICULO' | 'REPORTE' | 'ATLAS';
export type EstadoPublicacion =
  | 'PUBLICACION'
  | 'EN_REVISION'
  | 'SUSPENDIDO'
  | 'ARCHIVADO'
  | 'ELIMINADO';

export interface ObservatorioPublicacion {
  id: string;
  departamento_id: string;
  creado_por?: number | null;
  creador?: {
    id: number;
    name: string;
    email: string;
    rol: string;
  } | null;
  tipo: TipoPublicacion;
  estado: EstadoPublicacion;
  solo_suscriptores: boolean;
  codigo: string;
  titulo: string;
  fecha_publicacion: string;
  link_url?: string | null;
  descripcion?: string | null;
  autores?: string | null;
  fuente: string;
  nombre_archivo_original?: string | null;
  download_url?: string | null;
  sharepoint_url?: string | null;
  sharepoint_file_id?: string | null;
  sharepoint_file_name?: string | null;
  sharepoint_file_type?: string | null;
  sharepoint_file_size?: number | null;
  sharepoint_last_modified_at?: string | null;
  sharepoint_sync_status?: 'pendiente' | 'sincronizado' | 'error' | string | null;
  sharepoint_synced_at?: string | null;
  sharepoint_error?: string | null;
  created_at: string;
  updated_at: string;
}

export interface SharePointFile {
  id: string;
  name: string;
  web_url: string;
  mime_type?: string | null;
  size?: number | null;
  created_at?: string | null;
  last_modified_at?: string | null;
  powerbi_url?: string | null;
}
