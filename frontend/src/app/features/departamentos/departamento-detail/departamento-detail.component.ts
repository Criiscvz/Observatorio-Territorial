import { PublicationEditorFacade } from './publication-editor.facade';
import { ObservatoryWorkspaceFacade } from './observatory-workspace.facade';
import { CommonModule } from '@angular/common';
import { Component, computed, DestroyRef, TemplateRef, ViewChild, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';
import { ReactiveFormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ActivatedRoute, NavigationStart, Router, RouterLink } from '@angular/router';
import { Dataset } from '@core/models';
import {
  ObservatorioPublicacion,
  EstadoPublicacion,
  TipoPublicacion,
  requiresReviewObservation,
} from '@core/models/publicacion/publicacion.interface';
import { DatasetService } from '@core/services/dataset.service';
import { DepartamentoService } from '@core/services/departamento.service';
import {
  PublicacionService,
  SharePointImportTarget,
} from '@core/services/publicacion.service';
import { SharePointAtlasImportDialogComponent } from '@features/public/public-atlas/sharepoint-atlas-import-dialog.component';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ConfirmDialogComponent } from '@shared/components/confirm-dialog/confirm-dialog.component';
import { LibraryFilters, ObservatoryLibraryComponent } from './observatory-library.component';
import { PublicationViewerService } from '@features/public/components/publication-viewer.service';
import { hasPublicPdf, publicHttpUrl, PublicLibraryPublication, toPublicLibraryItem } from '@features/public/components/public-library-publication';

@Component({
  selector: 'app-departamento-detail',
  providers: [ObservatoryWorkspaceFacade, PublicationEditorFacade],
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    ReactiveFormsModule,
    MatIconModule,
    MatMenuModule,
    MatProgressSpinnerModule,
    MatDialogModule,
    MatSnackBarModule,
    TranslateModule,
    ObservatoryLibraryComponent,
  ],
  templateUrl: './departamento-detail.component.html',
  styleUrls: ['./departamento-detail.component.scss', './publication-dialog.scss'],
})
export class DepartamentoDetailComponent implements OnInit {
  @ViewChild('publicationOverlay', {static:true}) private publicationOverlay?: TemplateRef<unknown>;
  private publicationDialog?: MatDialogRef<unknown>;

  private readonly workspace = inject(ObservatoryWorkspaceFacade);
  private readonly editor = inject(PublicationEditorFacade);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly deptoService = inject(DepartamentoService);
  private readonly datasetService = inject(DatasetService);
  private readonly publicacionService = inject(PublicacionService);
  private readonly publicationViewer = inject(PublicationViewerService);

