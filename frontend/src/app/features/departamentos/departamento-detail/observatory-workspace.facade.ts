import { Injectable, DestroyRef, WritableSignal, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EMPTY, Observable, Subject, Subscription, catchError, defer, finalize, of, switchMap, takeUntil, tap } from 'rxjs';
import { Dataset, Departamento } from '@core/models';
import { EstadoPublicacion, ObservatorioPublicacion, TipoPublicacion } from '@core/models/publicacion/publicacion.interface';
import { AuthService } from '@core/services/auth.service';
import { DepartamentoService } from '@core/services/departamento.service';
import { PublicacionService } from '@core/services/publicacion.service';
import { LibraryFilters, LibraryType } from './observatory-library.component';

/** Per-view state and paginated reads. Never shared between observatory screens. */
@Injectable()
export class ObservatoryWorkspaceFacade {
  private readonly destroyRef = inject(DestroyRef);
  private readonly authService = inject(AuthService);
  private readonly deptoService = inject(DepartamentoService);
  private readonly publicacionService = inject(PublicacionService);
  private readonly readyEvents = new Subject<void>();
  readonly ready = this.readyEvents.asObservable();
  private readonly contextEvents = new Subject<void>();
  readonly contextChanges = this.contextEvents.asObservable();
  private started = false;
  readonly isAdmin = this.authService.isAdmin;

  readonly isEditor = this.authService.isEditor;

  readonly libraryType = signal<LibraryType>('ARTICULO');

  readonly libraryQuery = signal('');

  readonly libraryPage = signal(0);

  readonly libraryTotal = signal(0);

  readonly libraryCounts = signal<Partial<Record<LibraryType,number>>>({});

  readonly libraryError = signal('');

  readonly reviewTotal = signal(0);

  readonly reviewPage = signal(0);

  readonly reviewLastPage = signal(1);

  private readonly libraryRequests = new Subject<string|null>();

  private readonly reviewRequests = new Subject<string|null>();

  private departmentRequest?: Subscription;
  private uploadRequest?: Subscription;

  departamento = signal<Departamento | null>(null);

  datasets = signal<Dataset[]>([]);

  publicaciones = signal<ObservatorioPublicacion[]>([]);

  loading = signal(true);

  loadingPublicaciones = signal(false);

  loadingReviewPublicaciones = signal(false);

  changingReviewStatus = signal<string | null>(null);

  syncingSharePoint = signal<TipoPublicacion | null>(null);

  canUploadPublications = signal(false);

  reviewPublicaciones = signal<ObservatorioPublicacion[]>([]);

  readonly reviewSelectedId = signal<string | null>(null);

  readonly reviewError = signal('');

  readonly selectedReview = computed(() => this.reviewPublicaciones().find(item => item.id === this.reviewSelectedId()) || this.reviewPublicaciones()[0] || null);

  get canManagePublications(): boolean {
    const departamento = this.departamento();
    if (!departamento) return false;

    const hasObservatorioPermission =
      this.canUploadPublications() ||
      ['ADMIN', 'EDITOR'].includes(String(departamento.user_role ?? '').toUpperCase()) ||
      this.authService.hasRoleInDepartamento(departamento.id, ['ADMIN', 'EDITOR']);

    return this.isAdmin() || this.authService.canReviewObservatory(this.departamento()?.id) || (this.isEditor() && hasObservatorioPermission);
  }

  get canUploadButtonGroup(): boolean {
    return this.canManagePublications;
  }

