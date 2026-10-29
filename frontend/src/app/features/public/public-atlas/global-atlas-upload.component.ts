import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  EstadoPublicacion,
  ObservatorioPublicacion,
} from '@core/models/publicacion/publicacion.interface';
import { PublicacionService } from '@core/services/publicacion.service';
import { AtlasCategoria, AtlasCategoriaService } from '@core/services/atlas-categoria.service';
import { atlasCategoryPresentation } from '@core/utils/atlas-category-presentation';
import { SharePointAtlasImportDialogComponent } from './sharepoint-atlas-import-dialog.component';

@Component({
  selector: 'app-global-atlas-upload',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatCheckboxModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatSnackBarModule,
  ],
  templateUrl: './global-atlas-upload.component.html',
  styleUrl: './global-atlas-upload.component.scss',
})
export class GlobalAtlasUploadComponent implements OnInit {
  private readonly categoriaService = inject(AtlasCategoriaService);
  readonly categorias = signal<AtlasCategoria[]>([]);
  private readonly fb = inject(FormBuilder);
  private readonly publicacionService = inject(PublicacionService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  readonly categoryVisual = atlasCategoryPresentation;

  selectedFile = signal<File | null>(null);
  isDraggingFile = signal(false);
  fileError = signal('');
  serverError = signal('');
  saving = signal(false);
  loadingAtlas = signal(false);
  editingAtlas = signal<ObservatorioPublicacion | null>(null);

  readonly form = this.fb.nonNullable.group({
    atlas_categoria_id: [''],
    tipo: ['ATLAS' as const],
    estado: ['PUBLICACION' as EstadoPublicacion, Validators.required],
    solo_suscriptores: [false],
    titulo: ['', [Validators.required, Validators.maxLength(255)]],
    fecha_publicacion: ['', Validators.required],
    link_url: ['', Validators.pattern(/^https?:\/\/.+/i)],
    descripcion: ['', [Validators.required, Validators.maxLength(3000)]],
    autores: [''],
    fuente: ['ULEAM', [Validators.required, Validators.maxLength(255)]],
  });

  ngOnInit(): void {
    this.categoriaService
      .list()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (items) => {
          this.categorias.set(items);
          const category = this.route.snapshot.queryParamMap.get('categoria');
          if (
            !this.route.snapshot.queryParamMap.has('editar') &&
            category &&
            items.some((item) => item.id === category)
          ) {
            this.form.controls.atlas_categoria_id.setValue(category);
          }
        },
        error: () =>
          this.snackBar.open(
            'No se pudieron cargar las categorías. Recarga la página para seleccionarlas.',
            'Cerrar',
            { duration: 6000 },
          ),
      });
    const atlasId = this.route.snapshot.queryParamMap.get('editar');
    if (!atlasId) return;

    this.loadingAtlas.set(true);
    this.publicacionService
      .getGlobalAtlasById(atlasId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (atlas) => {
          this.editingAtlas.set(atlas);
          this.form.patchValue({
            atlas_categoria_id: atlas.atlas_categoria_id ?? '',
            estado: atlas.estado,
            solo_suscriptores: atlas.solo_suscriptores,
            titulo: atlas.titulo,
            fecha_publicacion: atlas.fecha_publicacion,
            link_url: atlas.link_url ?? '',
            descripcion: atlas.descripcion ?? '',
            autores: Array.isArray(atlas.autores)
              ? atlas.autores.join(', ')
              : (atlas.autores ?? ''),
            fuente: atlas.fuente,
          });
          this.loadingAtlas.set(false);
        },
        error: () => {
          this.loadingAtlas.set(false);
          this.snackBar.open('No se pudo cargar el Atlas para editar.', 'Cerrar', {
            duration: 4500,
          });
          this.router.navigate(['/admin/atlas']);
        },
      });
  }

  clearSelectedFile(input: HTMLInputElement): void {
    if (this.saving()) return;
    this.selectedFile.set(null);
    this.fileError.set('');
    input.value = '';
  }

  openCurrentPdf(): void {
    const atlas = this.editingAtlas();
    if (!atlas) return;
    this.publicacionService
      .openPdf(atlas)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((opened) => {
        if (!opened)
          this.snackBar.open('El PDF actual no está disponible.', 'Cerrar', { duration: 4000 });
      });
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    if (file && !this.saving() && !this.loadingAtlas()) this.validateAndSetFile(file, input);
  }

  onFileDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDraggingFile.set(true);
  }

  onFileDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.isDraggingFile.set(false);
  }

  onFileDropped(event: DragEvent): void {
    event.preventDefault();
    this.isDraggingFile.set(false);
    const file = event.dataTransfer?.files?.[0];
    if (file && !this.saving() && !this.loadingAtlas()) this.validateAndSetFile(file);
  }

  save(): void {
    if (this.saving() || this.loadingAtlas()) return;
    this.form.markAllAsTouched();
    this.fileError.set('');
    this.serverError.set('');

    if (!this.editingAtlas() && !this.selectedFile()) {
      this.fileError.set('Debe seleccionar el PDF del Atlas.');
    }

    if (this.form.invalid || (!this.editingAtlas() && !this.selectedFile())) return;

    const formData = new FormData();
    Object.entries(this.form.getRawValue()).forEach(([key, value]) => {
      formData.append(key, typeof value === 'boolean' ? (value ? '1' : '0') : String(value ?? ''));
    });
    if (this.selectedFile()) formData.append('archivo', this.selectedFile()!);

    this.saving.set(true);
    const request = this.editingAtlas()
      ? this.publicacionService.update(this.editingAtlas()!.id, formData)
      : this.publicacionService.createGlobalAtlas(formData);
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (atlas) => {
        this.saving.set(false);
        this.snackBar.open(
          this.editingAtlas()
            ? 'Atlas actualizado correctamente.'
            : 'Atlas guardado correctamente.',
          'Cerrar',
          { duration: 4000 },
        );
        this.router.navigate(['/admin/atlas'], {
          queryParams: { categoria: atlas.atlas_categoria_id || null },
        });
      },
      error: (error) => {
        this.saving.set(false);
        const errors = error?.error?.errors;
        const first = errors ? Object.values(errors).flat()[0] : null;
        this.serverError.set(
          typeof first === 'string'
            ? first
            : error?.error?.message || 'No se pudo guardar el Atlas.',
        );
      },
    });
  }

  importFromSharePoint(): void {
    const dialogRef = this.dialog.open(SharePointAtlasImportDialogComponent, {
      width: 'min(96vw, 980px)',
      maxWidth: '96vw',
      panelClass: 'sharepoint-import-dialog-panel',
      backdropClass: 'sharepoint-import-dialog-backdrop',
      autoFocus: false,
      restoreFocus: false,
      data: {
        departamentos: [],
        target: 'atlas',
        context: 'global-atlas',
        categoriaId: this.form.controls.atlas_categoria_id.value || null,
      },
    });

    dialogRef
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => {
        if (!result) return;
        const totals = result.totals;
        this.snackBar.open(
          `${totals.imported} importados, ${totals.duplicates} duplicados, ${totals.rejected} rechazados, ${totals.errors} errores`,
          'Cerrar',
          { duration: 7000 },
        );
      });
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
}
