import { Injectable, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, FormArray, FormBuilder, FormControl, Validators } from '@angular/forms';
import { EMPTY, Observable, Subject, catchError, takeUntil, tap } from 'rxjs';
import { ObservatorioPublicacion, EstadoPublicacion, TipoPublicacion, requiresReviewObservation } from '@core/models/publicacion/publicacion.interface';
import { PublicacionService } from '@core/services/publicacion.service';
import { AuthService } from '@core/services/auth.service';
import { ObservatoryWorkspaceFacade } from './observatory-workspace.facade';

/** Draft, validation and save lifecycle. It neither opens dialogs nor navigates. */
@Injectable()
export class PublicationEditorFacade {
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly publicacionService = inject(PublicacionService);
  private readonly authService = inject(AuthService);
  private readonly workspace = inject(ObservatoryWorkspaceFacade);
  private readonly resetRequests = new Subject<void>();
  private started = false;
  readonly departamento = this.workspace.departamento;
  readonly changingReviewStatus = this.workspace.changingReviewStatus;
  get canManagePublications(): boolean { return this.workspace.canManagePublications; }
  canEditPublication(item: ObservatorioPublicacion): boolean {
    return this.workspace.belongsToCurrentView(item) && item.capabilities?.can_edit === true;
  }
  editingPublication = signal<ObservatorioPublicacion | null>(null);

  savingPublication = signal(false);

  selectedFile = signal<File | null>(null);

  isDraggingFile = signal(false);

  fileError = signal('');

  serverError = signal('');

  readonly editorStep = signal(1);

  readonly publicationForm = this.fb.nonNullable.group({
    tipo: ['ARTICULO' as TipoPublicacion, Validators.required],
    estado: ['PUBLICACION' as EstadoPublicacion, Validators.required],
    observacion_revision: ['', Validators.maxLength(2000)],
    solo_suscriptores: [false],
    titulo: ['', [Validators.required, (control: AbstractControl) => String(control.value ?? '').trim() ? null : {required:true}, Validators.maxLength(255)]],
    fecha_publicacion: ['', [Validators.required, Validators.pattern(/^\d{4}-\d{2}-\d{2}$/)]],
    link_url: ['', Validators.pattern(/^https?:\/\/.+/i)],
    descripcion: ['', Validators.maxLength(3000)],
    autores: this.fb.nonNullable.array([this.createAutorControl()]),
    fuente: ['', Validators.maxLength(255)],
  });

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

  get canChoosePublicationStatus(): boolean {
    const editing = this.editingPublication();
    if (editing) return editing.capabilities?.can_review === true;
    return this.authService.canReviewObservatory(this.departamento()?.id);
  }

  continuePublication(): void {
    this.publicationForm.markAllAsTouched();
    if (this.informationValid()) this.editorStep.set(2);
  }

  private informationValid(): boolean {
    return ['titulo', 'fecha_publicacion', 'link_url', 'descripcion', 'autores', 'fuente']
      .every(name => this.publicationForm.get(name)?.valid);
  }

  get needsReviewObservation(): boolean {
    return this.canChoosePublicationStatus && requiresReviewObservation(this.publicationForm.controls.estado.value);
  }

  configureReviewObservation(): void {
    const control = this.publicationForm.controls.observacion_revision;
    control.setValidators([Validators.maxLength(2000), ...(this.needsReviewObservation
      ? [Validators.required, (field: AbstractControl) => String(field.value ?? '').trim() ? null : {required:true}] : [])]);
    control.updateValueAndValidity({emitEvent:false});
  }

