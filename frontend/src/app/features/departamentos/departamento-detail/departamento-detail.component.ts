import { CommonModule } from '@angular/common';
import { Component, computed, DestroyRef, TemplateRef, ViewChild, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, FormArray, FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ActivatedRoute, NavigationStart, Router, RouterLink } from '@angular/router';
import { Dataset, Departamento } from '@core/models';
import {
  ObservatorioPublicacion,
  EstadoPublicacion,
  TipoPublicacion,
} from '@core/models/publicacion/publicacion.interface';
import { AuthService } from '@core/services/auth.service';
import { DatasetService } from '@core/services/dataset.service';
import { DepartamentoService } from '@core/services/departamento.service';
import {
  PublicacionService,
  SharePointImportTarget,
} from '@core/services/publicacion.service';
import { SharePointAtlasImportDialogComponent } from '@features/public/public-atlas/sharepoint-atlas-import-dialog.component';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ConfirmDialogComponent } from '@shared/components/confirm-dialog/confirm-dialog.component';
import { LibraryType, ObservatoryLibraryComponent } from './observatory-library.component';
import { PublicationViewerService } from '@features/public/components/publication-viewer.service';
import { hasPublicPdf, publicHttpUrl, PublicLibraryPublication, toPublicLibraryItem } from '@features/public/components/public-library-publication';

