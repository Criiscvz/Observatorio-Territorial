export type CatalogPublicationType = 'ARTICULO' | 'REPORTE' | 'LIBRO';

export interface CatalogPublication {
  id: string;
  resource_key: string;
  origen: 'publicaciones' | 'articulos' | 'reportes';
  tipo: CatalogPublicationType;
  codigo: string | null;
  titulo: string;
  descripcion: string | null;
  autores: string[];
  fuente: string | null;
  fecha_publicacion: string | null;
  fecha_recepcion: string | null;
  departamento_id: string | null;
  solo_suscriptores: boolean;
  bloqueado: boolean;
  link_url: string | null;
  download_url: string | null;
  ficha_indicador: string | null;
  sharepoint_url: string | null;
}

export interface CatalogPage {
  data: CatalogPublication[];
  counts: Record<CatalogPublicationType, number>;
  meta: { current_page: number; per_page: number; total: number; last_page: number; from: number | null; to: number | null };
}
