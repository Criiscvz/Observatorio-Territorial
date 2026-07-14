import { CommonModule } from '@angular/common';
import { Component, DestroyRef, ElementRef, ViewChild, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Dataset, Departamento } from '@core/models';
import {
  ObservatorioPublicacion,
  EstadoPublicacion,
  TipoPublicacion,
} from '@core/models/publicacion/publicacion.interface';
import { AuthService } from '@core/services/auth.service';
import { DatasetService } from '@core/services/dataset.service';
import { DepartamentoService } from '@core/services/departamento.service';
import { PublicacionService } from '@core/services/publicacion.service';
import { SharePointAtlasImportDialogComponent } from '@features/public/public-atlas/sharepoint-atlas-import-dialog.component';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ConfirmDialogComponent } from '@shared/components/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-departamento-detail',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCheckboxModule,
    MatIconModule,
    MatMenuModule,
    MatProgressSpinnerModule,
    MatDialogModule,
    MatSnackBarModule,
    TranslateModule,
  ],
  templateUrl: './departamento-detail.component.html',
  styleUrl: './departamento-detail.component.scss',
})
export class DepartamentoDetailComponent implements OnInit {
  @ViewChild('publicationFormSection') private publicationFormSection?: ElementRef<HTMLElement>;

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly deptoService = inject(DepartamentoService);
  private readonly datasetService = inject(DatasetService);
  private readonly publicacionService = inject(PublicacionService);
  private readonly authService = inject(AuthService);
  private readonly translate = inject(TranslateService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);

  readonly isAdmin = this.authService.isAdmin;
  readonly isEditor = this.authService.isEditor;
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

  readonly publicationForm = this.fb.nonNullable.group({
    tipo: ['ARTICULO' as TipoPublicacion, Validators.required],
    estado: ['PUBLICACION' as EstadoPublicacion, Validators.required],
    solo_suscriptores: [false],
    titulo: ['', [Validators.required, Validators.maxLength(255)]],
    fecha_publicacion: ['', Validators.required],
    link_url: ['', [Validators.required, Validators.pattern(/^https?:\/\/.+/i)]],
    descripcion: ['', Validators.maxLength(3000)],
    autores: ['', Validators.maxLength(1000)],
    fuente: ['', [Validators.required, Validators.maxLength(255)]],
  });

  get articulos(): ObservatorioPublicacion[] {
    return this.publicaciones().filter((item) => item.tipo === 'ARTICULO');
  }

  get reportes(): ObservatorioPublicacion[] {
    return this.publicaciones().filter((item) => item.tipo === 'REPORTE');
  }

