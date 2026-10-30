import { DatePipe } from '@angular/common';
import { Component, computed, input, output, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ObservatorioPublicacion, requiresReviewObservation } from '@core/models/publicacion/publicacion.interface';

export type LibraryType = 'ARTICULO' | 'REPORTE' | 'LIBRO';
export interface LibraryFilters {tipo: LibraryType; q: string; page: number;}

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
  readonly total = input(0);
  readonly totals = input<Partial<Record<LibraryType, number>>>({});
  readonly error = input('');
  readonly retry = output<void>();
  readonly filtersChange = output<LibraryFilters>();
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
  readonly type = input<LibraryType>('ARTICULO');
  readonly query = input('');
  readonly page = input(0);
  readonly expandedId = signal<string | null>(null);
  readonly pageSize = 20;
  readonly pageCount = computed(() => Math.max(1, Math.ceil(this.total() / this.pageSize)));
  readonly currentPage = computed(() => Math.min(this.page(), this.pageCount() - 1));
  readonly visible = this.publications;
  readonly rangeStart = computed(() => this.total() ? this.currentPage() * this.pageSize + 1 : 0);
  readonly rangeEnd = computed(() => Math.min((this.currentPage() + 1) * this.pageSize, this.total()));

  count(type: LibraryType): number { return this.totals()[type] || 0; }
  selectType(type: LibraryType): void {
    this.expandedId.set(null); this.typeChange.emit(type); this.filtersChange.emit({tipo:type,q:'',page:0});
  }
  search(value: string): void { this.expandedId.set(null); this.filtersChange.emit({tipo:this.type(),q:value,page:0}); }
  changePage(delta: number): void {
    this.filtersChange.emit({tipo:this.type(),q:this.query(),page:Math.max(0, Math.min(this.currentPage() + delta, this.pageCount() - 1))});
    this.expandedId.set(null);
  }
  toggle(item: ObservatorioPublicacion): void { this.expandedId.update(id => id === item.id ? null : item.id); }
  hasPdf(item: ObservatorioPublicacion): boolean { return !item.bloqueado && !!(item.download_url || item.sharepoint_url); }
  canView(item: ObservatorioPublicacion): boolean {
    return item.capabilities?.can_view === true && !item.bloqueado && (item.tipo === 'REPORTE' ? !!this.sourceUrl(item) || this.hasPdf(item) : this.hasPdf(item));
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
}
