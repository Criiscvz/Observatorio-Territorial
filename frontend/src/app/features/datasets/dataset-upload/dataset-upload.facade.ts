import { Injectable, computed, inject, signal, DestroyRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { EMPTY, switchMap } from 'rxjs';
import { ColumnaAnalizada, Departamento } from '@core/models';
import { DatasetService } from '@core/services/dataset.service';
import { DepartamentoService } from '@core/services/departamento.service';
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";

export interface ColumnaExtendida extends ColumnaAnalizada {
  excluida?: boolean;
  nombre_personalizado?: string;
}

/**
 * Façade de DatasetUpload.
 *
 * Centraliza todo el estado reactivo y la orquestación de flujos HTTP del
 * proceso de carga de datasets, desacoplando la lógica de negocio del componente
 * de presentación (patrón MVVM).
 *
 * La cadena upload → analyze se implementa con `switchMap` para eliminar las
 * suscripciones anidadas (callback hell) y producir un flujo declarativo y testeable.
 *
 * Este servicio es provisto en el decorador `@Component` del componente correspondiente
 * (`providers: [DatasetUploadFacade]`) para que su ciclo de vida esté ligado al
 * del componente y no contamine el árbol de inyección raíz.
 */
@Injectable()
export class DatasetUploadFacade {
    private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly datasetService = inject(DatasetService);
  private readonly deptoService = inject(DepartamentoService);
  private readonly translate = inject(TranslateService);

  // ── Estado ────────────────────────────────────────────────────────────────

  readonly departamentos = signal<Departamento[]>([]);
  readonly selectedFile = signal<File | null>(null);
  readonly uploading = signal(false);
  readonly processing = signal(false);
  readonly error = signal<string | null>(null);

  readonly datasetId = signal<string | null>(null);
  readonly columnas = signal<ColumnaExtendida[]>([]);
  readonly totalFilas = signal(0);
  readonly importedCount = signal(0);

  /** Columnas activas (no excluidas por el usuario) */
  readonly columnasActivas = computed(() => this.columnas().filter((c) => !c.excluida));

  // ── Formulario ────────────────────────────────────────────────────────────

  readonly uploadForm: FormGroup = this.fb.group({
    departamento_id: ['', Validators.required],
    nombre: ['', Validators.required],
    descripcion: [''],
  });

  // ── Métodos públicos ──────────────────────────────────────────────────────

  /** Carga la lista de departamentos disponibles */
  loadDepartamentos(): void {
    this.deptoService.getAll().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (departamentos) => this.departamentos.set(departamentos || []),
    });
  }

  /**
   * Orquesta el flujo Upload → Analyze usando `switchMap` para aplanar las
   * suscripciones anidadas en una cadena declarativa.
   *
   * @param stepper - Referencia al MatStepper para avanzar al siguiente paso.
   */
  uploadAndAnalyze(stepper: any): void {
    if (this.uploadForm.invalid) {
      this.uploadForm.markAllAsTouched();
      this.error.set(this.translate.instant('datasets.upload.errors.requiredFields'));
      return;
    }

    if (!this.selectedFile()) {
      this.error.set(this.translate.instant('datasets.upload.errors.fileRequired'));
      return;
    }

    this.uploading.set(true);
    this.error.set(null);

    const { departamento_id, nombre, descripcion } = this.uploadForm.value;

    this.datasetService
      .create(departamento_id, nombre, descripcion, this.selectedFile()!)
      .pipe(
        // Encadena la creación con el análisis en un único flujo observable
        switchMap((dataset) => {
          this.datasetId.set(dataset.id);
          return this.datasetService.analizar(dataset.id);
        }),
      )
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: (analisis) => {
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
          this.error.set(
            err.error?.message ?? this.translate.instant('datasets.upload.errors.uploadFailed'),
          );
        },
      });
  }

  /** Confirma la importación con las columnas activas (no excluidas) */
  confirmImport(stepper: any): void {
    if (!this.datasetId()) {
      this.error.set(this.translate.instant('datasets.upload.errors.analyzeFirst'));
      return;
    }

    const columnasAImportar = this.columnasActivas().map((columna) =>
      this.toImportColumnPayload(columna),
    );

    if (columnasAImportar.length === 0) {
      this.error.set(this.translate.instant('datasets.upload.errors.noColumns'));
      return;
    }

    this.processing.set(true);
    this.error.set(null);

    this.datasetService.confirmar(this.datasetId()!, columnasAImportar).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => {
        this.importedCount.set(res.total_registros);
        this.processing.set(false);
        stepper.next();
      },
      error: (err) => {
        this.processing.set(false);
        this.error.set(
          err.error?.message ?? this.translate.instant('datasets.upload.errors.importFailed'),
        );
      },
    });
  }

  /** Alterna la exclusión de una columna y fuerza la actualización de la señal */
  toggleExcluir(columna: ColumnaExtendida): void {
    columna.excluida = !columna.excluida;
    this.columnas.set([...this.columnas()]);
  }

  private toImportColumnPayload(columna: ColumnaExtendida): ColumnaAnalizada {
    return {
      nombre_columna: columna.nombre_columna,
      nombre_original: columna.nombre_original,
      tipo_detectado: columna.tipo_detectado,
      tipo_dato: columna.tipo_dato,
      es_visible: columna.es_visible ?? true,
      orden: columna.orden,
      opciones: columna.opciones ?? undefined,
      muestra_valores: columna.muestra_valores,
    };
  }

  /**
   * Formatea un tamaño en bytes a una cadena legible (KB, MB, GB…)
   * Movido al Façade para mantener la vista libre de lógica de presentación auxiliar.
   */
  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /** Retorna la clase CSS para el badge de tipo de columna */
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

  /** Navega a la lista de datasets tras finalizar la importación */
  navigateToList(): void {
    this.router.navigate(['/admin/datasets']);
  }
}
