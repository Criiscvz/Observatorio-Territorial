import { BarometroPublication } from '@core/services/barometro.service';
import { PublicLibraryPublication, publicHttpUrl } from '../components/public-library-publication';
import { powerBiEmbedUrl } from '../components/publication-viewer.component';

export function barometroPublicationCode(id: number): string {
  return `BAR-${String(id).padStart(4, '0')}`;
}

export function barometroViewerItem(publication: BarometroPublication): PublicLibraryPublication {
  return {
    id: String(publication.id),
    type: 'REPORTE',
    title: publication.titulo,
    code: barometroPublicationCode(publication.id),
    date: publication.fecha_publicacion,
    authors: '',
    source: publication.fuente ?? '',
    sourceUrl: publicHttpUrl(publication.fuente),
    description: publication.descripcion ?? '',
    reportUrl: powerBiEmbedUrl(publication.link_url),
    download_url: null,
    sharepoint_url: null,
    locked: false,
  };
}
