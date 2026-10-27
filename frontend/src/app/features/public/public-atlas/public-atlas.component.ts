import { CommonModule, isPlatformBrowser, ViewportScroller } from '@angular/common';
import { afterNextRender, Component, computed, DestroyRef, inject, Injector, OnInit, PLATFORM_ID, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { forkJoin } from 'rxjs';
import { ObservatorioPublicacion } from '@core/models/publicacion/publicacion.interface';
import { AtlasCategoria, AtlasCategoriaService } from '@core/services/atlas-categoria.service';
import { PublicacionService } from '@core/services/publicacion.service';
import { atlasCategoryPresentation } from '@core/utils/atlas-category-presentation';
import { PublicLibraryPublication, publicHttpUrl } from '../components/public-library-publication';
import { powerBiEmbedUrl } from '../components/publication-viewer.component';
import { PublicationViewerService } from '../components/publication-viewer.service';
import { PublicPublicationDetailsComponent } from '../components/public-publication-details.component';

interface AtlasDirectoryEntry extends AtlasCategoria {
  publications: ObservatorioPublicacion[];
  available: boolean;
}

@Component({
  selector: 'app-public-atlas',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatProgressSpinnerModule],
  templateUrl: './public-atlas.component.html',
  styleUrl: './public-atlas.component.scss',
})
export class PublicAtlasComponent implements OnInit {
  private readonly categories = inject(AtlasCategoriaService);
  private readonly publications = inject(PublicacionService);
  private readonly viewer = inject(PublicationViewerService);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly injector = inject(Injector);
  private readonly viewport = inject(ViewportScroller);
  readonly loading = signal(false);
  readonly loadError = signal(false);
  readonly categorias = signal<AtlasCategoria[]>([]);
  readonly atlas = signal<ObservatorioPublicacion[]>([]);
  readonly query = signal('');
  readonly onlyAvailable = signal(false);
  readonly page = signal(0);
  readonly selectedCategoryId = signal<string | null>(null);
  readonly libraryQuery = signal('');
  readonly libraryPage = signal(0);
  readonly libraryPageSize = 20;
  readonly pageSize = 5;
  readonly categoryVisual = atlasCategoryPresentation;
  readonly entries = computed<AtlasDirectoryEntry[]>(() => {
    return this.categorias().filter(category => category.publico !== false).map(category => {
      const publications = this.atlas().filter(item => item.estado === 'PUBLICACION'
        && (item.atlas_categoria?.id || item.atlas_categoria_id) === category.id);
      return {...category, publications, available: publications.some(item => this.canRead(item))};
    });
  });
  readonly filtered = computed(() => {
    const query = this.normalize(this.query());
    return this.entries().filter(entry => (!this.onlyAvailable() || entry.available) &&
      this.normalize([entry.nombre, entry.descripcion, ...entry.publications.flatMap(item => [item.titulo,item.fuente])].join(' ')).includes(query));
  });
  readonly availableCount = computed(() => this.filtered().reduce((total, entry) => total + entry.publications.filter(item => this.canRead(item)).length, 0));
  readonly pageCount = computed(() => Math.max(1, Math.ceil(this.filtered().length / this.pageSize)));
  readonly currentPage = computed(() => Math.min(this.page(), this.pageCount() - 1));
  readonly visible = computed(() => this.filtered().slice(this.currentPage() * this.pageSize, (this.currentPage() + 1) * this.pageSize));
  readonly rangeStart = computed(() => this.filtered().length ? this.currentPage() * this.pageSize + 1 : 0);
  readonly rangeEnd = computed(() => Math.min((this.currentPage() + 1) * this.pageSize, this.filtered().length));
  readonly selectedCategory = computed(() => this.entries().find(entry => entry.id === this.selectedCategoryId()));
  readonly libraryItems = computed(() => {
    const query = this.normalize(this.libraryQuery());
    return (this.selectedCategory()?.publications || []).filter(item => this.normalize([item.titulo,item.codigo,this.authors(item),item.fuente].join(' ')).includes(query));
  });
  readonly libraryPageCount = computed(() => Math.max(1, Math.ceil(this.libraryItems().length / this.libraryPageSize)));
  readonly currentLibraryPage = computed(() => Math.min(this.libraryPage(), this.libraryPageCount()-1));
  readonly visibleLibrary = computed(() => this.libraryItems().slice(this.currentLibraryPage()*this.libraryPageSize,(this.currentLibraryPage()+1)*this.libraryPageSize));
  readonly libraryStart = computed(() => this.libraryItems().length ? this.currentLibraryPage()*this.libraryPageSize+1 : 0);
  readonly libraryEnd = computed(() => Math.min((this.currentLibraryPage()+1)*this.libraryPageSize,this.libraryItems().length));

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) this.loadData();
  }

  loadData(): void {
    if (this.loading()) return;
    this.loading.set(true);
    this.loadError.set(false);
    forkJoin({ atlas: this.publications.getPublicAtlas(), categories: this.categories.list(true) })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: data => {
          this.categorias.set(data.categories);
          this.atlas.set(data.atlas);
          if (!data.categories.some(category => category.id === this.selectedCategoryId() && category.publico !== false)) this.selectedCategoryId.set(null);
          this.page.set(0);
          this.loading.set(false);
        },
        error: () => {
          this.categorias.set([]);
          this.atlas.set([]);
          this.selectedCategoryId.set(null);
          this.loadError.set(true);
          this.loading.set(false);
        },
      });
  }

  search(value: string): void { this.query.set(value); this.page.set(0); }
  filterAvailable(value: boolean): void { this.onlyAvailable.set(value); this.page.set(0); }
  changePage(delta: number): void {
    this.page.set(Math.max(0, Math.min(this.currentPage() + delta, this.pageCount() - 1)));
  }

  openCategory(entry: AtlasDirectoryEntry): void {
    if (!this.entries().some(current => current.id === entry.id)) return;
    this.selectedCategoryId.set(entry.id);this.libraryQuery.set('');this.libraryPage.set(0);
    this.scrollToTop();
  }
  backToCategories(): void { this.selectedCategoryId.set(null); this.scrollToTop(); }
  searchLibrary(value: string): void { this.libraryQuery.set(value);this.libraryPage.set(0); }
  changeLibraryPage(delta: number): void { this.libraryPage.set(Math.max(0,Math.min(this.currentLibraryPage()+delta,this.libraryPageCount()-1))); }
  authors(item: ObservatorioPublicacion): string {
    return Array.isArray(item.autores) ? item.autores.filter(Boolean).join(', ') : item.autores || '';
  }
  hasReport(item: ObservatorioPublicacion): boolean {
    return !item.bloqueado && !!powerBiEmbedUrl(item.link_url ?? null);
  }
  hasSource(item: ObservatorioPublicacion): boolean { return !!item.fuente?.trim(); }
  canRead(item: ObservatorioPublicacion): boolean {
    return !item.bloqueado && !!(powerBiEmbedUrl(item.link_url ?? null) || item.download_url || item.sharepoint_url);
  }
  openAtlas(candidate: ObservatorioPublicacion): void {
    // Re-read current category membership and access after any refresh.
    const current = this.entries().find(entry => entry.publications.some(item => item.id === candidate.id));
    const publication = current?.publications.find(item => item.id === candidate.id);
    if (!current || !publication || !this.canRead(publication)) return;
    const reportUrl = powerBiEmbedUrl(publication.link_url ?? null);
    this.viewer.open(this.toLibraryItem(publication, current), current.nombre, reportUrl ? 'report' : 'pdf', 'atlas');
  }

  openDetails(candidate: ObservatorioPublicacion): void {
    const category = this.entries().find(entry => entry.publications.some(item => item.id === candidate.id));
    const publication = category?.publications.find(item => item.id === candidate.id);
    if (!category || !publication || publication.bloqueado) return;
    this.dialog.open(PublicPublicationDetailsComponent, {
      data: {item: this.toLibraryItem(publication, category), departmentName: category.nombre, context: 'atlas'},
      width: '700px', maxWidth: 'calc(100vw - 24px)', maxHeight: 'calc(100dvh - 24px)',
      autoFocus: 'dialog', restoreFocus: true,
    });
  }

  private toLibraryItem(publication: ObservatorioPublicacion, category: AtlasDirectoryEntry): PublicLibraryPublication {
    return {
      id: publication.id, type: 'REPORTE', title: publication.titulo,
      code: publication.codigo || 'Atlas', date: publication.fecha_publicacion || null,
      authors: this.authors(publication),
      description: publication.descripcion || category.descripcion || '', source: publication.fuente || '',
      sourceUrl: publicHttpUrl(publication.fuente), reportUrl: powerBiEmbedUrl(publication.link_url ?? null),
      download_url: publication.download_url || null, sharepoint_url: publication.sharepoint_url || null, locked: false,
    };
  }

  private normalize(value: string): string {
    return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es').trim();
  }

  private scrollToTop(): void {
    if (isPlatformBrowser(this.platformId)) {
      afterNextRender(() => this.viewport.scrollToPosition([0, 0]), {injector: this.injector});
    }
  }
}
