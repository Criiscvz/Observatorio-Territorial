import { DatePipe } from '@angular/common';
import { Component, computed, input, output, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ObservatorioPublicacion, requiresReviewObservation } from '@core/models/publicacion/publicacion.interface';

export type LibraryType = 'ARTICULO' | 'REPORTE' | 'LIBRO';

@Component({
  selector: 'app-observatory-library',
  standalone: true,
  imports: [DatePipe, MatIconModule, MatTooltipModule],
  templateUrl: './observatory-library.component.html',
  styleUrl: './observatory-library.component.scss',
})
export class ObservatoryLibraryComponent {
  readonly hasReviewObservation = (item: ObservatorioPublicacion) => requiresReviewObservation(item.estado);
  readonly publications = input<ObservatorioPublicacion[]>([]);
  readonly loading = input(false);
  readonly canEdit = input<(item: ObservatorioPublicacion) => boolean>(() => false);
  readonly canDelete = input<(item: ObservatorioPublicacion) => boolean>(() => false);
  readonly edit = output<ObservatorioPublicacion>();
  readonly remove = output<ObservatorioPublicacion>();
  readonly viewPublication = output<ObservatorioPublicacion>();
  readonly typeChange = output<LibraryType>();
  readonly types: {value: LibraryType; label: string; icon: string}[] = [
    {value: 'ARTICULO', label: 'Artículos', icon: 'article'},
    {value: 'REPORTE', label: 'Reportes', icon: 'bar_chart'},
    {value: 'LIBRO', label: 'Libros', icon: 'menu_book'},
  ];
  readonly type = signal<LibraryType>('ARTICULO');
  readonly query = signal('');
  readonly page = signal(0);
  readonly expandedId = signal<string | null>(null);
  readonly pageSize = 20;
  readonly typeItems = computed(() => this.publications().filter(item => item.tipo === this.type()));
  readonly filtered = computed(() => {
    const query = this.normalize(this.query());
    return this.typeItems().filter(item => !query || this.normalize([
      item.titulo, item.codigo, item.fuente, this.authors(item), item.creador?.name, item.observacion_revision, this.stateLabel(item),
    ].join(' ')).includes(query));
  });
  readonly pageCount = computed(() => Math.max(1, Math.ceil(this.filtered().length / this.pageSize)));
  readonly currentPage = computed(() => Math.min(this.page(), this.pageCount() - 1));
  readonly visible = computed(() => this.filtered().slice(this.currentPage() * this.pageSize, (this.currentPage() + 1) * this.pageSize));
  readonly rangeStart = computed(() => this.filtered().length ? this.currentPage() * this.pageSize + 1 : 0);
  readonly rangeEnd = computed(() => Math.min((this.currentPage() + 1) * this.pageSize, this.filtered().length));

  count(type: LibraryType): number { return this.publications().filter(item => item.tipo === type).length; }
  selectType(type: LibraryType): void {
    this.type.set(type); this.query.set(''); this.page.set(0); this.expandedId.set(null); this.typeChange.emit(type);
  }
  search(value: string): void { this.query.set(value); this.page.set(0); this.expandedId.set(null); }
  changePage(delta: number): void {
    this.page.set(Math.max(0, Math.min(this.currentPage() + delta, this.pageCount() - 1)));
    this.expandedId.set(null);
  }
  toggle(item: ObservatorioPublicacion): void { this.expandedId.update(id => id === item.id ? null : item.id); }
  hasPdf(item: ObservatorioPublicacion): boolean { return !item.bloqueado && !!(item.download_url || item.sharepoint_url); }
  canView(item: ObservatorioPublicacion): boolean {
    return !item.bloqueado && (item.tipo === 'REPORTE' ? !!this.sourceUrl(item) || this.hasPdf(item) : this.hasPdf(item));
  }
  sourceUrl(item: ObservatorioPublicacion): string | null {
    if (item.bloqueado || !item.link_url) return null;
    try { const url = new URL(item.link_url); return ['http:', 'https:'].includes(url.protocol) ? url.href : null; }
    catch { return null; }
  }
  authors(item: ObservatorioPublicacion): string {
    return (Array.isArray(item.autores) ? item.autores.join(', ') : item.autores) || 'No especificados';
  }
  stateLabel(item: ObservatorioPublicacion): string {
    return {PUBLICACION: 'Publicado', EN_REVISION: 'En revisión', SUSPENDIDO: 'Suspendido', ARCHIVADO: 'Archivado', RECHAZADO: 'Rechazado'}[item.estado] || 'Sin estado';
  }
  stateIcon(item: ObservatorioPublicacion): string {
    return {PUBLICACION: 'check_circle', EN_REVISION: 'schedule', SUSPENDIDO: 'pause_circle', ARCHIVADO: 'archive', RECHAZADO: 'cancel'}[item.estado] || 'help_outline';
  }
  private normalize(value: string): string { return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es').trim(); }
}