  private readonly translate = inject(TranslateService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  readonly isAdmin = this.workspace.isAdmin;
  readonly isEditor = this.workspace.isEditor;
  readonly libraryType = this.workspace.libraryType;
  readonly libraryQuery = this.workspace.libraryQuery;
  readonly libraryPage = this.workspace.libraryPage;
  readonly libraryTotal = this.workspace.libraryTotal;
  readonly libraryCounts = this.workspace.libraryCounts;
  readonly libraryError = this.workspace.libraryError;
  readonly reviewTotal = this.workspace.reviewTotal;
  readonly reviewPage = this.workspace.reviewPage;
  readonly reviewLastPage = this.workspace.reviewLastPage;

  private workspaceEditRequest?: Subscription;
  readonly canEditLibraryPublication = (item: ObservatorioPublicacion) => this.canEditPublication(item);
  readonly canDeleteLibraryPublication = (item: ObservatorioPublicacion) => this.canDeletePublication(item);
  readonly departamento = this.workspace.departamento;
  readonly datasets = this.workspace.datasets;
  readonly publicaciones = this.workspace.publicaciones;
  readonly editingPublication = this.editor.editingPublication;
  readonly loading = this.workspace.loading;
  readonly loadingPublicaciones = this.workspace.loadingPublicaciones;
  readonly loadingReviewPublicaciones = this.workspace.loadingReviewPublicaciones;
  showPublicationForm = signal(false);
  showReviewPanel = signal(false);
  readonly savingPublication = this.editor.savingPublication;
  readonly changingReviewStatus = this.workspace.changingReviewStatus;
  readonly syncingSharePoint = this.workspace.syncingSharePoint;
  readonly canUploadPublications = this.workspace.canUploadPublications;
  readonly reviewPublicaciones = this.workspace.reviewPublicaciones;
  readonly selectedFile = this.editor.selectedFile;
  readonly isDraggingFile = this.editor.isDraggingFile;
  readonly fileError = this.editor.fileError;
  readonly serverError = this.editor.serverError;
  highlightPublicationForm = signal(false);
  expandedPublicationId = signal<string | null>(null);
  datasetSearchTerm = signal('');
  articleSearchTerm = signal('');
  reportSearchTerm = signal('');
  bookSearchTerm = signal('');
  readonly editorStep = this.editor.editorStep;
  readonly discardChanges = signal(false);
  readonly discardTarget = signal<'close' | 'review'>('close');
  readonly reviewSelectedId = this.workspace.reviewSelectedId;
  readonly reviewError = this.workspace.reviewError;
  readonly selectedReview = this.workspace.selectedReview;

  constructor() {
    this.destroyRef.onDestroy(() => this.publicationDialog?.close());
  }

  private openPublicationOverlay(): void {
    if (this.publicationDialog || !this.publicationOverlay) return;
    const ref = this.dialog.open(this.publicationOverlay, {
      width:'960px', maxWidth:'calc(100vw - 24px)',
      height:'calc(100dvh - 24px)', maxHeight:'820px',
      panelClass:'publication-workspace-dialog', backdropClass:'publication-workspace-backdrop',
      disableClose:true, autoFocus:'first-tabbable', restoreFocus:true,
      ariaLabel:'Revisión y edición de publicaciones',
    });
    this.publicationDialog = ref;
    ref.backdropClick().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.requestOverlayClose());
    ref.keydownEvents().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(event => {
      if (event.key === 'Escape') { event.preventDefault(); this.requestOverlayClose(); }
    });
    ref.afterClosed().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      if (this.publicationDialog !== ref) return;
      this.publicationDialog = undefined; this.closeAllObservationForms(); this.resetReviewPanel();
    });
  }

  private finishOverlayClose(): void {
    const ref = this.publicationDialog; this.publicationDialog = undefined;
    ref?.close(); this.closeAllObservationForms(); this.resetReviewPanel();
  }

  requestOverlayClose(): void {
    if (this.savingPublication() || this.changingReviewStatus()) return;
    if (this.showPublicationForm() && (this.publicationForm.dirty || this.selectedFile())) {
      this.discardTarget.set('close'); this.discardChanges.set(true); return;
    }
    this.finishOverlayClose();
  }

  returnToReview(): void {
    if (this.savingPublication()) return;
    if (this.publicationForm.dirty || this.selectedFile()) {
      this.discardTarget.set('review'); this.discardChanges.set(true); return;
    }
    this.closeAllObservationForms();
  }

  confirmDiscard(): void {
    if (this.discardTarget() === 'review') this.closeAllObservationForms();
    else this.finishOverlayClose();
  }

  continuePublication(): void { return this.editor.continuePublication(); }

  get needsReviewObservation() { return this.editor.needsReviewObservation; }

  submitPublication(): void {
    if (this.editorStep() === 1) this.continuePublication();
    else this.savePublication();
  }

  publicationFieldError(name: 'titulo' | 'fecha_publicacion' | 'link_url' | 'descripcion' | 'fuente' | 'observacion_revision'): string { return this.editor.publicationFieldError(name); }

  filteredDatasets = computed(() => {
    const term = this.normalizeSearch(this.datasetSearchTerm());
    if (!term) return this.datasets();

    return this.datasets().filter((dataset) =>
      [dataset.nombre, dataset.descripcion, dataset.nombre_archivo, dataset.estado].some((value) =>
        this.normalizeSearch(value).includes(term),
      ),
    );
  });

  filteredArticulos = computed(() => this.filterPublications(this.articulos, this.articleSearchTerm()));
  filteredReportes = computed(() => this.filterPublications(this.reportes, this.reportSearchTerm()));
  filteredLibros = computed(() => this.filterPublications(this.libros, this.bookSearchTerm()));

  readonly publicationForm = this.editor.publicationForm;

  get articulos(): ObservatorioPublicacion[] {
    return this.publicaciones().filter((item) => item.tipo === 'ARTICULO');
  }

  get reportes(): ObservatorioPublicacion[] {
    return this.publicaciones().filter((item) => item.tipo === 'REPORTE');
  }

  get libros(): ObservatorioPublicacion[] {
    return this.publicaciones().filter((item) => item.tipo === 'LIBRO');
  }

  get reviewCount(): number {
    return this.reviewTotal();
  }

  get tipo() { return this.editor.tipo; }

  get isArticulo() { return this.editor.isArticulo; }

  get isReporte() { return this.editor.isReporte; }

  get isLibro() { return this.editor.isLibro; }

  get autores() { return this.editor.autores; }

  get shouldShowPdfUpload() { return this.editor.shouldShowPdfUpload; }

  get canManagePublications(): boolean { return this.workspace.canManagePublications; }

  get canUploadButtonGroup(): boolean { return this.workspace.canUploadButtonGroup; }

  get canChoosePublicationStatus() { return this.editor.canChoosePublicationStatus; }

  get panelTitle(): string {
    return this.isEditor() && !this.isAdmin() ? 'Panel de Editor' : 'Panel de Administrador';
  }

  get panelRoleLabel(): string {
    return this.isEditor() && !this.isAdmin() ? 'Editor' : 'Administrador';
  }

  canEditPublication(publicacion: ObservatorioPublicacion): boolean {
    return publicacion.capabilities?.can_edit === true;
  }

  canDeletePublication(publicacion: ObservatorioPublicacion): boolean {
    return publicacion.capabilities?.can_delete === true;
  }

  isPublicationExpanded(publicacion: ObservatorioPublicacion): boolean {
    return this.expandedPublicationId() === publicacion.id;
  }

  togglePublicationDetails(publicacion: ObservatorioPublicacion): void {
    this.expandedPublicationId.update((currentId) =>
      currentId === publicacion.id ? null : publicacion.id,
    );
  }

  clearSearch(section: 'datasets' | 'articles' | 'reports' | 'books'): void {
    const searches = {
      datasets: this.datasetSearchTerm,
      articles: this.articleSearchTerm,
      reports: this.reportSearchTerm,
      books: this.bookSearchTerm,
    };
    searches[section].set('');
  }

  ngOnInit(): void {
    this.workspace.ready.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.applyWorkspaceAction());
    this.workspace.start();
    this.editor.start();
    this.route.queryParamMap?.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.workspaceActionKey = '';
      if (!this.loadingPublicaciones()) this.applyWorkspaceAction();
    });
    this.resetReviewPanel();
    this.closeAllObservationForms();
    this.router.events.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((event) => {
      if (event instanceof NavigationStart) {
        this.finishOverlayClose();
        this.resetReviewPanel();
        this.closeAllObservationForms();
      }
    });
    this.route.params.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      this.resetReviewPanel(true);
      this.closeAllObservationForms();
      if (params['id']) this.loadDepartamento(params['id']);
    });
  }

  loadDepartamento(id: string): void { this.workspaceEditRequest?.unsubscribe(); this.workspace.loadDepartamento(id); }

  loadCanUpload(id: string): void { this.workspace.loadCanUpload(id); }

  loadPublicaciones(id: string): void { this.workspace.loadPublicaciones(id); }

  libraryFiltersChanged(filters: LibraryFilters): void { this.workspace.libraryFiltersChanged(filters); }
  retryLibrary(): void { this.workspace.retryLibrary(); }

  openPublicationForm(tipo: TipoPublicacion): void {
    if (!this.canManagePublications || (!this.isAdmin() && tipo === 'ATLAS')) return;
    this.closeAllObservationForms(tipo);
    this.editor.configurePublicationValidators(tipo);
    this.showPublicationForm.set(true);
    this.openPublicationOverlay();
  }

  private workspaceActionKey = '';
  private applyWorkspaceAction(): void {
    const params = this.route.snapshot?.queryParamMap;
    if (!params || !this.canManagePublications) return;
    const type = params.get('nuevo');
    const id = params.get('editar_publicacion');
    const key = `${this.departamento()?.id}:${type || ''}:${id || ''}`;
    if (key === this.workspaceActionKey) return;
    this.workspaceActionKey = key;
    if (type && ['ARTICULO','REPORTE','LIBRO'].includes(type)) this.openPublicationForm(type as TipoPublicacion);
    else if (id) {
      const departmentId=this.departamento()!.id;
      this.workspaceEditRequest?.unsubscribe();
      this.workspaceEditRequest=this.publicacionService.libraryById(departmentId,id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next:item=>{if(this.departamento()?.id===departmentId&&this.canEditPublication(item))this.editPublication(item);},
        error:()=>this.snackBar.open('La publicación no está disponible o ya no tienes acceso.','Cerrar',{duration:4500}),
      });
    }
  }

  openReviewPanel(): void {
    if (!this.canManagePublications || this.savingPublication()) return;
    this.showReviewPanel.set(true);
    this.reviewSelectedId.set(null);
    this.reviewPage.set(0);
    this.openPublicationOverlay();
    const departamento = this.departamento();
    if (departamento) {
      this.loadReviewPublicaciones(departamento.id);
    }
  }

  closeReviewPanel(): void {
    this.requestOverlayClose();
  }

  private resetReviewPanel(clearItems = false): void {
    this.workspace.resetReview();
    this.showReviewPanel.set(false);
    this.loadingReviewPublicaciones.set(false);
    this.changingReviewStatus.set(null);
    if (clearItems) {
      this.reviewPublicaciones.set([]);
    }
  }

  loadReviewPublicaciones(id: string): void { this.workspace.loadReviewPublicaciones(id); }

  changeReviewPage(delta: number): void { this.workspace.changeReviewPage(delta); }

  closePublicationForm(): void {
    this.requestOverlayClose();
  }

  closeAllObservationForms(tipo: TipoPublicacion = 'ARTICULO'): void {
    this.editorStep.set(1); this.discardChanges.set(false);
    this.showPublicationForm.set(false);
    this.highlightPublicationForm.set(false);
    this.editor.resetPublicationForm(tipo);
  }

  editPublication(publicacion: ObservatorioPublicacion): void {
    if (!this.editor.edit(publicacion)) return;
    this.editorStep.set(1); this.discardChanges.set(false); this.highlightPublicationForm.set(false);
    this.showPublicationForm.set(true); this.openPublicationOverlay();
  }

  onFileSelected(event: Event): void { return this.editor.onFileSelected(event); }

  onFileDragOver(event: DragEvent): void { return this.editor.onFileDragOver(event); }

  onFileDragLeave(event: DragEvent): void { return this.editor.onFileDragLeave(event); }

  onFileDropped(event: DragEvent): void { return this.editor.onFileDropped(event); }

  removeSelectedFile(input: HTMLInputElement, event: Event): void { return this.editor.removeSelectedFile(input, event); }

  agregarAutor(): void { return this.editor.agregarAutor(); }

  eliminarAutor(index: number): void { return this.editor.eliminarAutor(index); }

  formatFileSize(bytes: number): string { return this.editor.formatFileSize(bytes); }

  savePublication(): void {
    const departmentId = this.departamento()?.id;
    const editing = this.editingPublication();
    const canReview = this.canChoosePublicationStatus;
    this.editor.savePublication().subscribe(() => {
      this.closeAllObservationForms();
      if (departmentId) this.loadPublicaciones(departmentId);
      if (this.showReviewPanel() && departmentId) this.loadReviewPublicaciones(departmentId);
      else this.finishOverlayClose();
      this.snackBar.open(!canReview ? 'Contenido enviado a revisión.' : editing
        ? 'Publicación actualizada correctamente.' : 'Publicación guardada correctamente.', 'Cerrar', {duration:4000});
    });
  }

  viewLibraryPublication(publicacion: ObservatorioPublicacion): void {
    if (publicacion.bloqueado || publicacion.tipo === 'ATLAS') return;
    // Management responses already resolve owner/subscriber access and supply
    // the editor's ?context=management URL. Keep that URL intact for the reader.
    const item = toPublicLibraryItem({...publicacion,
      autor: publicacion.autores, nombre_indicador: publicacion.titulo,
      descripcion_indicador: publicacion.descripcion,
    } as ObservatorioPublicacion, publicacion.tipo, true);
    // A SharePoint PDF report has an original source URL, not a Power BI link.
    if (publicacion.sharepoint_file_id && publicacion.link_url === publicacion.sharepoint_url) item.reportUrl = null;
    if (!item.reportUrl && !hasPublicPdf(item)) {
      this.snackBar.open('No hay un recurso disponible para esta publicación.', 'Cerrar', {duration:3500});
      return;
    }
    this.publicationViewer.open(item, this.departamento()?.nombre || '', item.reportUrl ? 'report' : 'pdf');
  }

  openPdf(publicacion: ObservatorioPublicacion): void {
    if (publicacion.bloqueado) return;
    if (publicacion.tipo === 'ARTICULO' || publicacion.tipo === 'LIBRO') {
      this.viewLibraryPublication(publicacion);
      return;
    }
    this.publicacionService.openPdf(publicacion).pipe(takeUntilDestroyed(this.destroyRef)).subscribe((opened) => {
      if (!opened) {
        this.snackBar.open('No hay PDF disponible para esta publicación.', 'Cerrar', {
          duration: 3500,
        });
      }
    });
  }

  get canPreviewEditorPdf(): boolean {
    const current = this.editingPublication();
    return this.showPublicationForm() && (this.isArticulo || this.isLibro) && !current?.bloqueado
      && !!(this.selectedFile() || (current && this.hasPublicationPdf(current)));
  }

  previewEditorPdf(): void {
    if (!this.canPreviewEditorPdf || !this.canManagePublications || this.savingPublication()) return;
    const current = this.editingPublication();
    const file = this.selectedFile();
    const values = this.publicationForm.getRawValue();
    const item: PublicLibraryPublication = {
      id: current?.id || 'local-pdf-preview', type: this.isLibro ? 'LIBRO' : 'ARTICULO',
      title: values.titulo.trim() || file?.name || current?.titulo || 'Documento PDF',
      code: current?.codigo || 'Sin guardar', date: values.fecha_publicacion || null,
      authors: values.autores.map(author => author.trim()).filter(Boolean).join(', '),
      description: values.descripcion, source: values.fuente,
      sourceUrl: publicHttpUrl(values.link_url) || publicHttpUrl(values.fuente), reportUrl: null,
      // Preserve the permission-checked management URL for saved PDFs. A selected
      // replacement stays in this browser and is not uploaded by the reader.
      download_url: file ? null : current?.download_url || null,
      sharepoint_url: file ? null : current?.sharepoint_url || null, locked: false,
    };
    const department = this.departamento()?.nombre || '';
    if (file) this.publicationViewer.open(item, department, 'pdf', undefined, file);
    else this.publicationViewer.open(item, department, 'pdf');
  }

  hasPublicationPdf(publicacion: ObservatorioPublicacion): boolean {
    return !!(publicacion.download_url || publicacion.sharepoint_url);
  }

  isPowerBiReport(publicacion: ObservatorioPublicacion): boolean {
    return (
      publicacion.tipo === 'REPORTE' &&
      !!publicacion.link_url &&
      !!publicacion.sharepoint_file_id &&
      publicacion.fuente?.toLowerCase() === 'sharepoint'
    );
  }

  openSource(publicacion: ObservatorioPublicacion): void {
    const url = publicacion.link_url;
    let validUrl = false;
    try { validUrl = !!url && ['http:', 'https:'].includes(new URL(url).protocol); } catch { /* Missing or invalid source. */ }
    if (!url || !validUrl || publicacion.bloqueado) {
      this.snackBar.open('No hay fuente disponible para esta publicación.', 'Cerrar', {
        duration: 3500,
      });
      return;
    }

    window.open(url, '_blank', 'noopener,noreferrer');
  }

  openReport(publicacion: ObservatorioPublicacion): void {
    this.openSource(publicacion);
  }

  deletePublication(publicacion: ObservatorioPublicacion): void {
    if (!this.canDeletePublication(publicacion)) {
      this.snackBar.open('No tienes permiso para eliminar esta publicación.', 'Cerrar', {
        duration: 4000,
      });
      return;
    }

    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: 'min(92vw, 520px)',
      maxWidth: '92vw',
      panelClass: 'app-confirm-dialog-panel',
      backdropClass: 'app-confirm-dialog-backdrop',
      autoFocus: false,
      restoreFocus: false,
      data: {
        title: 'Eliminar publicación',
        message:
          'Esta acción eliminará permanentemente la publicación y sus archivos asociados. No se puede deshacer.',
        confirmText: 'Eliminar definitivamente',
        cancelText: 'Cancelar',
        confirmColor: 'warn',
        icon: 'delete',
      },
    });

    dialogRef
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((confirmed) => {
        if (!confirmed) return;

        this.workspace.remove(publicacion, this.showReviewPanel())
          .subscribe({
            next: () => {
              this.snackBar.open('Publicación eliminada correctamente.', 'Cerrar', {
                duration: 3500,
              });
            },
            error: (error) => {
              this.snackBar.open(
                error?.error?.message || 'No se pudo eliminar la publicación.',
                'Cerrar',
                { duration: 4500 },
              );
            },
          });
      });
  }

  changeReviewStatus(publicacion: ObservatorioPublicacion, estado: EstadoPublicacion): void {
    if (this.changingReviewStatus() || this.savingPublication()) return;
    if (publicacion.capabilities?.can_review !== true) {
      this.snackBar.open('No tienes permiso de edición y revisión en este observatorio.', 'Cerrar', {
        duration: 4000,
      });
      return;
    }

    if (requiresReviewObservation(estado)) {
      this.editPublication(publicacion);
      this.publicationForm.controls.estado.setValue(estado);
      this.editorStep.set(2);
      return;
    }

    this.workspace.review(publicacion, estado, this.editor.buildPublicationFormData(publicacion, estado), this.showReviewPanel()).subscribe({
      next: () => {
        this.snackBar.open(`Estado cambiado a ${this.getEstadoPublicacionLabel(estado)}.`, 'Cerrar', {
          duration: 3500,
        });
      },
      error: (error) => {
        this.snackBar.open(error?.error?.message || 'No se pudo cambiar el estado.', 'Cerrar', {
          duration: 4500,
        });
      },
    });
  }

  syncSharePointReportes(): void {
    this.workspace.sync('REPORTE').subscribe({
      next: (items) => {
        this.snackBar.open(`Reportes Power BI sincronizados: ${items.length}.`, 'Cerrar', {
          duration: 4000,
        });
      },
      error: (error) => {
        this.snackBar.open(error?.error?.message || 'No se pudo sincronizar Power BI.', 'Cerrar', {
          duration: 5000,
        });
      },
    });
  }

  syncSharePointAtlas(): void {
    this.workspace.sync('LIBRO').subscribe({
      next: (items) => {
        this.snackBar.open(`PDF de Libros sincronizados: ${items.length}.`, 'Cerrar', {
          duration: 4000,
        });
      },
      error: (error) => {
        this.snackBar.open(error?.error?.message || 'No se pudo sincronizar Libros.', 'Cerrar', {
          duration: 5000,
        });
      },
    });
  }

  importSharePointAtlas(): void {
    this.openSharePointImport('libros');
  }

  importSharePointArticulos(): void {
    this.openSharePointImport('articulos');
  }

  importSharePointReportes(): void {
    this.openSharePointImport('reportes');
  }

  private openSharePointImport(target: SharePointImportTarget): void {
    const departamento = this.departamento();
    if (!departamento) return;

    const dialogRef = this.dialog.open(SharePointAtlasImportDialogComponent, {
      width: 'min(96vw, 980px)',
      maxWidth: '96vw',
      panelClass: 'sharepoint-import-dialog-panel',
      backdropClass: 'sharepoint-import-dialog-backdrop',
      autoFocus: false,
      restoreFocus: false,
      data: {
        departamentos: [departamento],
        target,
        context: 'observatorio',
      },
    });

    dialogRef
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => {
        if (!result || this.departamento()?.id !== departamento.id) return;
        const totals = result.totals;
        this.loadPublicaciones(departamento.id);
        this.snackBar.open(
          `${totals.imported} importados, ${totals.duplicates} duplicados, ${totals.rejected} rechazados, ${totals.errors} errores`,
          'Cerrar',
          { duration: 7000 },
        );
      });
  }

  getEstadoClass(estado: string): string {
    return estado === 'COMPLETADO'
      ? 'badge-success'
      : estado === 'PROCESANDO'
        ? 'badge-warning'
        : estado === 'ERROR'
          ? 'badge-error'
          : 'badge-neutral';
  }

  getPublicacionTipoLabel(tipo: TipoPublicacion): string {
    return tipo === 'ARTICULO'
      ? 'Artículo'
      : tipo === 'REPORTE'
        ? 'Reporte'
        : tipo === 'LIBRO'
          ? 'Libro PDF'
          : 'Atlas';
  }

  getPublicacionTipoBadge(tipo: TipoPublicacion): string {
    return tipo === 'ARTICULO'
      ? 'Artículos ULEAM'
      : tipo === 'REPORTE'
        ? 'Reportes ULEAM'
        : tipo === 'LIBRO'
          ? 'Libros ULEAM'
          : 'Atlas ULEAM';
  }

  getPublicacionIcon(tipo: TipoPublicacion): string {
    return tipo === 'ARTICULO'
      ? 'article'
      : tipo === 'REPORTE'
        ? 'bar_chart'
        : tipo === 'LIBRO'
          ? 'picture_as_pdf'
          : 'map';
  }

  getCodeHint(): string {
    const editing = this.editingPublication();
    if (editing) return `Código: ${editing.codigo}`;
    return `Se generará automáticamente: ${
      this.isArticulo ? 'ART-####' : this.isReporte ? 'REP-####' : this.isLibro ? 'LIB-####' : 'ATL-####'
    }`;
  }

  getEstadoPublicacionLabel(estado?: EstadoPublicacion | string | null): string {
    switch (estado) {
      case 'SUSPENDIDO':
        return 'Suspendido';
      case 'EN_REVISION':
        return 'En revisión';
      case 'ARCHIVADO':
        return 'Archivado';
      case 'RECHAZADO':
        return 'Rechazado';
      default:
        return 'Publicación';
    }
  }

  getEstadoPublicacionClass(estado?: EstadoPublicacion | string | null): string {
    return `publication-state state-${(estado || 'PUBLICACION').toString().toLowerCase()}`;
  }

  getEstadoPublicacionIcon(estado?: EstadoPublicacion | string | null): string {
    switch (estado) {
      case 'SUSPENDIDO':
        return 'pause_circle';
      case 'EN_REVISION':
        return 'schedule';
      case 'ARCHIVADO':
        return 'archive';
      case 'RECHAZADO':
        return 'cancel';
      default:
        return 'visibility';
    }
  }

  getDatasetStatusLabel(estado?: string | null): string {
    switch ((estado || '').toUpperCase()) {
      case 'COMPLETADO':
        return 'Completado';
      case 'PROCESANDO':
        return 'Procesando';
      case 'ERROR':
        return 'Error';
      default:
        return 'Pendiente';
    }
  }

  getDatasetStatusIcon(estado?: string | null): string {
    switch ((estado || '').toUpperCase()) {
      case 'COMPLETADO':
        return 'check_circle';
      case 'PROCESANDO':
        return 'sync';
      case 'ERROR':
        return 'error';
      default:
        return 'schedule';
    }
  }

  deleteDepartamento(): void {
    const depto = this.departamento();
    if (!depto) return;

    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: 'min(92vw, 520px)',
      maxWidth: '92vw',
      panelClass: 'app-confirm-dialog-panel',
      backdropClass: 'app-confirm-dialog-backdrop',
      autoFocus: 'first-tabbable',
      restoreFocus: true,
      data: {
        title: 'Eliminar observatorio',
        message: `¿Estás seguro de que deseas eliminar el observatorio “${depto.nombre}”? Esta acción eliminará permanentemente el observatorio y su información asociada. No se puede deshacer.`,
        confirmText: 'Eliminar definitivamente',
        cancelText: 'Cancelar',
        processingText: 'Eliminando...',
        confirmColor: 'warn',
        icon: 'delete_forever',
        confirmAction: () => this.deptoService.delete(depto.id),
        onError: (error: unknown) => {
          const apiError = error as { error?: { message?: string } };
          this.snackBar.open(
            apiError.error?.message || 'No se pudo eliminar el observatorio.',
            'Cerrar',
            { duration: 4500 },
          );
        },
      },
    });

    dialogRef
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((deleted) => {
        if (deleted) this.router.navigate(['/admin/dashboard']);
      });
  }

  deleteDataset(dataset: Dataset): void {
    if (!this.isAdmin()) {
      this.snackBar.open('No tienes permiso para eliminar datasets.', 'Cerrar', {
        duration: 3500,
      });
      return;
    }

    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: 'min(92vw, 520px)',
      maxWidth: '92vw',
      panelClass: 'app-confirm-dialog-panel',
      backdropClass: 'app-confirm-dialog-backdrop',
      autoFocus: false,
      restoreFocus: false,
      data: {
        title: 'Eliminar conjunto de datos',
        message: `Esta acción eliminará permanentemente el conjunto de datos y sus registros asociados. No se puede deshacer. Dataset: ${dataset.nombre}`,
        confirmText: 'Eliminar definitivamente',
        cancelText: 'Cancelar',
        confirmColor: 'warn',
        icon: 'delete_forever',
      },
    });

    dialogRef
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((confirmed) => {
        if (!confirmed) return;

        this.datasetService
          .delete(dataset.id)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: () => {
              this.snackBar.open('Conjunto de datos eliminado correctamente.', 'Cerrar', {
                duration: 3500,
              });
              const departamento = this.departamento();
              if (departamento) this.loadDepartamento(departamento.id);
            },
            error: () => {
              this.snackBar.open('No se pudo eliminar el conjunto de datos.', 'Cerrar', {
                duration: 4000,
              });
            },
          });
      });
  }

  private filterPublications(
    publications: ObservatorioPublicacion[],
    rawTerm: string,
  ): ObservatorioPublicacion[] {
    const term = this.normalizeSearch(rawTerm);
    if (!term) return publications;

    return publications.filter((publication) =>
      [
        publication.codigo,
        publication.titulo,
        publication.descripcion,
        publication.fuente,
        publication.autores,
        publication.creador?.name,
      ].some((value) => this.normalizeSearch(value).includes(term)),
    );
  }

  private normalizeSearch(value?: string | string[] | null): string {
    return (Array.isArray(value) ? value.join(' ') : value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

}
