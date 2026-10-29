import { Articulo } from '@core/services/articulos.service';
import { Reporte } from '@core/services/reportes.service';
import { ObservatorioPublicacion } from '@core/models/publicacion/publicacion.interface';

export type PublicLibraryType = 'ARTICULO' | 'REPORTE' | 'LIBRO';
export interface PublicLibraryPublication {
  id: string;
  type: PublicLibraryType;
  title: string;
  code: string;
  date: string | null;
  authors: string;
  description: string;
  source: string;
  sourceUrl: string | null;
  reportUrl: string | null;
  download_url: string | null;
  sharepoint_url: string | null;
  locked: boolean;
}

export function publicHttpUrl(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  try { const url = new URL(value.trim()); return ['http:', 'https:'].includes(url.protocol) ? url.href : null; }
  catch { return null; }
}

function pdfUrl(value: string | null | undefined): string | null {
  return value?.startsWith('/api/') ? value : publicHttpUrl(value);
}

export function toPublicLibraryItem(
  item: Articulo | Reporte | ObservatorioPublicacion,
  type: PublicLibraryType,
  subscriberAccess: boolean,
): PublicLibraryPublication {
  const article = item as Articulo;
  const report = item as Reporte;
  const publication = item as ObservatorioPublicacion;
  const subscriberOnly = ('visibilidad' in item && item.visibilidad === 'suscriptor') || publication.solo_suscriptores;
  const locked = item.bloqueado === true || (!!subscriberOnly && !subscriberAccess);
  const download = locked ? null : pdfUrl(item.download_url || (type === 'REPORTE' ? report.ficha_indicador : null));
  const sharepoint = locked ? null : publicHttpUrl(item.sharepoint_url);
  const link = locked ? null : publicHttpUrl(item.link_url);
  const legacyArticleLink = !locked && type === 'ARTICULO' && article.enlace !== download ? publicHttpUrl(article.enlace) : null;
  const sourceUrl = locked ? null : (type === 'REPORTE' ? publicHttpUrl(item.fuente) : link || legacyArticleLink || publicHttpUrl(item.fuente));
  const authors = type === 'ARTICULO' ? article.autor : publication.autores;
  return {
    id: item.id,
    type,
    title: type === 'REPORTE' ? report.nombre_indicador : article.titulo,
    code: publication.codigo || ({ARTICULO: 'Artículo', REPORTE: 'Reporte Power BI', LIBRO: 'Libro PDF'}[type]),
    date: item.fecha_publicacion || null,
    authors: (Array.isArray(authors) ? authors.filter(Boolean).join(', ') : authors) || '',
    description: locked ? 'Contenido exclusivo para suscriptores.' : (type === 'REPORTE' ? report.descripcion_indicador : article.descripcion) || '',
    source: item.fuente || '',
    sourceUrl,
    reportUrl: type === 'REPORTE' ? link : null,
    download_url: download,
    sharepoint_url: sharepoint,
    locked,
  };
}

export function hasPublicPdf(item: PublicLibraryPublication): boolean {
  return !item.locked && !!(item.download_url || item.sharepoint_url);
}
