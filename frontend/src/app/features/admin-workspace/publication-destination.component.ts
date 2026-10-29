import { Component, DestroyRef, ElementRef, HostListener, OnInit, ViewChild, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Observable, finalize, map, shareReplay, take } from 'rxjs';
import { Departamento } from '@core/models';
import { EstadoPublicacion, ObservatorioPublicacion, requiresReviewObservation } from '@core/models/publicacion/publicacion.interface';
import { DepartamentoService } from '@core/services/departamento.service';
import { AuthService } from '@core/services/auth.service';
import { PublicacionService, SharePointImportTarget } from '@core/services/publicacion.service';
import { SharePointAtlasImportDialogComponent } from '@features/public/public-atlas/sharepoint-atlas-import-dialog.component';
import { ConfirmDialogComponent } from '@shared/components/confirm-dialog/confirm-dialog.component';
import { PublicLibraryPublication, publicHttpUrl } from '@features/public/components/public-library-publication';
import { powerBiEmbedUrl } from '@features/public/components/publication-viewer.component';
import { PublicationViewerService } from '@features/public/components/publication-viewer.service';

type WorkspaceType = 'ARTICULO' | 'LIBRO' | 'REPORTE';
interface Destination { tipo: WorkspaceType; departamento: Departamento; }
const nonBlank = (control: AbstractControl) => String(control.value ?? '').trim() ? null : { required: true };
const publicationType = (control: AbstractControl) => ['ARTICULO', 'LIBRO', 'REPORTE'].includes(control.value) ? null : { invalidType: true };
const optionalHttpUrl = (control: AbstractControl) => {
  if (!control.value) return null;
  try { return ['http:', 'https:'].includes(new URL(control.value).protocol) ? null : { url: true }; }
  catch { return { url: true }; }
};

@Component({
  selector: 'app-publication-destination', standalone: true,
  imports: [RouterLink, MatIconModule, ReactiveFormsModule],
  templateUrl: './publication-destination.component.html',
  styleUrl: './publication-destination.component.scss',
})
export class PublicationDestinationComponent implements OnInit {
  readonly auth = inject(AuthService);
  readonly isAdmin = this.auth.isAdmin;
  canChooseStatus(): boolean { return this.auth.canReviewObservatory(this.destination()?.departamento.id); }
  private readonly departments = inject(DepartamentoService);
  private readonly publications = inject(PublicacionService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);
  private readonly dialog = inject(MatDialog);
  private readonly viewer = inject(PublicationViewerService);
  @ViewChild('editor') private editor?: ElementRef<HTMLElement>;
  @ViewChild('pdfInput') private pdfInput?: ElementRef<HTMLInputElement>;
  private leaveConfirmation?: Observable<boolean>;

