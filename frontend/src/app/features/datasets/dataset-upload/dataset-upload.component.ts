import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipsModule } from '@angular/material/chips';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatStepperModule } from '@angular/material/stepper';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ColumnaAnalizada, Departamento } from '@core/models';
import { DatasetService } from '@core/services/dataset.service';
import { DepartamentoService } from '@core/services/departamento.service';

interface ColumnaExtendida extends ColumnaAnalizada {
  excluida?: boolean;
  nombre_personalizado?: string;
}

@Component({
  selector: 'app-dataset-upload',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    RouterLink,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatSelectModule,
    MatProgressBarModule,
    MatStepperModule,
    MatCheckboxModule,
    MatChipsModule,
    MatTooltipModule,
    MatExpansionModule,
  ],
  templateUrl: './dataset-upload.component.html',
  styleUrl: './dataset-upload.component.scss',
})
export class DatasetUploadComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly datasetService = inject(DatasetService);
  private readonly deptoService = inject(DepartamentoService);

  uploadForm: FormGroup = this.fb.group({
    departamento_id: ['', Validators.required],
    nombre: ['', Validators.required],
    descripcion: [''],
  });

  departamentos = signal<Departamento[]>([]);
  selectedFile = signal<File | null>(null);
  uploading = signal(false);
  processing = signal(false);
  error = signal<string | null>(null);

  datasetId = signal<string | null>(null);
  columnas = signal<ColumnaExtendida[]>([]);
  totalFilas = signal(0);
  importedCount = signal(0);

  // Columnas activas (no excluidas)
  columnasActivas = computed(() => this.columnas().filter((c) => !c.excluida));

  ngOnInit(): void {
    this.loadDepartamentos();

    // Pre-seleccionar departamento si viene en query params
    const deptoId = this.route.snapshot.queryParams['departamento'];
    if (deptoId) {
      this.uploadForm.patchValue({ departamento_id: deptoId });
    }
  }

  loadDepartamentos(): void {
    this.deptoService.getAll().subscribe({
      next: (departamentos) => this.departamentos.set(departamentos || []),
    });
  }

  onFileSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) {
      this.selectedFile.set(input.files[0]);
      this.error.set(null);
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    const files = event.dataTransfer?.files;
    if (files?.length) {
      this.selectedFile.set(files[0]);
      this.error.set(null);
    }
  }

  clearFile(event: Event): void {
    event.stopPropagation();
    this.selectedFile.set(null);
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  uploadAndAnalyze(stepper: any): void {
    if (!this.selectedFile()) return;

    this.uploading.set(true);
    this.error.set(null);

    const { departamento_id, nombre, descripcion } = this.uploadForm.value;

    this.datasetService
      .create(departamento_id, nombre, descripcion, this.selectedFile()!)
      .subscribe({
        next: (dataset) => {
          this.datasetId.set(dataset.id);

          // Analizar archivo
          this.datasetService.analizar(dataset.id).subscribe({
            next: (analisis) => {
              // Agregar propiedades extendidas
              const columnasExtendidas = analisis.columnas.map((c) => ({
                ...c,
                excluida: false,
                nombre_personalizado: c.nombre_columna,
              }));
              this.columnas.set(columnasExtendidas);
              this.totalFilas.set(analisis.total_filas);
              this.uploading.set(false);
              stepper.next();
            },
            error: (err) => {
              this.uploading.set(false);
              this.error.set(err.error?.message || 'Error al analizar el archivo');
            },
          });
        },
        error: (err) => {
          this.uploading.set(false);
          this.error.set(err.error?.message || 'Error al subir el archivo');
        },
      });
  }

  toggleExcluir(columna: ColumnaExtendida): void {
    columna.excluida = !columna.excluida;
    // Forzar actualización del signal
    this.columnas.set([...this.columnas()]);
  }

  confirmImport(stepper: any): void {
    if (!this.datasetId()) return;

    const columnasAImportar = this.columnasActivas();

    if (columnasAImportar.length === 0) {
      this.error.set('Debes incluir al menos una columna');
      return;
    }

    this.processing.set(true);
    this.error.set(null);

    this.datasetService.confirmar(this.datasetId()!, columnasAImportar).subscribe({
      next: (res) => {
        this.importedCount.set(res.total_registros);
        this.processing.set(false);
        stepper.next();
      },
      error: (err) => {
        this.processing.set(false);
        this.error.set(err.error?.message || 'Error al importar');
      },
    });
  }

  getTipoClass(tipo: string): string {
    switch (tipo) {
      case 'NUMERICO':
        return 'type-badge type-numeric';
      case 'CATEGORICO':
        return 'type-badge type-categoric';
      case 'FECHA':
        return 'type-badge type-date';
      default:
        return 'type-badge type-text';
    }
  }
}