@Component({
  selector: 'app-departamento-detail',
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

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly deptoService = inject(DepartamentoService);
  private readonly datasetService = inject(DatasetService);
  private readonly publicacionService = inject(PublicacionService);
  private readonly publicationViewer = inject(PublicationViewerService);
  private readonly authService = inject(AuthService);
  private readonly translate = inject(TranslateService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);

  readonly isAdmin = this.authService.isAdmin;
  readonly isEditor = this.authService.isEditor;
  readonly libraryType = signal<LibraryType>('ARTICULO');
  readonly canEditLibraryPublication = (item: ObservatorioPublicacion) => this.canEditPublication(item);
  readonly canDeleteLibraryPublication = (item: ObservatorioPublicacion) => this.canDeletePublication(item);
  departamento = signal<Departamento | null>(null);
  datasets = signal<Dataset[]>([]);
  publicaciones = signal<ObservatorioPublicacion[]>([]);
  editingPublication = signal<ObservatorioPublicacion | null>(null);
  loading = signal(true);
  loadingPublicaciones = signal(false);
  loadingReviewPublicaciones = signal(false);
  showPublicationForm = signal(false);
  showReviewPanel = signal(false);
  savingPublication = signal(false);
  changingReviewStatus = signal<string | null>(null);
  syncingSharePoint = signal<TipoPublicacion | null>(null);
  canUploadPublications = signal(false);
  reviewPublicaciones = signal<ObservatorioPublicacion[]>([]);
  selectedFile = signal<File | null>(null);
  isDraggingFile = signal(false);
  fileError = signal('');
  serverError = signal('');
  highlightPublicationForm = signal(false);
  expandedPublicationId = signal<string | null>(null);
  datasetSearchTerm = signal('');
  articleSearchTerm = signal('');
  reportSearchTerm = signal('');
  bookSearchTerm = signal('');
  readonly editorStep = signal(1);
  readonly discardChanges = signal(false);
  readonly discardTarget = signal<'close' | 'review'>('close');
  readonly reviewSelectedId = signal<string | null>(null);
  readonly reviewError = signal('');
  readonly selectedReview = computed(() => this.reviewPublicaciones().find(item => item.id === this.reviewSelectedId()) || this.reviewPublicaciones()[0] || null);

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

  continuePublication(): void {
    this.publicationForm.markAllAsTouched();
    if (this.publicationForm.valid) this.editorStep.set(2);
  }

  submitPublication(): void {
    if (this.editorStep() === 1) this.continuePublication();
    else this.savePublication();
  }

  publicationFieldError(name: 'titulo' | 'fecha_publicacion' | 'link_url' | 'descripcion' | 'fuente'): string {
    const control = this.publicationForm.controls[name];
    if (!control.touched || !control.invalid) return '';
    if (control.hasError('required')) return 'Este campo es obligatorio.';
    if (control.hasError('maxlength')) return `Máximo ${control.errors?.['maxlength'].requiredLength} caracteres.`;
    return name === 'link_url' ? 'Ingresa una URL válida con http o https.' : 'Ingresa un valor válido.';
  }

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

  readonly publicationForm = this.fb.nonNullable.group({
    tipo: ['ARTICULO' as TipoPublicacion, Validators.required],
    estado: ['PUBLICACION' as EstadoPublicacion, Validators.required],
    solo_suscriptores: [false],
    titulo: ['', [Validators.required, (control: AbstractControl) => String(control.value ?? '').trim() ? null : {required:true}, Validators.maxLength(255)]],
    fecha_publicacion: ['', [Validators.required, Validators.pattern(/^\d{4}-\d{2}-\d{2}$/)]],
    link_url: ['', Validators.pattern(/^https?:\/\/.+/i)],
    descripcion: ['', Validators.maxLength(3000)],
    autores: this.fb.nonNullable.array([this.createAutorControl()]),
    fuente: ['', Validators.maxLength(255)],
  });

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
    return this.reviewPublicaciones().length;
  }

  get tipo(): TipoPublicacion {
    return this.publicationForm.controls.tipo.value;
  }

  get isArticulo(): boolean {
    return this.tipo === 'ARTICULO';
  }

  get isReporte(): boolean {
    return this.tipo === 'REPORTE';
  }

  get isLibro(): boolean {
    return this.tipo === 'LIBRO';
  }

  get autores(): FormArray<FormControl<string>> {
    return this.publicationForm.controls.autores;
  }

  get shouldShowPdfUpload(): boolean {
    return this.isArticulo || this.isReporte || this.isLibro || this.tipo === 'ATLAS';
  }

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

  get canChoosePublicationStatus(): boolean {
    return this.authService.canReviewObservatory(this.departamento()?.id);
  }

  get panelTitle(): string {
    return this.isEditor() && !this.isAdmin() ? 'Panel de Editor' : 'Panel de Administrador';
  }

  get panelRoleLabel(): string {
    return this.isEditor() && !this.isAdmin() ? 'Editor' : 'Administrador';
  }

  canEditPublication(publicacion: ObservatorioPublicacion): boolean {
    const user = this.authService.user();
    return this.isAdmin() || (publicacion.tipo !== 'ATLAS' && this.authService.canReviewObservatory(publicacion.departamento_id)) || (this.isEditor() && !!user && publicacion.tipo !== 'ATLAS' && Number(publicacion.creado_por) === user.id);
  }

  canDeletePublication(publicacion: ObservatorioPublicacion): boolean {
    return this.canEditPublication(publicacion);
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
    this.publicationForm.controls.tipo.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((tipo) => {
        this.configurePublicationValidators(tipo);
        this.fileError.set('');
      });
    this.configurePublicationValidators(this.publicationForm.controls.tipo.value);
  }

  loadDepartamento(id: string): void {
    this.loading.set(true);
    this.deptoService.getById(id).subscribe({
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
    this.publicacionService.canUpload(id).subscribe({
      next: (response) => {
        const canUpload =
          !!response.can_upload ||
          (String(response.role ?? '').toUpperCase() === 'EDITOR' && !!response.has_permission);
        this.canUploadPublications.set(canUpload);
      },
      error: () => this.canUploadPublications.set(false),
    });
  }

  loadPublicaciones(id: string): void {
    this.loadingPublicaciones.set(true);
    this.publicacionService.getAll(id).subscribe({
      next: (items) => {
        const visibleItems = this.isEditor()
          ? items.filter(item => item.tipo !== 'ATLAS' && Number(item.creado_por) === this.authService.user()?.id)
          : items;
        this.publicaciones.set(visibleItems);
        if (!this.showReviewPanel()) this.reviewPublicaciones.set(visibleItems.filter(item => item.estado === 'EN_REVISION'));
        this.loadingPublicaciones.set(false);
        this.applyWorkspaceAction();
      },
      error: () => {
        this.publicaciones.set([]);
        this.loadingPublicaciones.set(false);
      },
    });
  }

  openPublicationForm(tipo: TipoPublicacion): void {
    if (!this.canManagePublications || (!this.isAdmin() && tipo === 'ATLAS')) return;
    this.closeAllObservationForms(tipo);
    this.configurePublicationValidators(tipo);
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
      const item = this.publicaciones().find(publication => publication.id === id);
      if (item && this.canEditPublication(item)) this.editPublication(item);
    }
  }

  openReviewPanel(): void {
    if (!this.canManagePublications || this.savingPublication()) return;
    this.showReviewPanel.set(true);
    this.reviewSelectedId.set(null);
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
    this.showReviewPanel.set(false);
    this.loadingReviewPublicaciones.set(false);
    this.changingReviewStatus.set(null);
    if (clearItems) {
      this.reviewPublicaciones.set([]);
    }
  }

  loadReviewPublicaciones(id: string): void {
    this.loadingReviewPublicaciones.set(true);
    this.reviewError.set('');
    this.publicacionService
      .getInReview(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
      next: (items) => {
        if (!this.showReviewPanel() || this.departamento()?.id !== id) return;
        this.reviewPublicaciones.set(this.isEditor()
          ? items.filter(item => item.tipo !== 'ATLAS' && Number(item.creado_por) === this.authService.user()?.id)
          : items);
        this.loadingReviewPublicaciones.set(false);
      },
      error: () => {
        if (!this.showReviewPanel() || this.departamento()?.id !== id) return;
        this.reviewPublicaciones.set([]);
        this.reviewError.set('No se pudieron cargar las publicaciones en revisión.');
        this.loadingReviewPublicaciones.set(false);
        this.snackBar.open('No se pudieron cargar las publicaciones en revisión.', 'Cerrar', {
          duration: 4000,
        });
      },
      });
  }

  closePublicationForm(): void {
    this.requestOverlayClose();
  }

  closeAllObservationForms(tipo: TipoPublicacion = 'ARTICULO'): void {
    this.editorStep.set(1); this.discardChanges.set(false);
    this.showPublicationForm.set(false);
    this.highlightPublicationForm.set(false);
    this.resetPublicationForm(tipo);
  }

  editPublication(publicacion: ObservatorioPublicacion): void {
    if (!this.canEditPublication(publicacion) || this.savingPublication() || this.changingReviewStatus()) return;
    this.closeAllObservationForms(publicacion.tipo);
    this.editingPublication.set(publicacion);
    this.publicationForm.reset({
      tipo: publicacion.tipo,
      estado: publicacion.estado ?? 'PUBLICACION',
      solo_suscriptores: !!publicacion.solo_suscriptores,
      titulo: publicacion.titulo,
      fecha_publicacion: publicacion.fecha_publicacion,
      link_url: publicacion.link_url ?? '',
      descripcion: publicacion.descripcion ?? '',
      fuente: publicacion.fuente ?? '',
    });
    this.setAutores(publicacion.autores);
    this.configurePublicationValidators(publicacion.tipo);
    this.selectedFile.set(null);
    this.isDraggingFile.set(false);
    this.fileError.set('');
    this.serverError.set('');
    this.showPublicationForm.set(true);
    this.publicationForm.markAsPristine();
    this.openPublicationOverlay();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    if (!file) {
      return;
    }
    this.validateAndSetFile(file, input);
  }

  onFileDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDraggingFile.set(true);
  }

  onFileDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    const target = event.currentTarget as HTMLElement;
    if (!target.contains(event.relatedTarget as Node | null)) {
      this.isDraggingFile.set(false);
    }
  }

  onFileDropped(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDraggingFile.set(false);
    const file = event.dataTransfer?.files?.[0];
    if (file) {
      this.validateAndSetFile(file);
    }
  }

  removeSelectedFile(input: HTMLInputElement, event: Event): void {
    event.stopPropagation();
    input.value = '';
    this.selectedFile.set(null);
    this.fileError.set('');
  }

  agregarAutor(): void {
    this.autores.push(this.createAutorControl());
    this.publicationForm.markAsDirty();
  }

  eliminarAutor(index: number): void {
    this.publicationForm.markAsDirty();
    if (this.autores.length === 1) {
      this.autores.at(0).setValue('');
      return;
    }

    this.autores.removeAt(index);
  }

  formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  private validateAndSetFile(file: File, input?: HTMLInputElement): void {
    if (this.savingPublication()) return;
    this.fileError.set('');
    if ((file.type && !['application/pdf', 'application/x-pdf'].includes(file.type)) || !file.name.toLowerCase().endsWith('.pdf')) {
      this.selectedFile.set(null);
      this.fileError.set('Formato no válido. Solo se permiten archivos PDF.');
      if (input) input.value = '';
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      this.selectedFile.set(null);
      this.fileError.set('El PDF no debe superar los 20 MB.');
      if (input) input.value = '';
      return;
    }
    this.selectedFile.set(file);
  }

  savePublication(): void {
    if (this.savingPublication() || this.changingReviewStatus() || !this.canManagePublications) return;
    this.publicationForm.markAllAsTouched();
    const editing = this.editingPublication();
    const requiresPdf = this.isArticulo || this.isLibro || this.tipo === 'ATLAS';
    if (!editing && requiresPdf && !this.selectedFile()) {
      this.fileError.set('Debe seleccionar un archivo PDF.');
    }
    if (this.publicationForm.invalid) { this.editorStep.set(1); return; }
    if (this.fileError() || (!editing && requiresPdf && !this.selectedFile())) { this.editorStep.set(2); return; }

    const departamento = this.departamento();
    if (!departamento) return;
    const formData = new FormData();
    const values = this.publicationForm.getRawValue();
    Object.entries(values).forEach(([key, value]) => {
      if (key === 'autores') {
        (value as string[])
          .map((autor) => autor.trim())
          .filter(Boolean)
          .forEach((autor) => formData.append('autores[]', autor));
        return;
      }
      if (['descripcion', 'fuente'].includes(key) && !String(value).trim()) {
        return;
      }
      formData.append(key, typeof value === 'boolean' ? (value ? '1' : '0') : String(value));
    });
    if (this.selectedFile()) {
      formData.append('archivo', this.selectedFile()!);
    }

    this.savingPublication.set(true);
    this.serverError.set('');
    const request = editing
      ? this.publicacionService.update(editing.id, formData)
      : this.publicacionService.create(departamento.id, formData);
    request.subscribe({
      next: () => {
        this.savingPublication.set(false);
        this.closeAllObservationForms();
        this.loadPublicaciones(departamento.id);
        if (this.showReviewPanel()) {
          this.loadReviewPublicaciones(departamento.id);
        } else this.finishOverlayClose();
        this.snackBar.open(
          !this.canChoosePublicationStatus
            ? 'Contenido enviado a revisión.'
            : editing
            ? 'Publicación actualizada correctamente.'
            : 'Publicación guardada correctamente.',
          'Cerrar',
          { duration: 4000 },
        );
      },
      error: (error) => {
        this.savingPublication.set(false);
        const errors = error?.error?.errors;
        const first = errors ? Object.values(errors).flat()[0] : null;
        this.serverError.set(
          typeof first === 'string'
            ? first
            : error?.error?.message || 'No se pudo guardar la publicación.',
        );
        if (errors && Object.keys(errors).some(key => key !== 'archivo')) this.editorStep.set(1);
      },
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
    this.publicacionService.openPdf(publicacion).subscribe((opened) => {
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

        this.publicacionService
          .delete(publicacion.id)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: () => {
              this.publicaciones.update((items) => items.filter((item) => item.id !== publicacion.id));
              this.reviewPublicaciones.update((items) =>
                items.filter((item) => item.id !== publicacion.id),
              );
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
    if (!this.canChoosePublicationStatus) {
      this.snackBar.open('No tienes permiso de edición y revisión en este observatorio.', 'Cerrar', {
        duration: 4000,
      });
      return;
    }

    this.changingReviewStatus.set(`${publicacion.id}:${estado}`);
    this.publicacionService.update(publicacion.id, this.buildPublicationFormData(publicacion, estado)).subscribe({
      next: (updated) => {
        this.changingReviewStatus.set(null);
        this.publicaciones.update((items) =>
          items.map((item) => (item.id === updated.id ? updated : item)),
        );
        this.reviewPublicaciones.update((items) =>
          estado === 'EN_REVISION'
            ? items.map((item) => (item.id === updated.id ? updated : item))
            : items.filter((item) => item.id !== updated.id),
        );
        this.snackBar.open(`Estado cambiado a ${this.getEstadoPublicacionLabel(estado)}.`, 'Cerrar', {
          duration: 3500,
        });
      },
      error: (error) => {
        this.changingReviewStatus.set(null);
        this.snackBar.open(error?.error?.message || 'No se pudo cambiar el estado.', 'Cerrar', {
          duration: 4500,
        });
      },
    });
  }

  syncSharePointReportes(): void {
    const departamento = this.departamento();
    if (!departamento || this.syncingSharePoint()) return;
    this.syncingSharePoint.set('REPORTE');
    this.publicacionService.syncSharePointReportes(departamento.id).subscribe({
      next: (items) => {
        this.syncingSharePoint.set(null);
        this.loadPublicaciones(departamento.id);
        this.snackBar.open(`Reportes Power BI sincronizados: ${items.length}.`, 'Cerrar', {
          duration: 4000,
        });
      },
      error: (error) => {
        this.syncingSharePoint.set(null);
        this.snackBar.open(error?.error?.message || 'No se pudo sincronizar Power BI.', 'Cerrar', {
          duration: 5000,
        });
      },
    });
  }

  syncSharePointAtlas(): void {
    const departamento = this.departamento();
    if (!departamento || this.syncingSharePoint()) return;
    this.syncingSharePoint.set('LIBRO');
    this.publicacionService.syncSharePointAtlas(departamento.id).subscribe({
      next: (items) => {
        this.syncingSharePoint.set(null);
        this.loadPublicaciones(departamento.id);
        this.snackBar.open(`PDF de Libros sincronizados: ${items.length}.`, 'Cerrar', {
          duration: 4000,
        });
      },
      error: (error) => {
        this.syncingSharePoint.set(null);
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
        if (!result) return;
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

  private configurePublicationValidators(tipo: TipoPublicacion): void {
    this.publicationForm.controls.link_url.setValidators([
      ...(tipo === 'REPORTE' ? [Validators.required] : []),
      control => {
        if (!control.value) return null;
        try { return ['http:', 'https:'].includes(new URL(control.value).protocol) ? null : {url:true}; }
        catch { return {url:true}; }
      },
      Validators.maxLength(2048),
    ]);
    this.publicationForm.controls.descripcion.setValidators([Validators.maxLength(3000)]);
    this.publicationForm.controls.link_url.updateValueAndValidity();
    this.publicationForm.controls.descripcion.updateValueAndValidity();
  }

  private resetPublicationForm(tipo: TipoPublicacion = 'ARTICULO'): void {
    this.editingPublication.set(null);
    this.publicationForm.reset({
      tipo,
      estado: 'PUBLICACION',
      solo_suscriptores: false,
      titulo: '',
      fecha_publicacion: '',
      link_url: '',
      descripcion: '',
      fuente: '',
    });
    this.setAutores([]);
    this.selectedFile.set(null);
    this.isDraggingFile.set(false);
    this.fileError.set('');
    this.serverError.set('');
  }

  private buildPublicationFormData(
    publicacion: ObservatorioPublicacion,
    estado: EstadoPublicacion,
  ): FormData {
    const formData = new FormData();
    formData.append('tipo', publicacion.tipo);
    formData.append('estado', estado);
    formData.append('solo_suscriptores', publicacion.solo_suscriptores ? '1' : '0');
    formData.append('titulo', publicacion.titulo);
    formData.append('fecha_publicacion', publicacion.fecha_publicacion);
    formData.append('link_url', publicacion.link_url ?? '');
    this.appendOptionalFormValue(formData, 'descripcion', publicacion.descripcion);
    this.normalizeAutores(publicacion.autores).forEach((autor) => formData.append('autores[]', autor));
    this.appendOptionalFormValue(formData, 'fuente', publicacion.fuente);

    return formData;
  }

  private appendOptionalFormValue(formData: FormData, key: string, value: string | null | undefined): void {
    if (value?.trim()) {
      formData.append(key, value);
    }
  }

  private createAutorControl(value = ''): FormControl<string> {
    return this.fb.nonNullable.control(value, Validators.maxLength(255));
  }

  private setAutores(value: string[] | string | null | undefined): void {
    this.autores.clear();
    const autores = this.normalizeAutores(value);
    (autores.length ? autores : ['']).forEach((autor) => this.autores.push(this.createAutorControl(autor)));
  }

  private normalizeAutores(value: string[] | string | null | undefined): string[] {
    const autores = Array.isArray(value) ? value : value ? [value] : [];

    return autores.map((autor) => autor.trim()).filter(Boolean);
  }
}
