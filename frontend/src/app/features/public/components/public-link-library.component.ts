import { DatePipe } from '@angular/common';
import { Component, computed, input, output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { ObservatorioPublicacion } from '@core/models/publicacion/publicacion.interface';
import { powerBiEmbedUrl } from './publication-viewer.component';

export type LinkLibraryEntry = Pick<ObservatorioPublicacion,
  'id' | 'titulo' | 'codigo' | 'fecha_publicacion' | 'estado' | 'fuente' | 'autores' | 'bloqueado' |
  'link_url' | 'download_url' | 'sharepoint_url'>;

export function linkLibraryAuthors(item: LinkLibraryEntry): string {
  return Array.isArray(item.autores) ? item.autores.filter(Boolean).join(', ') : item.autores || '';
}

export function linkLibraryCanRead(item: LinkLibraryEntry): boolean {
  return item.estado === 'PUBLICACION' && !item.bloqueado &&
    !!(powerBiEmbedUrl(item.link_url ?? null) || item.download_url || item.sharepoint_url);
}

@Component({
  selector: 'app-public-link-library',
  imports: [DatePipe, MatIconModule],
  templateUrl: './public-link-library.component.html',
  styleUrl: '../public-atlas/public-atlas.component.scss',
  host: {style: 'display: block'},
})
export class PublicLinkLibraryComponent {
  readonly kind = input.required<'atlas' | 'barometro'>();
  readonly items = input.required<LinkLibraryEntry[]>();
  readonly query = input.required<string>();
  readonly page = input.required<number>();
  readonly total = input.required<number>();
  readonly loading = input.required<boolean>();
  readonly failed = input.required<boolean>();

  readonly search = output<string>();
  readonly pageChange = output<number>();
  readonly retry = output<void>();
  readonly read = output<LinkLibraryEntry>();
  readonly details = output<LinkLibraryEntry>();

  readonly pageSize = 20;
  readonly pageCount = computed(() => Math.max(1, Math.ceil(this.total() / this.pageSize)));
  readonly currentPage = computed(() => Math.min(this.page(), this.pageCount() - 1));
  readonly start = computed(() => this.total() ? this.currentPage() * this.pageSize + 1 : 0);
  readonly end = computed(() => Math.min((this.currentPage() + 1) * this.pageSize, this.total()));
  readonly atlas = computed(() => this.kind() === 'atlas');
  readonly action = computed(() => this.atlas() ? 'Ver Atlas' : 'Ver reporte');
  readonly authors = linkLibraryAuthors;
  readonly canRead = linkLibraryCanRead;

  hasReport(item: LinkLibraryEntry): boolean {
    return !item.bloqueado && !!powerBiEmbedUrl(item.link_url ?? null);
  }

  hasSource(item: LinkLibraryEntry): boolean {
    return !!item.fuente?.trim();
  }
}