  get atlas(): ObservatorioPublicacion[] {
    return this.publicaciones().filter((item) => item.tipo === 'ATLAS');
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

  get isAtlas(): boolean {
    return this.tipo === 'ATLAS';
  }

  get shouldShowPdfUpload(): boolean {
    return this.isArticulo || this.isReporte || this.isAtlas;
  }

  get canManagePublications(): boolean {
    const departamento = this.departamento();
    if (!departamento) return false;

    const hasObservatorioPermission =
      this.canUploadPublications() ||
      ['ADMIN', 'EDITOR'].includes(String(departamento.user_role ?? '').toUpperCase()) ||
      this.authService.hasRoleInDepartamento(departamento.id, ['ADMIN', 'EDITOR']);

    return this.isAdmin() || (this.isEditor() && hasObservatorioPermission);
  }

  get canUploadButtonGroup(): boolean {
    return this.canManagePublications;
  }

  get canChoosePublicationStatus(): boolean {
    return this.isAdmin();
  }

  get panelTitle(): string {
    return this.isEditor() && !this.isAdmin() ? 'Panel de Editor' : 'Panel de Administrador';
  }

  get panelRoleLabel(): string {
    return this.isEditor() && !this.isAdmin() ? 'Editor' : 'Administrador';
  }

  canEditPublication(publicacion: ObservatorioPublicacion): boolean {
    const user = this.authService.user();
    return this.isAdmin() || (this.isEditor() && !!user && publicacion.creado_por === user.id);
  }

  canDeletePublication(publicacion: ObservatorioPublicacion): boolean {
    return this.canEditPublication(publicacion);
  }

  ngOnInit(): void {
    this.route.params.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      if (params['id']) this.loadDepartamento(params['id']);
    });
    this.publicationForm.controls.tipo.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((tipo) => {
        this.configurePublicationValidators(tipo);
        this.fileError.set('');
      });
    this.configurePublicationValidators('ARTICULO');
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
        this.publicaciones.set(items);
        this.loadingPublicaciones.set(false);
      },
      error: () => {
        this.publicaciones.set([]);
        this.loadingPublicaciones.set(false);
      },
    });
  }

  openPublicationForm(tipo: TipoPublicacion): void {
    this.resetPublicationForm(tipo);
    this.configurePublicationValidators(tipo);
    this.showPublicationForm.set(true);
    this.scrollToPublicationForm();
  }

  openReviewPanel(): void {
    this.showReviewPanel.set(true);
    const departamento = this.departamento();
    if (departamento) {
      this.loadReviewPublicaciones(departamento.id);
    }
  }

  closeReviewPanel(): void {
    this.showReviewPanel.set(false);
  }

  loadReviewPublicaciones(id: string): void {
    this.loadingReviewPublicaciones.set(true);
    this.publicacionService.getInReview(id).subscribe({
      next: (items) => {
        this.reviewPublicaciones.set(items);
        this.loadingReviewPublicaciones.set(false);
      },
      error: () => {
        this.reviewPublicaciones.set([]);
        this.loadingReviewPublicaciones.set(false);
        this.snackBar.open('No se pudieron cargar las publicaciones en revisión.', 'Cerrar', {
          duration: 4000,
        });
      },
    });
  }

  closePublicationForm(): void {
    this.showPublicationForm.set(false);
    this.resetPublicationForm();
  }

  editPublication(publicacion: ObservatorioPublicacion): void {
    this.editingPublication.set(publicacion);
    this.publicationForm.reset({
      tipo: publicacion.tipo,
      estado: publicacion.estado ?? 'PUBLICACION',
      solo_suscriptores: !!publicacion.solo_suscriptores,
      titulo: publicacion.titulo,
      fecha_publicacion: publicacion.fecha_publicacion,
      link_url: publicacion.link_url ?? '',
      descripcion: publicacion.descripcion ?? '',
      autores: publicacion.autores ?? '',
      fuente: publicacion.fuente ?? '',
    });
    this.configurePublicationValidators(publicacion.tipo);
    this.selectedFile.set(null);
    this.isDraggingFile.set(false);
    this.fileError.set('');
    this.serverError.set('');
    this.showPublicationForm.set(true);
    this.scrollToPublicationForm();
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

  formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  private validateAndSetFile(file: File, input?: HTMLInputElement): void {
    this.fileError.set('');
    if (file.type !== 'application/pdf' || !file.name.toLowerCase().endsWith('.pdf')) {
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
    this.publicationForm.markAllAsTouched();
    const editing = this.editingPublication();
    const requiresPdf = this.shouldShowPdfUpload;
    if (!editing && requiresPdf && !this.selectedFile()) {
      this.fileError.set('Debe seleccionar un archivo PDF.');
    }
    if (this.publicationForm.invalid || (!editing && requiresPdf && !this.selectedFile())) return;

    const departamento = this.departamento();
    if (!departamento) return;
    const formData = new FormData();
    const values = this.publicationForm.getRawValue();
    Object.entries(values).forEach(([key, value]) => {
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
        this.resetPublicationForm();
        this.showPublicationForm.set(false);
        this.loadPublicaciones(departamento.id);
        if (this.showReviewPanel()) {
          this.loadReviewPublicaciones(departamento.id);
        }
        this.snackBar.open(
          !this.isAdmin()
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
      },
    });
  }

  openPdf(publicacion: ObservatorioPublicacion): void {
    this.publicacionService.openPdf(publicacion).subscribe((opened) => {
      if (!opened) {
        this.snackBar.open('No hay PDF disponible para esta publicación.', 'Cerrar', {
          duration: 3500,
        });
      }
    });
  }

  hasPublicationPdf(publicacion: ObservatorioPublicacion): boolean {
    return !this.isPowerBiReport(publicacion) && !!(publicacion.download_url || publicacion.sharepoint_url);
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
    if (!url) {
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
    if (!this.isAdmin()) {
      this.snackBar.open('Solo ADMIN puede cambiar el estado de revisión.', 'Cerrar', {
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
    this.syncingSharePoint.set('ATLAS');
    this.publicacionService.syncSharePointAtlas(departamento.id).subscribe({
      next: (items) => {
        this.syncingSharePoint.set(null);
        this.loadPublicaciones(departamento.id);
        this.snackBar.open(`PDF de Atlas sincronizados: ${items.length}.`, 'Cerrar', {
          duration: 4000,
        });
      },
      error: (error) => {
        this.syncingSharePoint.set(null);
        this.snackBar.open(error?.error?.message || 'No se pudo sincronizar Atlas.', 'Cerrar', {
          duration: 5000,
        });
      },
    });
  }

  importSharePointAtlas(): void {
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
    return tipo === 'ARTICULO' ? 'Artículo' : tipo === 'REPORTE' ? 'Reporte' : 'Atlas';
  }

  getPublicacionTipoBadge(tipo: TipoPublicacion): string {
    return tipo === 'ARTICULO'
      ? 'Artículos ULEAM'
      : tipo === 'REPORTE'
        ? 'Reportes ULEAM'
        : 'Atlas ULEAM';
  }

  getPublicacionIcon(tipo: TipoPublicacion): string {
    return tipo === 'ARTICULO' ? 'article' : tipo === 'REPORTE' ? 'bar_chart' : 'picture_as_pdf';
  }

  getCodeHint(): string {
    const editing = this.editingPublication();
    if (editing) return `Código: ${editing.codigo}`;
    return `Se generará automáticamente: ${
      this.isArticulo ? 'ART-####' : this.isReporte ? 'REP-####' : 'ATL-####'
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

  deleteDepartamento(): void {
    const depto = this.departamento();
    if (!depto) return;
    const message = this.translate.instant('departamentos.detail.confirmDelete', {
      name: depto.nombre,
    });
    if (confirm(message))
      this.deptoService
        .delete(depto.id)
        .subscribe({ next: () => this.router.navigate(['/admin/dashboard']) });
  }

  deleteDataset(dataset: Dataset): void {
    const message = this.translate.instant('datasets.list.confirmDelete', { name: dataset.nombre });
    if (confirm(message))
      this.datasetService
        .delete(dataset.id)
        .subscribe({ next: () => this.loadDepartamento(this.departamento()!.id) });
  }

  private configurePublicationValidators(tipo: TipoPublicacion): void {
    this.publicationForm.controls.link_url.setValidators([
      ...(tipo === 'ARTICULO' || tipo === 'REPORTE' ? [Validators.required] : []),
      Validators.pattern(/^https?:\/\/.+/i),
    ]);
    this.publicationForm.controls.descripcion.setValidators([
      Validators.required,
      Validators.maxLength(3000),
    ]);
    this.publicationForm.controls.autores.setValidators([
      ...(tipo === 'ARTICULO' ? [Validators.required] : []),
      Validators.maxLength(1000),
    ]);
    this.publicationForm.controls.link_url.updateValueAndValidity();
    this.publicationForm.controls.descripcion.updateValueAndValidity();
    this.publicationForm.controls.autores.updateValueAndValidity();
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
      autores: '',
      fuente: '',
    });
    this.selectedFile.set(null);
    this.isDraggingFile.set(false);
    this.fileError.set('');
    this.serverError.set('');
  }

  private scrollToPublicationForm(): void {
    window.setTimeout(() => {
      const formSection = this.publicationFormSection?.nativeElement;
      if (!formSection) return;

      formSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      this.highlightPublicationForm.set(true);

      window.setTimeout(() => {
        this.highlightPublicationForm.set(false);
      }, 1800);
    }, 100);
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
    formData.append('descripcion', publicacion.descripcion ?? '');
    formData.append('autores', publicacion.autores ?? '');
    formData.append('fuente', publicacion.fuente);

    return formData;
  }
}
