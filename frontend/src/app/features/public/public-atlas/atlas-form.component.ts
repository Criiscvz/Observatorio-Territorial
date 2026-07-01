import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { PublicacionAtlas } from '@core/services/atlas.service';

@Component({
  selector: 'app-atlas-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
  ],
  template: `
    <h2 mat-dialog-title>{{ isEditMode ? 'Editar Publicación' : 'Agregar Publicación' }}</h2>
    
    <mat-dialog-content [formGroup]="form" class="form-container">
      <!-- Titulo -->
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Título</mat-label>
        <input matInput formControlName="titulo" placeholder="Ej. Atlas de Biodiversidad Costera" />
        <mat-error *ngIf="form.get('titulo')?.hasError('required')">El título es requerido</mat-error>
      </mat-form-field>

      <!-- Autor -->
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Autor / Facultad</mat-label>
        <input matInput formControlName="autor" placeholder="Ej. Observatorio Territorial - ULEAM" />
        <mat-error *ngIf="form.get('autor')?.hasError('required')">El autor es requerido</mat-error>
      </mat-form-field>

      <div class="row">
        <!-- Categoria -->
        <mat-form-field appearance="outline" class="half-width">
          <mat-label>Categoría</mat-label>
          <mat-select formControlName="categoria">
            <mat-option value="Economía">Economía</mat-option>
            <mat-option value="Vitalidad Ecológica">Vitalidad Ecológica</mat-option>
            <mat-option value="Gobernanza">Gobernanza</mat-option>
            <mat-option value="Cultura">Cultura</mat-option>
          </mat-select>
          <mat-error *ngIf="form.get('categoria')?.hasError('required')">La categoría es requerida</mat-error>
        </mat-form-field>

        <!-- Paginas -->
        <mat-form-field appearance="outline" class="half-width">
          <mat-label>Número de Páginas</mat-label>
          <input matInput type="number" formControlName="paginas" min="1" />
          <mat-error *ngIf="form.get('paginas')?.hasError('required')">Requerido</mat-error>
        </mat-form-field>
      </div>

      <div class="row">
        <!-- Tamano -->
        <mat-form-field appearance="outline" class="half-width">
          <mat-label>Tamaño del Archivo</mat-label>
          <input matInput formControlName="tamano" placeholder="Ej. 2.4 MB" />
          <mat-error *ngIf="form.get('tamano')?.hasError('required')">Requerido</mat-error>
        </mat-form-field>

        <!-- PDF URL -->
        <mat-form-field appearance="outline" class="half-width">
          <mat-label>Enlace del Archivo PDF</mat-label>
          <input matInput formControlName="pdfUrl" placeholder="Ej. /1-recuperacion-economica.pdf" />
          <mat-error *ngIf="form.get('pdfUrl')?.hasError('required')">Requerido</mat-error>
        </mat-form-field>
      </div>

      <!-- Descripcion -->
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Descripción</mat-label>
        <textarea matInput formControlName="descripcion" rows="4" placeholder="Breve resumen de la publicación..."></textarea>
        <mat-error *ngIf="form.get('descripcion')?.hasError('required')">La descripción es requerida</mat-error>
      </mat-form-field>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancelar</button>
      <button mat-flat-button color="primary" [disabled]="form.invalid" (click)="save()">
        {{ isEditMode ? 'Actualizar' : 'Crear' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .form-container {
      display: flex;
      flex-direction: column;
      gap: 8px;
      min-width: 500px;
      padding-top: 10px !important;
    }
    .full-width {
      width: 100%;
    }
    .row {
      display: flex;
      gap: 16px;
      width: 100%;
    }
    .half-width {
      flex: 1;
    }
  `],
})
export class AtlasFormComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly dialogRef = inject(MatDialogRef<AtlasFormComponent>);
  readonly data = inject<PublicacionAtlas | null>(MAT_DIALOG_DATA);

  form!: FormGroup;
  isEditMode = false;

  ngOnInit(): void {
    this.isEditMode = !!this.data;
    this.initForm();
  }

  private initForm(): void {
    this.form = this.fb.group({
      titulo: [this.data?.titulo || '', [Validators.required]],
      descripcion: [this.data?.descripcion || '', [Validators.required]],
      categoria: [this.data?.categoria || 'Economía', [Validators.required]],
      autor: [this.data?.autor || '', [Validators.required]],
      paginas: [this.data?.paginas || 1, [Validators.required, Validators.min(1)]],
      tamano: [this.data?.tamano || '1.0 MB', [Validators.required]],
      pdfUrl: [this.data?.pdfUrl || '/1-recuperacion-economica.pdf', [Validators.required]],
    });
  }

  save(): void {
    if (this.form.invalid) return;
    this.dialogRef.close(this.form.value);
  }
}
