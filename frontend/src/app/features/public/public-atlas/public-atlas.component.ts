import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Component, computed, DestroyRef, inject, OnInit, PLATFORM_ID, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { forkJoin } from 'rxjs';
import { ObservatorioPublicacion } from '@core/models/publicacion/publicacion.interface';
import { AtlasCategoria, AtlasCategoriaService } from '@core/services/atlas-categoria.service';
import { PublicacionService } from '@core/services/publicacion.service';
import { atlasCategoryPresentation } from '@core/utils/atlas-category-presentation';
import { PublicLibraryPublication, publicHttpUrl } from '../components/public-library-publication';
import { powerBiEmbedUrl } from '../components/publication-viewer.component';
import { PublicationViewerService } from '../components/publication-viewer.service';

interface AtlasDirectoryEntry extends AtlasCategoria {
  publication: ObservatorioPublicacion | null;
  reportUrl: string | null;
  available: boolean;
  status: string;
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
  private readonly destroyRef = inject(DestroyRef);
  private readonly platformId = inject(PLATFORM_ID);
  readonly loading = signal(false);
  readonly loadError = signal(false);
  readonly categorias = signal<AtlasCategoria[]>([]);
  readonly atlas = signal<ObservatorioPublicacion[]>([]);
  readonly query = signal('');
  readonly onlyAvailable = signal(false);
  readonly page = signal(0);
  readonly pageSize = 5;
  readonly categoryVisual = atlasCategoryPresentation;
  readonly entries = computed<AtlasDirectoryEntry[]>(() => {
    const selected = new Map(this.atlas().map(item => [item.id, item]));
    return this.categorias().filter(category => category.publico !== false).map(category => {
      const candidate = selected.get(category.publicacion_destacada_id ?? '');
      const publication = candidate?.atlas_categoria?.id === category.id ? candidate : null;
      const restricted = !!(publication?.bloqueado || publication?.solo_suscriptores);
      const reportUrl = restricted ? null : powerBiEmbedUrl(publication?.link_url ?? null);
      return {
        ...category, publication, reportUrl, available: !!reportUrl,
        status: !publication ? 'Sin Atlas publicado' : restricted ? 'Acceso restringido'
          : reportUrl ? 'Atlas disponible' : 'Enlace no compatible con el visor',
      };
    });
  });
  readonly filtered = computed(() => {
    const query = this.normalize(this.query());
    return this.entries().filter(entry => (!this.onlyAvailable() || entry.available) &&
      this.normalize([entry.nombre, entry.descripcion, entry.publication?.titulo, entry.publication?.fuente].join(' ')).includes(query));
  });
  readonly availableCount = computed(() => this.filtered().filter(entry => entry.available).length);
  readonly pageCount = computed(() => Math.max(1, Math.ceil(this.filtered().length / this.pageSize)));
  readonly currentPage = computed(() => Math.min(this.page(), this.pageCount() - 1));
  readonly visible = computed(() => this.filtered().slice(this.currentPage() * this.pageSize, (this.currentPage() + 1) * this.pageSize));
  readonly rangeStart = computed(() => this.filtered().length ? this.currentPage() * this.pageSize + 1 : 0);
  readonly rangeEnd = computed(() => Math.min((this.currentPage() + 1) * this.pageSize, this.filtered().length));

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
          this.page.set(0);
          this.loading.set(false);
        },
        error: () => {
          this.categorias.set([]);
          this.atlas.set([]);
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

  openAtlas(entry: AtlasDirectoryEntry): void {
    // Re-read the selection so an outdated row cannot open a replaced link.
    const current = this.entries().find(item => item.id === entry.id);
    const publication = current?.publication;
    if (!current?.available || !current.reportUrl || !publication) return;
    const item: PublicLibraryPublication = {
      id: publication.id, type: 'REPORTE', title: publication.titulo,
      code: publication.codigo || 'Atlas', date: publication.fecha_publicacion || null,
      authors: Array.isArray(publication.autores) ? publication.autores.join(', ') : publication.autores || '',
      description: publication.descripcion || current.descripcion || '', source: publication.fuente || '',
      sourceUrl: publicHttpUrl(publication.fuente), reportUrl: current.reportUrl,
      download_url: null, sharepoint_url: null, locked: false,
    };
    this.viewer.open(item, current.nombre, 'report', 'atlas');
  }

  private normalize(value: string): string {
    return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es').trim();
  }
}
