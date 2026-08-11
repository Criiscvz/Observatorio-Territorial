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
  template: `
    <section class="atlas-upload-page">
      <header class="atlas-upload-header">
        <div>
          <span class="eyebrow">Biblioteca global</span>
          <h1>{{ editingAtlas() ? 'Editar Atlas' : 'Subir Atlas' }}</h1>
          <p>{{ editingAtlas() ? 'Actualiza la información del Atlas global.' : 'Publica documentos Atlas independientes de los observatorios.' }}</p>
        </div>
        <button mat-stroked-button type="button" routerLink="/admin/atlas">
          <mat-icon>library_books</mat-icon>
          Gestionar Atlas
        </button>
      </header>

      <form class="atlas-upload-card" [formGroup]="form" (ngSubmit)="save()">
        <div class="form-head">
          <div class="form-icon"><mat-icon>map</mat-icon></div>
          <div>
            <h2>{{ editingAtlas() ? 'Editar Atlas' : 'Formulario de Atlas' }}</h2>
            <p>{{ editingAtlas() ? editingAtlas()?.codigo : 'Se generará automáticamente: ATL-####' }}</p>
          </div>
        </div>

        <div class="form-import-actions">
          <button mat-raised-button color="primary" type="button" (click)="importFromSharePoint()">
            <mat-icon>cloud_download</mat-icon>
            Importar desde SharePoint
          </button>
        </div>

        <div class="form-grid">
          <mat-form-field appearance="outline">
            <mat-label>Título del Atlas</mat-label>
            <input matInput formControlName="titulo" />
            <mat-error>El título es obligatorio.</mat-error>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Fecha de publicación</mat-label>
            <input matInput type="date" formControlName="fecha_publicacion" />
            <mat-error>La fecha es obligatoria.</mat-error>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Fuente</mat-label>
            <input matInput formControlName="fuente" placeholder="ULEAM" />
            <mat-error>La fuente es obligatoria.</mat-error>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>URL externa</mat-label>
            <input matInput formControlName="link_url" placeholder="https://..." />
            @if (form.controls.link_url.touched && form.controls.link_url.invalid) {
              <mat-error>Ingrese una URL válida con http o https.</mat-error>
            }
          </mat-form-field>

          <mat-form-field appearance="outline" class="full">
            <mat-label>Descripción</mat-label>
            <textarea matInput rows="4" formControlName="descripcion"></textarea>
            <mat-error>La descripción es obligatoria.</mat-error>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Estado</mat-label>
            <mat-select formControlName="estado">
              <mat-option value="PUBLICACION">Publicación</mat-option>
              <mat-option value="EN_REVISION">En revisión</mat-option>
              <mat-option value="SUSPENDIDO">Suspendido</mat-option>
              <mat-option value="ARCHIVADO">Archivado</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-checkbox formControlName="solo_suscriptores" class="subscriber-check">
            Solo para suscriptores
          </mat-checkbox>
        </div>

        <div
          class="upload-zone"
          [class.dragging]="isDraggingFile()"
          [class.has-file]="selectedFile()"
          (click)="pdfInput.click()"
          (dragover)="onFileDragOver($event)"
          (dragleave)="onFileDragLeave($event)"
          (drop)="onFileDropped($event)"
        >
          <input #pdfInput type="file" accept="application/pdf,.pdf" hidden (change)="onFileSelected($event)" />
          @if (selectedFile()) {
            <mat-icon>picture_as_pdf</mat-icon>
            <strong>{{ selectedFile()?.name }}</strong>
            <span>{{ formatFileSize(selectedFile()!.size) }} · PDF</span>
          } @else {
            <mat-icon>cloud_upload</mat-icon>
            <strong>{{ editingAtlas() ? 'Arrastra o haz click para reemplazar el PDF' : 'Arrastra o haz click para subir el PDF del Atlas' }}</strong>
            <span>{{ editingAtlas() ? 'Puedes conservar el archivo actual. PDF de máximo 20 MB.' : 'Formato permitido: PDF. Máximo 20 MB.' }}</span>
          }
        </div>
        @if (fileError()) {
          <div class="file-error"><mat-icon>error</mat-icon>{{ fileError() }}</div>
        }
        @if (serverError()) {
          <div class="file-error"><mat-icon>error</mat-icon>{{ serverError() }}</div>
        }

        <footer class="form-actions">
          <button mat-button type="button" routerLink="/admin/atlas">Cancelar</button>
          <button mat-raised-button color="primary" type="submit" [disabled]="saving()">
            @if (saving()) {
              <mat-spinner diameter="20"></mat-spinner>
            } @else {
              <mat-icon>save</mat-icon>
            }
            {{ editingAtlas() ? 'Guardar cambios' : 'Guardar Atlas' }}
          </button>
        </footer>
      </form>
    </section>
  `,
  styles: [
    `
      .atlas-upload-page {
        padding: 1.5rem;
        display: grid;
        gap: 1.25rem;
      }

      .atlas-upload-header,
      .atlas-upload-card {
        background: var(--bg-secondary);
        color: var(--text-primary);
        border: 1px solid var(--border-color);
        border-radius: 18px;
        box-shadow: var(--shadow-sm);
      }

      .atlas-upload-header {
        display: flex;
        justify-content: space-between;
        gap: 1rem;
        align-items: center;
        padding: 1.5rem;
      }

      .eyebrow {
        color: var(--primary-500);
        font-size: 0.75rem;
        font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      h1,
      h2,
      p {
        margin: 0;
      }

      .atlas-upload-header h1 {
        font-size: clamp(1.8rem, 3vw, 2.5rem);
        font-weight: 900;
      }

      .atlas-upload-header p,
      .form-head p {
        color: var(--text-secondary);
      }

      .atlas-upload-card {
        padding: 1.5rem;
        display: grid;
        gap: 1.25rem;
      }

      .form-head {
        display: flex;
        gap: 1rem;
        align-items: center;
      }

      .form-icon {
        width: 54px;
        height: 54px;
        display: grid;
        place-items: center;
        border-radius: 14px;
        background: rgba(99, 102, 241, 0.14);
        color: var(--primary-500);
      }

      .form-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 1rem;
      }

      .full {
        grid-column: 1 / -1;
      }

      .subscriber-check {
        align-self: center;
      }

      .upload-zone {
        min-height: 180px;
        display: grid;
        place-items: center;
        text-align: center;
        gap: 0.4rem;
        padding: 1.5rem;
        border: 1.5px dashed rgba(99, 102, 241, 0.42);
        border-radius: 18px;
        background: rgba(99, 102, 241, 0.08);
        cursor: pointer;
        transition: border-color 0.18s ease, background 0.18s ease;
      }

      .upload-zone:hover,
      .upload-zone.dragging {
        border-color: var(--primary-500);
        background: rgba(99, 102, 241, 0.14);
      }

      .upload-zone mat-icon {
        color: var(--primary-500);
        font-size: 38px;
        width: 38px;
        height: 38px;
      }

      .upload-zone span,
      .file-error {
        color: var(--text-secondary);
      }

      .file-error {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        color: var(--error-500, #ef4444);
        font-weight: 700;
      }

      .form-actions {
        display: flex;
        justify-content: flex-end;
        gap: 0.75rem;
        flex-wrap: wrap;
      }

      @media (max-width: 760px) {
        .atlas-upload-header {
          align-items: flex-start;
          flex-direction: column;
        }

        .form-grid {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class GlobalAtlasUploadComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly publicacionService = inject(PublicacionService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  selectedFile = signal<File | null>(null);
  isDraggingFile = signal(false);
  fileError = signal('');
  serverError = signal('');
  saving = signal(false);
  loadingAtlas = signal(false);
  editingAtlas = signal<ObservatorioPublicacion | null>(null);

  readonly form = this.fb.nonNullable.group({
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
            estado: atlas.estado,
            solo_suscriptores: atlas.solo_suscriptores,
            titulo: atlas.titulo,
            fecha_publicacion: atlas.fecha_publicacion,
            link_url: atlas.link_url ?? '',
            descripcion: atlas.descripcion ?? '',
            autores: Array.isArray(atlas.autores) ? atlas.autores.join(', ') : atlas.autores ?? '',
            fuente: atlas.fuente,
          });
          this.loadingAtlas.set(false);
        },
        error: () => {
          this.loadingAtlas.set(false);
          this.snackBar.open('No se pudo cargar el Atlas para editar.', 'Cerrar', { duration: 4500 });
          this.router.navigate(['/admin/atlas']);
        },
      });
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    if (file) this.validateAndSetFile(file, input);
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
    if (file) this.validateAndSetFile(file);
  }

  save(): void {
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
    request
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.snackBar.open(
            this.editingAtlas() ? 'Atlas actualizado correctamente.' : 'Atlas guardado correctamente.',
            'Cerrar',
            { duration: 4000 },
          );
          this.router.navigate(['/admin/atlas']);
        },
        error: (error) => {
          this.saving.set(false);
          const errors = error?.error?.errors;
          const first = errors ? Object.values(errors).flat()[0] : null;
          this.serverError.set(
            typeof first === 'string' ? first : error?.error?.message || 'No se pudo guardar el Atlas.',
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
