export type TipoPublicacion = 'ARTICULO' | 'REPORTE' | 'LIBRO' | 'ATLAS';
export type EstadoPublicacion =
  | 'PUBLICACION'
  | 'EN_REVISION'
  | 'SUSPENDIDO'
  | 'ARCHIVADO';

export interface ObservatorioPublicacion {
  id: string;
  departamento_id?: string | null;
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
  bloqueado?: boolean;
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

export interface SharePointBrowserItem {
  id: string;
  parent_id?: string | null;
  name: string;
  type: 'folder' | 'pdf';
  web_url?: string | null;
  mime_type?: string | null;
  size?: number | null;
  last_modified_at?: string | null;
  is_pdf: boolean;
  selectable: boolean;
}

export interface SharePointNavigationItem {
  id: string;
  parent_id?: string | null;
  name: string;
  web_url?: string | null;
}

export interface SharePointBrowseResponse {
  current: SharePointNavigationItem;
  root: SharePointNavigationItem;
  parent?: SharePointNavigationItem | null;
  breadcrumbs: SharePointNavigationItem[];
  items: SharePointBrowserItem[];
}

export interface SharePointAtlasImportSummary {
  imported: ObservatorioPublicacion[];
  duplicates: Array<{
    sharepoint_file_id: string;
    name?: string | null;
    publicacion_id?: string | null;
    message: string;
  }>;
  rejected: Array<{ sharepoint_file_id: string; message: string }>;
  errors: Array<{ sharepoint_file_id: string; message: string }>;
}

export interface SharePointAtlasImportResponse {
  data: SharePointAtlasImportSummary;
  totals: {
    imported: number;
    duplicates: number;
    rejected: number;
    errors: number;
  };
}
