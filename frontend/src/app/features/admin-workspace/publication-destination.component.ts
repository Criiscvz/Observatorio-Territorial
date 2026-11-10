import { PublicationDestinationFacade } from './publication-destination.facade';
import { Component, DestroyRef, ElementRef, HostListener, OnInit, ViewChild, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Observable, finalize, map, shareReplay, take } from 'rxjs';
import { SharePointAtlasImportDialogComponent } from '@features/public/public-atlas/sharepoint-atlas-import-dialog.component';
import { ConfirmDialogComponent } from '@shared/components/confirm-dialog/confirm-dialog.component';
import { PublicLibraryPublication, publicHttpUrl } from '@features/public/components/public-library-publication';
import { PublicationViewerService } from '@features/public/components/publication-viewer.service';

@Component({
  selector: 'app-publication-destination', standalone: true,
  providers: [PublicationDestinationFacade],
  imports: [RouterLink, MatIconModule, ReactiveFormsModule],
  templateUrl: './publication-destination.component.html',
  styleUrl: './publication-destination.component.scss',
})
export class PublicationDestinationComponent implements OnInit {
  private readonly state = inject(PublicationDestinationFacade);
  readonly auth = this.state.auth;
  readonly isAdmin = this.state.isAdmin;
  canChooseStatus(): boolean { return this.state.canChooseStatus(); }

  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  private readonly dialog = inject(MatDialog);
  private readonly viewer = inject(PublicationViewerService);
  @ViewChild('editor') private editor?: ElementRef<HTMLElement>;
  @ViewChild('pdfInput') private pdfInput?: ElementRef<HTMLInputElement>;
  private leaveConfirmation?: Observable<boolean>;

  readonly types = this.state.types;
  readonly form = this.state.form;
  readonly publicationForm = this.state.publicationForm;
  readonly observatories = this.state.observatories;
  readonly loading = this.state.loading;
  readonly error = this.state.error;
  readonly destination = this.state.destination;
  readonly step = this.state.step;
  readonly selectedFile = this.state.selectedFile;
  readonly dragging = this.state.dragging;
  readonly fileError = this.state.fileError;
  readonly serverError = this.state.serverError;
  readonly fieldErrors = this.state.fieldErrors;
  readonly saving = this.state.saving;
  readonly confirmClose = this.state.confirmClose;
  readonly savedPublication = this.state.savedPublication;
  readonly importMessage = this.state.importMessage;
  readonly importFailed = this.state.importFailed;
  readonly importing = this.state.importing;
  get autores() { return this.state.autores; }
  get needsReviewObservation() { return this.state.needsReviewObservation; }

  get isReport() { return this.state.isReport; }
  get destinationLabel() { return this.state.destinationLabel; }
  get canPreviewPdf() { return this.state.canPreviewPdf; }
  get reportPreviewUrl() { return this.state.reportPreviewUrl; }
  get canPreviewReport() { return this.state.canPreviewReport; }
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

  ngOnInit(): void { const query = this.route.snapshot.queryParamMap; this.state.start({tipo:query.get('tipo'),departamento:query.get('departamento')}); }

  load(): void { return this.state.load(); }

  openForm(): void { if (this.state.openForm()) this.focusEditor(); }

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

  resetEditor(): void { return this.state.resetEditor(); }

  hasUnsavedChanges(): boolean { return this.state.hasUnsavedChanges(); }
  requestClose(): void { return this.state.requestClose(); }
  closeForm(): void { return this.state.closeForm(); }
  createAnother(): void { if (this.saving() || this.importing()) return; this.resetEditor(); this.focusEditor(); }
  canLeave(): boolean | Observable<boolean> {
    if (this.saving() || this.importing()) return false;
    if (!this.hasUnsavedChanges()) return true;
    if (!this.leaveConfirmation) {
      this.leaveConfirmation = this.dialog.open(ConfirmDialogComponent, {
        width: 'min(92vw, 520px)', panelClass: 'app-confirm-dialog-panel', backdropClass: 'app-confirm-dialog-backdrop',
        data: { title: '¿Salir sin guardar?', message: 'La publicación aún no se ha guardado. Si sales, perderás los cambios.', confirmText: 'Salir sin guardar', cancelText: 'Seguir editando', icon: 'edit_note' },
      }).afterClosed().pipe(take(1), takeUntilDestroyed(this.destroyRef), map(value => value === true), finalize(() => this.leaveConfirmation = undefined), shareReplay({ bufferSize: 1, refCount: true }));
    }
    return this.leaveConfirmation;
  }
  @HostListener('window:beforeunload', ['$event'])
  beforeUnload(event: BeforeUnloadEvent): void {
    if (this.saving() || this.importing() || this.hasUnsavedChanges()) { event.preventDefault(); event.returnValue = ''; }
  }
  addAuthor(): void { return this.state.addAuthor(); }
  removeAuthor(index: number): void { return this.state.removeAuthor(index); }

  goToStep(value: number): void { return this.state.goToStep(value); }

  fieldError(name: string): string { return this.state.fieldError(name); }

  onFileSelected(event: Event): void { this.selectFile((event.target as HTMLInputElement).files?.[0]); }
  onDrop(event: DragEvent): void { event.preventDefault(); this.dragging.set(false); this.selectFile(event.dataTransfer?.files[0]); }
  onDragOver(event: DragEvent): void { event.preventDefault(); if (!this.saving()) this.dragging.set(true); }
  selectFile(file?: File): void { this.state.selectFile(file); if (this.fileError() && this.pdfInput) this.pdfInput.nativeElement.value = ''; }
  clearFile(): void { if (this.saving()) return; this.state.clearFile(); if (this.pdfInput) this.pdfInput.nativeElement.value = ''; }
  fileSize(bytes: number): string { return this.state.fileSize(bytes); }

  submit(): void { return this.state.submit(); }

  importSharePoint(): void {
    const data = this.state.beginImport(); if (!data) return;
    this.state.observeImport(this.dialog.open(SharePointAtlasImportDialogComponent, {
      width:'min(96vw, 980px)', maxWidth:'96vw', panelClass:'sharepoint-import-dialog-panel', backdropClass:'sharepoint-import-dialog-backdrop', autoFocus:false, restoreFocus:true, data,
    }).afterClosed());
  }
}
