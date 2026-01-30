import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, FormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatStepperModule } from '@angular/material/stepper';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatExpansionModule } from '@angular/material/expansion';
import { DatasetService } from '../../core/services/dataset.service';
import { DepartamentoService } from '../../core/services/departamento.service';
import { Departamento, ColumnaAnalizada } from '../../core/models';

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
  template: `
    <div class="max-w-5xl mx-auto">
      <h1 class="text-2xl font-bold text-gray-800 mb-6">Importar Dataset</h1>

      <mat-stepper [linear]="true" #stepper>
        <!-- Step 1: Subir archivo -->
        <mat-step [stepControl]="uploadForm" label="Subir Archivo">
          <mat-card class="mt-4">
            <mat-card-content>
              <form [formGroup]="uploadForm" class="space-y-4">
                <mat-form-field class="w-full" appearance="outline">
                  <mat-label>Departamento</mat-label>
                  <mat-select formControlName="departamento_id">
                    @for (depto of departamentos(); track depto.id) {
                      <mat-option [value]="depto.id">{{ depto.nombre }}</mat-option>
                    }
                  </mat-select>
                </mat-form-field>

                <mat-form-field class="w-full" appearance="outline">
                  <mat-label>Nombre del Dataset</mat-label>
                  <input matInput formControlName="nombre" placeholder="Ej: Encuesta 2025">
                </mat-form-field>

                <mat-form-field class="w-full" appearance="outline">
                  <mat-label>Descripción</mat-label>
                  <textarea matInput formControlName="descripcion" rows="3"></textarea>
                </mat-form-field>

                <!-- Drop zone -->
                <div 
                  class="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors"
                  [class.border-gray-300]="!selectedFile()"
                  [class.border-green-500]="selectedFile()"
                  [class.bg-green-50]="selectedFile()"
                  (click)="fileInput.click()"
                  (dragover)="onDragOver($event)"
                  (drop)="onDrop($event)"
                >
                  <input 
                    #fileInput 
                    type="file" 
                    hidden 
                    accept=".xlsx,.xls,.csv"
                    (change)="onFileSelect($event)"
                  >
                  
                  @if (selectedFile()) {
                    <mat-icon class="text-5xl text-green-500">check_circle</mat-icon>
                    <p class="text-lg font-medium mt-2">{{ selectedFile()?.name }}</p>
                    <p class="text-sm text-gray-500">{{ formatFileSize(selectedFile()?.size || 0) }}</p>
                    <button mat-button color="warn" (click)="clearFile($event)" class="mt-2">
                      <mat-icon>close</mat-icon> Quitar archivo
                    </button>
                  } @else {
                    <mat-icon class="text-5xl text-gray-400">cloud_upload</mat-icon>
                    <p class="text-lg text-gray-600 mt-2">Arrastra tu archivo aquí</p>
                    <p class="text-sm text-gray-500">o haz clic para seleccionar</p>
                    <p class="text-xs text-gray-400 mt-2">Formatos: .xlsx, .xls, .csv (máx 10MB)</p>
                  }
                </div>

                @if (uploading()) {
                  <div class="space-y-2">
                    <p class="text-sm text-gray-600 text-center">Subiendo y analizando archivo...</p>
                    <mat-progress-bar mode="indeterminate"></mat-progress-bar>
                  </div>
                }

                @if (error()) {
                  <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                    {{ error() }}
                  </div>
                }
              </form>
            </mat-card-content>

            <mat-card-actions align="end">
              <button mat-raised-button color="primary" 
                      [disabled]="uploadForm.invalid || !selectedFile() || uploading()"
                      (click)="uploadAndAnalyze(stepper)">
                <mat-icon>upload</mat-icon>
                Subir y Analizar
              </button>
            </mat-card-actions>
          </mat-card>
        </mat-step>

        <!-- Step 2: Validar columnas -->
        <mat-step label="Configurar Columnas">
          <mat-card class="mt-4">
            <mat-card-header>
              <mat-card-title>Configurar Columnas del Dataset</mat-card-title>
              <mat-card-subtitle>
                {{ totalFilas() | number }} filas detectadas | 
                {{ columnasActivas().length }} columnas a importar de {{ columnas().length }} totales
              </mat-card-subtitle>
            </mat-card-header>

            <mat-card-content class="!pt-4">
              @if (error()) {
                <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                  {{ error() }}
                </div>
              }

              <div class="space-y-3">
                @for (col of columnas(); track col.nombre_columna; let i = $index) {
                  <mat-expansion-panel [expanded]="false" [class.opacity-50]="col.excluida">
                    <mat-expansion-panel-header>
                      <mat-panel-title class="flex items-center gap-2">
                        @if (!col.excluida) {
                          <mat-icon class="text-green-500">check_circle</mat-icon>
                        } @else {
                          <mat-icon class="text-red-500">cancel</mat-icon>
                        }
                        <span class="font-medium">{{ col.nombre_original }}</span>
                      </mat-panel-title>
                      <mat-panel-description class="flex items-center gap-2">
                        <span [class]="getTipoClass(col.tipo_dato)">{{ col.tipo_dato }}</span>
                        @if (col.excluida) {
                          <span class="text-red-500 text-sm">(Excluida)</span>
                        }
                      </mat-panel-description>
                    </mat-expansion-panel-header>

                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
                      <!-- Nombre personalizado -->
                      <mat-form-field appearance="outline" class="w-full">
                        <mat-label>Nombre en Base de Datos</mat-label>
                        <input matInput [(ngModel)]="col.nombre_columna" 
                               placeholder="nombre_columna"
                               [disabled]="col.excluida === true">
                        <mat-hint>Identificador interno (sin espacios)</mat-hint>
                      </mat-form-field>

                      <!-- Tipo de dato -->
                      <mat-form-field appearance="outline" class="w-full">
                        <mat-label>Tipo de Dato</mat-label>
                        <mat-select [(value)]="col.tipo_dato" [disabled]="col.excluida === true">
                          <mat-option value="NUMERICO">
                            <mat-icon>numbers</mat-icon> Numérico
                          </mat-option>
                          <mat-option value="CATEGORICO">
                            <mat-icon>category</mat-icon> Categórico
                          </mat-option>
                          <mat-option value="FECHA">
                            <mat-icon>calendar_today</mat-icon> Fecha
                          </mat-option>
                          <mat-option value="TEXTO">
                            <mat-icon>text_fields</mat-icon> Texto
                          </mat-option>
                        </mat-select>
                        <mat-hint>Detectado: {{ col.tipo_detectado }}</mat-hint>
                      </mat-form-field>
                    </div>

                    <!-- Muestra de valores -->
                    <div class="bg-gray-50 p-3 rounded mb-3">
                      <p class="text-sm text-gray-600 mb-1">Muestra de valores:</p>
                      <div class="flex flex-wrap gap-1">
                        @for (val of col.muestra_valores?.slice(0, 5); track val) {
                          <span class="bg-white px-2 py-1 rounded text-sm border">{{ val }}</span>
                        }
                      </div>
                    </div>

                    <!-- Opciones -->
                    <div class="flex items-center gap-4 pb-2">
                      <mat-checkbox [(ngModel)]="col.es_visible" [disabled]="col.excluida === true" color="primary">
                        Visible en Dashboard
                      </mat-checkbox>
                      
                      <button mat-button [color]="col.excluida ? 'primary' : 'warn'" 
                              (click)="toggleExcluir(col)">
                        <mat-icon>{{ col.excluida ? 'add_circle' : 'remove_circle' }}</mat-icon>
                        {{ col.excluida ? 'Incluir columna' : 'Excluir columna' }}
                      </button>
                    </div>
                  </mat-expansion-panel>
                }
              </div>

              @if (processing()) {
                <div class="mt-4">
                  <p class="text-center text-gray-600 mb-2">Importando datos... esto puede tardar unos segundos</p>
                  <mat-progress-bar mode="indeterminate"></mat-progress-bar>
                </div>
              }
            </mat-card-content>

            <mat-card-actions align="end" class="!px-4 !pb-4">
              <button mat-button matStepperPrevious [disabled]="processing()">
                <mat-icon>arrow_back</mat-icon> Atrás
              </button>
              <button mat-raised-button color="primary" 
                      [disabled]="processing() || columnasActivas().length === 0"
                      (click)="confirmImport(stepper)">
                @if (processing()) {
                  <mat-icon class="animate-spin">refresh</mat-icon>
                } @else {
                  <mat-icon>check</mat-icon>
                }
                Confirmar e Importar ({{ columnasActivas().length }} columnas)
              </button>
            </mat-card-actions>
          </mat-card>
        </mat-step>

        <!-- Step 3: Completado -->
        <mat-step label="Completado">
          <mat-card class="mt-4">
            <mat-card-content class="text-center py-8">
              <mat-icon class="text-6xl text-green-500">check_circle</mat-icon>
              <h2 class="text-2xl font-bold text-gray-800 mt-4">¡Importación Exitosa!</h2>
              <p class="text-gray-600 mt-2">
                Se importaron <strong>{{ importedCount() | number }}</strong> registros
                con <strong>{{ columnasActivas().length }}</strong> columnas
              </p>

              <div class="flex justify-center gap-4 mt-6">
                <button mat-button routerLink="/datasets">
                  <mat-icon>list</mat-icon> Ver Datasets
                </button>
                <button mat-raised-button color="primary" 
                        [routerLink]="['/datasets', datasetId()]">
                  <mat-icon>analytics</mat-icon> Ver Datos y Gráficos
                </button>
              </div>
            </mat-card-content>
          </mat-card>
        </mat-step>
      </mat-stepper>
    </div>
  `,
  styles: [`
    .mat-mdc-table {
      background: transparent;
    }
    ::ng-deep .mat-expansion-panel-body {
      padding-top: 8px !important;
    }
  `]
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
  columnasActivas = computed(() => 
    this.columnas().filter(c => !c.excluida)
  );

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
      next: (departamentos) => this.departamentos.set(departamentos || [])
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

    this.datasetService.create(departamento_id, nombre, descripcion, this.selectedFile()!).subscribe({
      next: (dataset) => {
        this.datasetId.set(dataset.id);
        
        // Analizar archivo
        this.datasetService.analizar(dataset.id).subscribe({
          next: (analisis) => {
            // Agregar propiedades extendidas
            const columnasExtendidas = analisis.columnas.map(c => ({
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
          }
        });
      },
      error: (err) => {
        this.uploading.set(false);
        this.error.set(err.error?.message || 'Error al subir el archivo');
      }
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
      }
    });
  }

  getTipoClass(tipo: string): string {
    switch (tipo) {
      case 'NUMERICO': return 'text-blue-600 bg-blue-100 px-2 py-1 rounded text-xs';
      case 'CATEGORICO': return 'text-green-600 bg-green-100 px-2 py-1 rounded text-xs';
      case 'FECHA': return 'text-orange-600 bg-orange-100 px-2 py-1 rounded text-xs';
      default: return 'text-gray-600 bg-gray-100 px-2 py-1 rounded text-xs';
    }
  }
}