  loadDepartamento(id: string): void {
    this.contextEvents.next();
    this.departmentRequest?.unsubscribe();
    this.uploadRequest?.unsubscribe();
    this.libraryRequests.next(null);this.reviewRequests.next(null);this.departamento.set(null);
    this.libraryPage.set(0);this.libraryQuery.set('');this.libraryType.set('ARTICULO');this.libraryTotal.set(0);this.libraryCounts.set({});this.reviewTotal.set(0);
    this.canUploadPublications.set(false);
    this.datasets.set([]);
    this.reviewPage.set(0);
    this.reviewLastPage.set(1);
    this.loading.set(true);
    this.departmentRequest = this.deptoService.getById(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (departamento) => {
        this.departamento.set(departamento);
        this.datasets.set(departamento?.datasets || []);
        this.loading.set(false);
        this.loadCanUpload(id);
        this.loadPublicaciones(id);
      },
      error: () => {
        this.canUploadPublications.set(false);
        this.loading.set(false);
      },
    });
  }

  loadCanUpload(id: string): void {
    if (this.departamento()?.id !== id) return;
    this.uploadRequest?.unsubscribe();
    this.uploadRequest = this.publicacionService.canUpload(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (response) => {
        if(this.departamento()?.id!==id)return;
        const canUpload =
          !!response.can_upload ||
          (String(response.role ?? '').toUpperCase() === 'EDITOR' && !!response.has_permission);
        this.canUploadPublications.set(canUpload);
        if(this.departamento()?.id===id)this.readyEvents.next();
      },
      error: () => {if(this.departamento()?.id===id)this.canUploadPublications.set(false);},
    });
  }

  loadPublicaciones(id: string): void {
    if (this.departamento()?.id !== id) return;
    this.libraryRequests.next(id);
  }

  libraryFiltersChanged(filters:LibraryFilters):void {
    this.libraryType.set(filters.tipo);this.libraryQuery.set(filters.q);this.libraryPage.set(filters.page);
    if(this.departamento())this.loadPublicaciones(this.departamento()!.id);
  }

  retryLibrary():void {if(this.departamento())this.loadPublicaciones(this.departamento()!.id);}

  loadReviewPublicaciones(id: string): void {
    if (this.departamento()?.id !== id) return;
    this.reviewRequests.next(id);
  }

  changeReviewPage(delta:number):void {
    this.reviewPage.set(Math.max(0,Math.min(this.reviewPage()+delta,this.reviewLastPage()-1)));
    if(this.departamento())this.loadReviewPublicaciones(this.departamento()!.id);
  }

  start(): void {
    if (this.started) return;
    this.started = true;
    this.libraryRequests.pipe(switchMap(id => {
      this.publicaciones.set([]);
      this.libraryError.set('');
      if (!id) return of(null);
      this.loadingPublicaciones.set(true);
      return this.page(id, {tipo:this.libraryType(), q:this.libraryQuery()}, this.libraryPage).pipe(catchError(() => {
        this.libraryTotal.set(0);
        this.libraryCounts.set({});
        this.reviewTotal.set(0);
        this.libraryError.set('No se pudieron cargar las publicaciones.');
        return of(null);
      }));
    }), takeUntilDestroyed(this.destroyRef)).subscribe(result => {
      if (result) {
        this.publicaciones.set(result.data);
        this.libraryTotal.set(result.meta.total);
        this.libraryCounts.set(result.counts || {});
        this.reviewTotal.set(result.review_total || 0);
        this.libraryPage.set(result.meta.current_page - 1);
      }
      this.loadingPublicaciones.set(false);
      if (result) this.readyEvents.next();
    });
    this.reviewRequests.pipe(switchMap(id => {
      this.reviewPublicaciones.set([]);
      this.reviewSelectedId.set(null);
      this.reviewError.set('');
      if (!id) return of(null);
      this.loadingReviewPublicaciones.set(true);
      return this.page(id, {estado:'EN_REVISION'}, this.reviewPage).pipe(catchError(() => {
        this.reviewError.set('No se pudieron cargar las publicaciones en revisión.');
        return of(null);
      }));
    }), takeUntilDestroyed(this.destroyRef)).subscribe(result => {
      if (result) {
        this.reviewPublicaciones.set(result.data);
        this.reviewTotal.set(result.meta.total);
        this.reviewPage.set(result.meta.current_page - 1);
        this.reviewLastPage.set(result.meta.last_page);
      }
      this.loadingReviewPublicaciones.set(false);
    });
  }

  private page(id: string, filters: {tipo?: string; q?: string; estado?: string}, page: WritableSignal<number>) {
    const request = () => this.publicacionService.libraryPage(id, {...filters, page:page() + 1});
    return request().pipe(switchMap(result => {
      if (page() + 1 <= result.meta.last_page) return of(result);
      page.set(Math.max(0, result.meta.last_page - 1));
      return request();
    }));
  }

  resetReview(): void {
    this.reviewRequests.next(null);
    this.loadingReviewPublicaciones.set(false);
    this.changingReviewStatus.set(null);
  }

  remove(item: ObservatorioPublicacion, refreshReview: boolean) {
    return defer(() => {
      if (!this.belongsToCurrentView(item) || item.capabilities?.can_delete !== true) return EMPTY;
      return this.inContext(this.publicacionService.delete(item.id)).pipe(tap(() => {
        this.publicaciones.update(items => items.filter(row => row.id !== item.id));
        this.reviewPublicaciones.update(items => items.filter(row => row.id !== item.id));
        this.refresh(refreshReview);
      }));
    });
  }

  review(item: ObservatorioPublicacion, state: EstadoPublicacion, body: FormData, refreshReview: boolean) {
    return defer(() => {
      if (!this.belongsToCurrentView(item) || this.changingReviewStatus() || item.capabilities?.can_review !== true) return EMPTY;
      this.changingReviewStatus.set(`${item.id}:${state}`);
      return this.inContext(this.publicacionService.update(item.id, body)).pipe(tap(updated => {
        this.publicaciones.update(items => items.map(row => row.id === updated.id ? updated : row));
        this.reviewPublicaciones.update(items => state === 'EN_REVISION'
          ? items.map(row => row.id === updated.id ? updated : row) : items.filter(row => row.id !== updated.id));
        this.refresh(refreshReview);
      }), finalize(() => this.changingReviewStatus.set(null)));
    });
  }

  sync(type: 'REPORTE' | 'LIBRO') {
    return defer(() => {
      const id = this.departamento()?.id;
      if (!id || this.syncingSharePoint()) return EMPTY;
      this.syncingSharePoint.set(type);
      const request = type === 'REPORTE' ? this.publicacionService.syncSharePointReportes(id)
        : this.publicacionService.syncSharePointAtlas(id);
      return this.inContext(request).pipe(tap(() => this.loadPublicaciones(id)),
        finalize(() => this.syncingSharePoint.set(null)));
    });
  }

  private refresh(review: boolean): void {
    this.retryLibrary();
    if (review && this.departamento()) this.loadReviewPublicaciones(this.departamento()!.id);
  }

  belongsToCurrentView(item: ObservatorioPublicacion): boolean {
    const id = this.departamento()?.id;
    return !!id && (!item.departamento_id || item.departamento_id === id);
  }

  private inContext<T>(request: Observable<T>): Observable<T> {
    return request.pipe(takeUntil(this.contextChanges), takeUntilDestroyed(this.destroyRef));
  }
}
