import { CommonModule, isPlatformBrowser } from '@angular/common';
import { PublicationViewerService } from '../components/publication-viewer.service';
import { Component, computed, DestroyRef, inject, OnInit, PLATFORM_ID, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, combineLatest, of, startWith, Subject, switchMap, tap } from 'rxjs';
import { Departamento } from '@core/models';
import { DepartamentoService } from '@core/services/departamento.service';
import { PublicCatalogService } from '@core/services/public-catalog.service';
import { CatalogPage } from '@core/models/publicacion/public-catalog.interface';
import { AuthService } from '@core/services/auth.service';
import { SubscriberAccessDialogComponent } from '@shared/components/subscriber-access-dialog';
import { hasPublicPdf, PublicLibraryPublication, PublicLibraryType, toPublicLibraryItem } from '../components/public-library-publication';
import { PublicPublicationDetailsComponent } from '../components/public-publication-details.component';

@Component({
  selector: 'app-public-departamento-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, MatIconModule, MatProgressSpinnerModule],
  templateUrl: './public-departamento-detail.component.html',
  styleUrl: './public-departamento-detail.component.scss',
})
export class PublicDepartamentoDetailComponent implements OnInit {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly route = inject(ActivatedRoute);
  private readonly departments = inject(DepartamentoService);
  private readonly catalog = inject(PublicCatalogService);
  private readonly auth = inject(AuthService);
  private readonly viewer = inject(PublicationViewerService);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);
  private readonly reload = new Subject<void>();
  private readonly retryDepartment = new Subject<void>();
  readonly departamento = signal<Departamento | null>(null);
  readonly items = signal<PublicLibraryPublication[]>([]);
  readonly loading = signal(true);
  readonly resultsLoading = signal(false);
  readonly loadError = signal(false);
  readonly publicationErrors = signal<string[]>([]);
  readonly type = signal<PublicLibraryType>('ARTICULO');
  readonly query = signal('');
  readonly page = signal(0);
  readonly pageSize = 20;
  readonly total = signal(0);
  readonly counts = signal({ARTICULO: 0, REPORTE: 0, LIBRO: 0});
  readonly hasPdf = hasPublicPdf;
  readonly types: {value: PublicLibraryType; label: string; singular: string; icon: string}[] = [
    {value: 'ARTICULO', label: 'Artículos', singular: 'artículo', icon: 'article'},
    {value: 'REPORTE', label: 'Reportes', singular: 'reporte', icon: 'bar_chart'},
    {value: 'LIBRO', label: 'Libros', singular: 'libro', icon: 'menu_book'},
  ];
  readonly typeLabel = computed(() => this.types.find(t => t.value === this.type())!);
  readonly filtered = computed(() => this.items());
  readonly pageCount = computed(() => Math.max(1, Math.ceil(this.total() / this.pageSize)));
  readonly currentPage = computed(() => Math.min(this.page(), this.pageCount() - 1));
  readonly visible = computed(() => this.items());
  readonly rangeStart = computed(() => this.total() ? this.currentPage() * this.pageSize + 1 : 0);
  readonly rangeEnd = computed(() => Math.min((this.currentPage() + 1) * this.pageSize, this.total()));

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) { this.loading.set(false); return; }
    combineLatest([this.route.params, this.retryDepartment.pipe(startWith(undefined))]).pipe(
      switchMap(([params]) => {
        const id = params['id'];
        this.loading.set(true); this.loadError.set(false); this.publicationErrors.set([]);
        this.departamento.set(null); this.items.set([]); this.query.set(''); this.page.set(0);
        this.total.set(0); this.counts.set({ARTICULO: 0, REPORTE: 0, LIBRO: 0}); this.type.set('ARTICULO');
        if (!id) return of(null);
        let initial = true;
        return this.departments.getPublicById(id).pipe(
          tap(department => { this.departamento.set(department); this.loading.set(false); }),
          switchMap(() => this.reload.pipe(startWith(undefined), switchMap(() => {
            this.resultsLoading.set(true); this.items.set([]); this.publicationErrors.set([]);
            return this.catalog.getPage(id, this.type(), this.page() + 1, this.query()).pipe(
              switchMap(result => {
                const choose = initial; initial = false;
                const first = this.types.find(t => result.counts[t.value] > 0)?.value;
                if (choose && !result.counts[this.type()] && first) {
                  this.type.set(first);
                  return this.catalog.getPage(id, first, 1, '');
                }
                if (this.page() + 1 > result.meta.last_page) {
                  this.page.set(Math.max(0, result.meta.last_page - 1));
                  return this.catalog.getPage(id, this.type(), this.page() + 1, this.query());
                }
                return of(result);
              }),
              catchError(() => { this.publicationErrors.set(['publicaciones']); this.total.set(0); return of(null); }),
            );
          }))),
          catchError(() => { this.loadError.set(true); this.departamento.set(null); return of(null); }),
        );
      }),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe((result: CatalogPage | null) => {
      if (result) {
        this.total.set(result.meta.total); this.counts.set(result.counts);
        const role = String(this.auth.user()?.rol || '').toUpperCase();
        const subscriber = this.auth.isAuthenticated() && ['ADMIN', 'SUBSCRIBER', 'SUSCRIPTOR', 'SUBSCRIPTOR'].includes(role);
        this.items.set(result.data.map(item => toPublicLibraryItem(item, item.tipo, subscriber)));
      }
      this.loading.set(false); this.resultsLoading.set(false);
    });
  }

  retry(): void { if (this.departamento()) this.reload.next(); else this.retryDepartment.next(); }
  count(type: PublicLibraryType): number { return this.counts()[type]; }
  selectType(type: PublicLibraryType): void { this.type.set(type); this.query.set(''); this.page.set(0); this.reload.next(); }
  search(value: string): void { this.query.set(value); this.page.set(0); this.reload.next(); }
  changePage(delta: number): void { this.page.set(Math.max(0, Math.min(this.currentPage() + delta, this.pageCount() - 1))); this.reload.next(); }
  icon(item: PublicLibraryPublication): string { return this.types.find(type => type.value === item.type)!.icon; }
  readLabel(item: PublicLibraryPublication): string {
    if (item.locked) return 'Suscribirse';
    if (item.type === 'REPORTE') return item.reportUrl ? 'Ver reporte' : this.hasPdf(item) ? 'Ver PDF' : 'Ver detalles';
    return item.type === 'LIBRO' ? 'Leer libro' : 'Leer artículo';
  }
  openDetails(item: PublicLibraryPublication): void {
    if (item.locked) { this.showSubscriberMessage(); return; }
    this.dialog.open(PublicPublicationDetailsComponent, {
      data: {item, departmentName: this.departamento()?.nombre || ''},
      width: '700px', maxWidth: 'calc(100vw - 24px)', maxHeight: 'calc(100dvh - 24px)',
      autoFocus: 'dialog', restoreFocus: true,
    });
  }
  read(item: PublicLibraryPublication): void {
    if (item.locked) { this.showSubscriberMessage(); return; }
    if (item.reportUrl) { this.viewer.open(item, this.departamento()?.nombre || '', 'report'); return; }
    if (this.hasPdf(item)) {
      this.viewer.open(item, this.departamento()?.nombre || '', 'pdf');
    } else if (item.sourceUrl) window.open(item.sourceUrl, '_blank', 'noopener,noreferrer');
    else this.openDetails(item);
  }
  private showSubscriberMessage(): void {
    this.dialog.open(SubscriberAccessDialogComponent, {
      width: 'min(92vw, 460px)', maxWidth: '92vw', autoFocus: false,
      panelClass: 'subscriber-access-dialog-panel', backdropClass: 'subscriber-access-dialog-backdrop',
      data: {title: 'Contenido exclusivo para suscriptores', message: 'Inicia sesión con una cuenta suscriptora para consultar esta publicación.', icon: 'lock', closeText: 'Entendido'},
    });
  }
}