  readonly types: Record<WorkspaceType, string> = { ARTICULO: 'Artículo', LIBRO: 'Libro PDF', REPORTE: 'Reporte Power BI' };
  readonly form = this.fb.nonNullable.group({ tipo: ['ARTICULO', publicationType], departamento: ['', Validators.required] });
  readonly publicationForm = this.fb.nonNullable.group({
    titulo: ['', [nonBlank, Validators.maxLength(255)]],
    fecha_publicacion: ['', [Validators.required, Validators.pattern(/^\d{4}-\d{2}-\d{2}$/)]],
    link_url: ['', [optionalHttpUrl, Validators.maxLength(2048)]],
    descripcion: ['', Validators.maxLength(3000)],
    fuente: ['', Validators.maxLength(255)],
    autores: this.fb.nonNullable.array([this.fb.nonNullable.control('', Validators.maxLength(255))]),
    estado: ['PUBLICACION' as EstadoPublicacion, [Validators.required, Validators.pattern(/^(PUBLICACION|EN_REVISION|SUSPENDIDO|ARCHIVADO|RECHAZADO)$/)]],
    observacion_revision: ['', Validators.maxLength(2000)],
    solo_suscriptores: [false],
  });
  readonly observatories = signal<Departamento[]>([]);
  readonly loading = signal(true);
  readonly error = signal(false);
  readonly destination = signal<Destination | null>(null);
  readonly step = signal(1);
  readonly selectedFile = signal<File | null>(null);
  readonly dragging = signal(false);
  readonly fileError = signal('');
  readonly serverError = signal('');
  readonly fieldErrors = signal<Record<string, string>>({});
  readonly saving = signal(false);
  readonly confirmClose = signal(false);
  readonly savedPublication = signal<ObservatorioPublicacion | null>(null);
  readonly importMessage = signal('');
  readonly importFailed = signal(false);
  readonly importing = signal(false);
  get autores() { return this.publicationForm.controls.autores; }
  get needsReviewObservation() { return this.canChooseStatus() && requiresReviewObservation(this.publicationForm.controls.estado.value); }
  private configureReviewObservation(): void {
    const control = this.publicationForm.controls.observacion_revision;
    control.setValidators([Validators.maxLength(2000), ...(this.needsReviewObservation ? [nonBlank] : [])]);
    control.updateValueAndValidity({emitEvent:false});
  }
  get isReport() { return this.destination()?.tipo === 'REPORTE'; }
  get destinationLabel() { const value = this.destination(); return value ? this.types[value.tipo] : ''; }
  get canPreviewPdf(): boolean {
    return !!this.destination() && !this.isReport && !!this.selectedFile() && !this.fileError()
      && !this.saving() && !this.importing() && !this.savedPublication();
  }
  get reportPreviewUrl(): string | null { return this.isReport ? powerBiEmbedUrl(this.publicationForm.controls.link_url.value.trim()) : null; }
  get canPreviewReport(): boolean {
    return !!this.reportPreviewUrl && !this.saving() && !this.importing() && !this.savedPublication();
  }
  preview(): void {
    const target = this.destination();
    if (!target || (this.isReport ? !this.canPreviewReport : !this.canPreviewPdf)) return;
    const values = this.publicationForm.getRawValue();
    const file = this.isReport ? null : this.selectedFile();
    const item: PublicLibraryPublication = {
      id: 'workspace-publication-preview', type: target.tipo,
      title: values.titulo.trim() || file?.name || 'Vista previa del reporte',
      code: 'Sin guardar', date: values.fecha_publicacion || null,
      authors: values.autores.map(author => author.trim()).filter(Boolean).join(', '),
      description: values.descripcion.trim(), source: values.fuente.trim(),
      sourceUrl: this.isReport ? publicHttpUrl(values.fuente) : publicHttpUrl(values.link_url) || publicHttpUrl(values.fuente),
      reportUrl: this.reportPreviewUrl, download_url: null, sharepoint_url: null, locked: false,
    };
    if (file) this.viewer.open(item, target.departamento.nombre, 'pdf', undefined, file);
    else this.viewer.open(item, target.departamento.nombre, 'report');
  }

