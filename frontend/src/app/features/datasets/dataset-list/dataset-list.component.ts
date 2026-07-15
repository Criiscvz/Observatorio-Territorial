import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal, DestroyRef } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { Dataset, Departamento } from '@core/models';
import { AuthService } from '@core/services/auth.service';
import { DepartamentoService } from '@core/services/departamento.service';
import { DatasetService } from '@core/services/dataset.service';
import { ConfirmDialogComponent } from '@shared/components/confirm-dialog/confirm-dialog.component';
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";

interface DatasetGroup {
  departamento: Departamento;
  datasets: Dataset[];
}

@Component({
  selector: 'app-dataset-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatCardModule,
    MatButtonModule,
    MatDialogModule,
    MatIconModule,
    MatChipsModule,
    MatMenuModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    TranslateModule,
  ],
  templateUrl: './dataset-list.component.html',
  styleUrl: './dataset-list.component.scss',
})
export class DatasetListComponent implements OnInit {
    private readonly destroyRef = inject(DestroyRef);
  private authService = inject(AuthService);
  private departamentoService = inject(DepartamentoService);
  private datasetService = inject(DatasetService);
  private dialog = inject(MatDialog);
  private snackBar = inject(MatSnackBar);

  datasets = signal<Dataset[]>([]);
  datasetGroups = signal<DatasetGroup[]>([]);
  loading = signal(true);
  totalDatasets = computed(() => this.datasetGroups().reduce((total, group) => total + group.datasets.length, 0));
  canDeleteDataset = computed(() => this.authService.isAdmin());

  ngOnInit(): void {
    this.loadDatasets();
  }

  loadDatasets(): void {
    this.loading.set(true);
    this.departamentoService.getAll().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (departamentos) => {
        const groups = this.groupDatasetsByDepartamento(departamentos || []);
        this.datasetGroups.set(groups);
        this.datasets.set(groups.flatMap((group) => group.datasets));
        this.loading.set(false);
      },
      error: () => {
        this.datasets.set([]);
        this.datasetGroups.set([]);
        this.loading.set(false);
      },
    });
  }

  private groupDatasetsByDepartamento(departamentos: Departamento[]): DatasetGroup[] {
    return departamentos
      .map((departamento) => ({
        departamento,
        datasets: (departamento.datasets || []).map((dataset) => ({
          ...dataset,
          departamento_id: dataset.departamento_id || departamento.id,
          departamento,
        })),
      }))
      .filter((group) => group.datasets.length > 0);
  }

  getEstadoColor(estado: string): 'primary' | 'accent' | 'warn' {
    switch (estado) {
      case 'COMPLETADO':
        return 'primary';
      case 'PROCESANDO':
        return 'accent';
      default:
        return 'warn';
    }
  }

  getDatasetStatusLabel(status?: string): string {
    const normalized = String(status || '').trim().toUpperCase();

    const labels: Record<string, string> = {
      COMPLETADO: 'Completado',
      COMPLETED: 'Completado',
      PROCESANDO: 'Procesando',
      PROCESSING: 'Procesando',
      PENDIENTE: 'Pendiente',
      PENDING: 'Pendiente',
      ERROR: 'Error',
    };

    return labels[normalized] || 'Disponible';
  }

  getDatasetStatusIcon(status?: string): string {
    const normalized = String(status || '').trim().toUpperCase();

    if (normalized === 'COMPLETADO' || normalized === 'COMPLETED') return 'check_circle';
    if (normalized === 'PROCESANDO' || normalized === 'PROCESSING') return 'sync';
    if (normalized === 'ERROR') return 'error';
    if (normalized === 'PENDIENTE' || normalized === 'PENDING') return 'schedule';

    return 'database';
  }

  getDatasetStatusClass(status?: string): string {
    const normalized = String(status || '').trim().toUpperCase();

    if (normalized === 'COMPLETADO' || normalized === 'COMPLETED') return 'is-completed';
    if (normalized === 'PROCESANDO' || normalized === 'PROCESSING') return 'is-processing';
    if (normalized === 'ERROR') return 'is-error';
    if (normalized === 'PENDIENTE' || normalized === 'PENDING') return 'is-pending';

    return 'is-available';
  }

  getDatasetDate(dataset: Dataset): string | null {
    return dataset.fecha_carga || dataset.created_at || dataset.updated_at || null;
  }

  deleteDataset(dataset: Dataset): void {
    if (!this.canDeleteDataset()) {
      this.snackBar.open('No tienes permiso para eliminar datasets.', 'Cerrar', {
        duration: 3500,
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
        title: 'Eliminar conjunto de datos',
        message:
          'Esta acción eliminará permanentemente el conjunto de datos y sus registros asociados. No se puede deshacer.',
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

        this.datasetService
          .delete(dataset.id)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: () => {
              this.snackBar.open('Conjunto de datos eliminado correctamente.', 'Cerrar', {
                duration: 3500,
              });
              this.loadDatasets();
            },
            error: () => {
              this.snackBar.open('No se pudo eliminar el conjunto de datos.', 'Cerrar', {
                duration: 4000,
              });
            },
          });
      });
  }
}