  publicationFieldError(name: 'titulo' | 'fecha_publicacion' | 'link_url' | 'descripcion' | 'fuente' | 'observacion_revision'): string {
    const control = this.publicationForm.controls[name];
    if (!control.touched || !control.invalid) return '';
    if (control.hasError('required')) return 'Este campo es obligatorio.';
    if (control.hasError('maxlength')) return `Máximo ${control.errors?.['maxlength'].requiredLength} caracteres.`;
    return name === 'link_url' ? 'Ingresa una URL válida con http o https.' : 'Ingresa un valor válido.';
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

  configurePublicationValidators(tipo: TipoPublicacion): void {
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

  resetPublicationForm(tipo: TipoPublicacion = 'ARTICULO'): void {
    this.resetRequests.next(); this.savingPublication.set(false);
    this.editorStep.set(1);
    this.editingPublication.set(null);
    this.publicationForm.reset({
      tipo,
      estado: 'PUBLICACION',
      observacion_revision: '',
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

  buildPublicationFormData(
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

  start(): void {
    if (this.started) return;
    this.started = true;
    this.workspace.contextChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.resetPublicationForm());
    this.publicationForm.controls.tipo.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(tipo => {
      this.configurePublicationValidators(tipo); this.fileError.set('');
    });
    this.configurePublicationValidators(this.tipo);
    this.publicationForm.controls.estado.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.configureReviewObservation());
  }

  edit(publicacion: ObservatorioPublicacion): boolean {
    if (!this.canEditPublication(publicacion) || this.savingPublication() || this.changingReviewStatus()) return false;
    this.resetPublicationForm(publicacion.tipo);
    this.editingPublication.set(publicacion);
    this.publicationForm.reset({
      tipo: publicacion.tipo,
      estado: publicacion.estado ?? 'PUBLICACION',
      observacion_revision: publicacion.observacion_revision ?? '',
      solo_suscriptores: !!publicacion.solo_suscriptores,
      titulo: publicacion.titulo,
      fecha_publicacion: publicacion.fecha_publicacion,
      link_url: publicacion.link_url ?? '',
      descripcion: publicacion.descripcion ?? '',
      fuente: publicacion.fuente ?? '',
    });
    this.setAutores(publicacion.autores);
    this.configurePublicationValidators(publicacion.tipo);
    this.configureReviewObservation();
    this.selectedFile.set(null);
    this.isDraggingFile.set(false);
    this.fileError.set('');
    this.serverError.set('');

    this.publicationForm.markAsPristine();
    return true;
  }

  savePublication(): Observable<ObservatorioPublicacion> {
    if (this.savingPublication() || this.changingReviewStatus() || !this.canManagePublications) return EMPTY;
    this.publicationForm.markAllAsTouched();
    const editing = this.editingPublication();
    if (editing && !this.canEditPublication(editing)) return EMPTY;
    this.configureReviewObservation();
    const requiresPdf = this.isArticulo || this.isLibro || this.tipo === 'ATLAS';
    if (!editing && requiresPdf && !this.selectedFile()) {
      this.fileError.set('Debe seleccionar un archivo PDF.');
    }
    if (this.publicationForm.invalid) { this.editorStep.set(this.informationValid() ? 2 : 1); return EMPTY; }
    if (this.fileError() || (!editing && requiresPdf && !this.selectedFile())) { this.editorStep.set(2); return EMPTY; }

    const departamento = this.departamento();
    if (!departamento) return EMPTY;
    const formData = new FormData();
    const values = this.publicationForm.getRawValue();
    Object.entries(values).forEach(([key, value]) => {
      if (key === 'observacion_revision' && (!this.needsReviewObservation || !this.canChoosePublicationStatus)) return;
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
    return request.pipe(
      takeUntil(this.resetRequests), takeUntilDestroyed(this.destroyRef),
      tap({next: () => this.savingPublication.set(false), error: error => {
        this.savingPublication.set(false);
        const errors = error?.error?.errors;
        const first = errors ? Object.values(errors).flat()[0] : null;
        this.serverError.set(
          typeof first === 'string'
            ? first
            : error?.error?.message || 'No se pudo guardar la publicación.',
        );
        if (errors) this.editorStep.set(Object.keys(errors).some(key => !['archivo', 'estado', 'solo_suscriptores', 'observacion_revision'].includes(key)) ? 1 : 2);

      }}), catchError(() => EMPTY),
    );
  }
}