  ngOnInit(): void {
    const tipo = this.route.snapshot.queryParamMap.get('tipo');
    if (tipo && ['ARTICULO', 'LIBRO', 'REPORTE'].includes(tipo)) this.form.controls.tipo.setValue(tipo);
    const departamento = this.route.snapshot.queryParamMap.get('departamento');
    if (departamento) this.form.controls.departamento.setValue(departamento);
    this.publicationForm.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => { this.fieldErrors.set({}); this.configureReviewObservation(); });
    this.load();
  }

  load(): void {
    if (this.destination()) return;
    this.loading.set(true); this.error.set(false);
    this.departments.getAll().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: items => {
        items = this.auth.user()?.rol === 'ADMIN_OBSERVATORIO' ? items.filter(item => this.auth.canReviewObservatory(item.id)) : items;
        this.observatories.set(items); this.loading.set(false);
        if (!items.some(item => item.id === this.form.controls.departamento.value)) this.form.controls.departamento.setValue(items.length === 1 ? items[0].id : '');
      },
      error: () => { this.error.set(true); this.loading.set(false); },
    });
  }

  openForm(): void {
    if (this.destination() || this.loading() || this.error()) return;
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const department = this.observatories().find(item => item.id === this.form.controls.departamento.value);
    if (!department) { this.form.controls.departamento.setErrors({ required: true }); return; }
    const tipo = this.form.controls.tipo.value as WorkspaceType;
    this.destination.set({ tipo, departamento: department });
    this.form.disable();
    this.resetEditor();
    this.focusEditor();
  }

  private focusEditor(): void {
    setTimeout(() => {
      const element = this.editor?.nativeElement;
      const input = element?.querySelector<HTMLInputElement>('input:not([type=file])');
      input?.focus({ preventScroll: true });
      if (element && typeof window !== 'undefined' && window.innerWidth < 640) {
        element.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
      }
    });
  }

  resetEditor(): void {
    this.publicationForm.reset({ titulo: '', fecha_publicacion: '', link_url: '', descripcion: '', fuente: '', estado: this.canChooseStatus() ? 'PUBLICACION' : 'EN_REVISION', solo_suscriptores: false });
    this.autores.clear(); this.autores.push(this.fb.nonNullable.control('', Validators.maxLength(255)));
    this.publicationForm.controls.link_url.setValidators([...(this.isReport ? [nonBlank] : []), optionalHttpUrl, Validators.maxLength(2048)]);
    this.publicationForm.controls.link_url.updateValueAndValidity();
    this.publicationForm.markAsPristine();
    this.step.set(1); this.clearFile(); this.fieldErrors.set({}); this.serverError.set('');
    this.savedPublication.set(null); this.importMessage.set(''); this.importFailed.set(false); this.confirmClose.set(false);
  }

  hasUnsavedChanges(): boolean {
    return !!this.destination() && !this.savedPublication() && (this.publicationForm.dirty || !!this.selectedFile());
  }
  requestClose(): void {
    if (this.saving() || this.importing()) return;
    if (this.hasUnsavedChanges()) this.confirmClose.set(true);
    else this.closeForm();
  }
  closeForm(): void {
    if (this.saving() || this.importing()) return;
    this.resetEditor(); this.destination.set(null); this.form.enable();
  }
  createAnother(): void { this.resetEditor(); this.focusEditor(); }
  canLeave(): boolean | Observable<boolean> {
    if (this.saving() || this.importing()) return false;
    if (!this.hasUnsavedChanges()) return true;
    if (!this.leaveConfirmation) {
      this.leaveConfirmation = this.dialog.open(ConfirmDialogComponent, {
        width: 'min(92vw, 520px)', panelClass: 'app-confirm-dialog-panel', backdropClass: 'app-confirm-dialog-backdrop',
        data: { title: '¿Salir sin guardar?', message: 'La publicación aún no se ha guardado. Si sales, perderás los cambios.', confirmText: 'Salir sin guardar', cancelText: 'Seguir editando', icon: 'edit_note' },
      }).afterClosed().pipe(take(1), map(value => value === true), finalize(() => this.leaveConfirmation = undefined), shareReplay({ bufferSize: 1, refCount: true }));
    }
    return this.leaveConfirmation;
  }
  @HostListener('window:beforeunload', ['$event'])
  beforeUnload(event: BeforeUnloadEvent): void {
    if (this.saving() || this.importing() || this.hasUnsavedChanges()) { event.preventDefault(); event.returnValue = ''; }
  }
  addAuthor(): void { if (!this.saving()) this.autores.push(this.fb.nonNullable.control('', Validators.maxLength(255))); }
  removeAuthor(index: number): void {
    if (this.saving()) return;
    if (this.autores.length === 1) this.autores.at(0).setValue(''); else this.autores.removeAt(index);
    this.publicationForm.markAsDirty();
  }

  goToStep(value: number): void {
    if (this.saving()) return;
    if (value === 2 && !this.validateInformation()) return;
    this.step.set(value === 2 ? 2 : 1);
  }
  private validateInformation(): boolean {
    const names = ['titulo', 'fecha_publicacion', 'link_url', 'descripcion', 'fuente', 'autores'] as const;
    names.forEach(name => this.publicationForm.controls[name].markAllAsTouched());
    return names.every(name => this.publicationForm.controls[name].valid);
  }
  fieldError(name: string): string {
    if (this.fieldErrors()[name]) return this.fieldErrors()[name];
    const control = this.publicationForm.get(name);
    if (!control?.touched || !control.invalid) return '';
    if (control.hasError('required')) return 'Este campo es obligatorio.';
    if (control.hasError('maxlength')) return `Máximo ${control.getError('maxlength').requiredLength} caracteres.`;
    if (name === 'link_url') return 'Ingresa una URL válida con http o https.';
    if (name === 'fecha_publicacion') return 'Ingresa una fecha válida.';
    return 'Revisa este campo.';
  }

  onFileSelected(event: Event): void { this.selectFile((event.target as HTMLInputElement).files?.[0]); }
  onDrop(event: DragEvent): void { event.preventDefault(); this.dragging.set(false); this.selectFile(event.dataTransfer?.files[0]); }
  onDragOver(event: DragEvent): void { event.preventDefault(); if (!this.saving()) this.dragging.set(true); }
  selectFile(file?: File): void {
    if (!file || this.saving()) return;
    this.fileError.set(''); this.fieldErrors.update(errors => { const { archivo, ...rest } = errors; return rest; });
    if (!['application/pdf', 'application/x-pdf'].includes(file.type) || !file.name.toLowerCase().endsWith('.pdf')) this.fileError.set('Formato no válido. Solo se permiten archivos PDF.');
    else if (file.size > 20 * 1024 * 1024) this.fileError.set('El PDF no debe superar los 20 MB.');
    this.selectedFile.set(this.fileError() ? null : file);
    if (this.fileError() && this.pdfInput) this.pdfInput.nativeElement.value = '';
  }
  clearFile(): void {
    if (this.saving()) return;
    this.selectedFile.set(null); this.fileError.set('');
    this.fieldErrors.update(errors => { const { archivo, ...rest } = errors; return rest; });
    if (this.pdfInput) this.pdfInput.nativeElement.value = '';
  }
  fileSize(bytes: number): string { return bytes < 1048576 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1048576).toFixed(1)} MB`; }

  submit(): void {
    if (this.saving() || this.importing() || this.savedPublication() || !this.destination()) return;
    if (!this.validateInformation()) { this.step.set(1); return; }
    if (this.step() === 1) { this.step.set(2); return; }
    this.publicationForm.markAllAsTouched();
    if (!this.isReport && !this.selectedFile()) this.fileError.set('Debe seleccionar un archivo PDF.');
    if (this.publicationForm.invalid || this.fileError()) return;
    const destination = this.destination()!;
    const values = this.publicationForm.getRawValue();
    const data = new FormData();
    data.append('tipo', destination.tipo);
    data.append('estado', this.canChooseStatus() ? values.estado : 'EN_REVISION');
    if (this.needsReviewObservation) data.append('observacion_revision', values.observacion_revision.trim());
    data.append('solo_suscriptores', this.canChooseStatus() && values.solo_suscriptores ? '1' : '0');
    data.append('titulo', values.titulo.trim()); data.append('fecha_publicacion', values.fecha_publicacion);
    for (const key of ['link_url', 'descripcion', 'fuente'] as const) if (values[key].trim()) data.append(key, values[key].trim());
    values.autores.map(value => value.trim()).filter(Boolean).forEach(value => data.append('autores[]', value));
    if (this.selectedFile()) data.append('archivo', this.selectedFile()!);
    this.saving.set(true); this.serverError.set(''); this.fieldErrors.set({});
    this.publications.create(destination.departamento.id, data).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: publication => {
        this.saving.set(false); this.savedPublication.set(publication); this.publicationForm.markAsPristine(); this.clearFile();
      },
      error: error => {
        this.saving.set(false);
        const errors: Record<string, string> = {};
        for (const [key, messages] of Object.entries(error?.error?.errors || {})) errors[key] = String(Array.isArray(messages) ? messages[0] : messages);
        this.fieldErrors.set(errors);
        if (Object.keys(errors).some(key => !['archivo', 'estado', 'solo_suscriptores', 'observacion_revision'].includes(key))) this.step.set(1);
        this.serverError.set(Object.keys(errors).length ? 'Revisa los campos indicados. Tus datos se conservan.' : 'No se pudo guardar la publicación. Tus datos se conservan; puedes reintentar.');
      },
    });
  }

  importSharePoint(): void {
    const destination = this.destination();
    if (!this.isAdmin() || !destination || this.saving() || this.importing()) return;
    const targets: Record<WorkspaceType, SharePointImportTarget> = { ARTICULO: 'articulos', LIBRO: 'libros', REPORTE: 'reportes' };
    this.importing.set(true); this.importMessage.set(''); this.importFailed.set(false);
    this.dialog.open(SharePointAtlasImportDialogComponent, {
      width: 'min(96vw, 980px)', maxWidth: '96vw', panelClass: 'sharepoint-import-dialog-panel', backdropClass: 'sharepoint-import-dialog-backdrop', autoFocus: false, restoreFocus: true,
      data: { departamentos: [destination.departamento], target: targets[destination.tipo], context: 'observatorio' },
    }).afterClosed().pipe(take(1), takeUntilDestroyed(this.destroyRef), finalize(() => this.importing.set(false))).subscribe({
      next: result => {
        if (result?.totals) { const totals = result.totals; this.importFailed.set(totals.errors > 0 || totals.rejected > 0); this.importMessage.set(`${totals.imported} importados, ${totals.duplicates} duplicados, ${totals.rejected} rechazados, ${totals.errors} errores.${totals.imported > 0 ? ' Las publicaciones importadas ya están guardadas.' : ''}`); }
      },
      error: () => { this.importFailed.set(true); this.importMessage.set('No se pudo completar la importación. Puedes volver a intentarlo; los datos del formulario se conservan.'); },
    });
  }
}
