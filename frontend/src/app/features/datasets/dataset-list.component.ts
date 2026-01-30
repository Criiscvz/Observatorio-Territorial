import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { DatasetService } from '../../core/services/dataset.service';
import { Dataset } from '../../core/models';

@Component({
  selector: 'app-dataset-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatChipsModule,
    MatMenuModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <div class="space-y-6">
      <div class="flex justify-between items-center">
        <h1 class="text-2xl font-bold text-gray-800">Datasets</h1>
        <a mat-raised-button color="primary" routerLink="/datasets/nuevo">
          <mat-icon>add</mat-icon>
          Nuevo Dataset
        </a>
      </div>

      @if (loading()) {
        <div class="flex justify-center py-12">
          <mat-spinner></mat-spinner>
        </div>
      } @else if (datasets().length === 0) {
        <mat-card>
          <mat-card-content class="text-center py-12">
            <mat-icon class="text-6xl text-gray-300">table_chart</mat-icon>
            <h3 class="text-xl text-gray-600 mt-4">No hay datasets</h3>
            <p class="text-gray-500 mb-4">Importa tu primer archivo Excel</p>
            <a mat-raised-button color="primary" routerLink="/datasets/nuevo">
              <mat-icon>add</mat-icon>
              Importar Dataset
            </a>
          </mat-card-content>
        </mat-card>
      } @else {
        <mat-card>
          <table mat-table [dataSource]="datasets()" class="w-full">
            <ng-container matColumnDef="nombre">
              <th mat-header-cell *matHeaderCellDef>Nombre</th>
              <td mat-cell *matCellDef="let ds">
                <span class="font-medium">{{ ds.nombre }}</span>
                <br>
                <span class="text-xs text-gray-500">{{ ds.nombre_archivo }}</span>
              </td>
            </ng-container>

            <ng-container matColumnDef="departamento">
              <th mat-header-cell *matHeaderCellDef>Departamento</th>
              <td mat-cell *matCellDef="let ds">{{ ds.departamento?.nombre }}</td>
            </ng-container>

            <ng-container matColumnDef="estado">
              <th mat-header-cell *matHeaderCellDef>Estado</th>
              <td mat-cell *matCellDef="let ds">
                <mat-chip [color]="getEstadoColor(ds.estado)">
                  {{ ds.estado }}
                </mat-chip>
              </td>
            </ng-container>

            <ng-container matColumnDef="registros">
              <th mat-header-cell *matHeaderCellDef>Registros</th>
              <td mat-cell *matCellDef="let ds">{{ ds.total_registros | number }}</td>
            </ng-container>

            <ng-container matColumnDef="fecha">
              <th mat-header-cell *matHeaderCellDef>Fecha</th>
              <td mat-cell *matCellDef="let ds">{{ ds.fecha_carga | date:'short' }}</td>
            </ng-container>

            <ng-container matColumnDef="acciones">
              <th mat-header-cell *matHeaderCellDef></th>
              <td mat-cell *matCellDef="let ds">
                <button mat-icon-button [matMenuTriggerFor]="menu">
                  <mat-icon>more_vert</mat-icon>
                </button>
                <mat-menu #menu="matMenu">
                  <button mat-menu-item [routerLink]="['/departamentos', ds.departamento_id]">
                    <mat-icon>dashboard</mat-icon>
                    <span>Ver Dashboard</span>
                  </button>
                  @if (ds.estado === 'PENDIENTE') {
                    <button mat-menu-item [routerLink]="['/datasets', ds.id, 'importar']">
                      <mat-icon>upload</mat-icon>
                      <span>Continuar Importación</span>
                    </button>
                  }
                  <button mat-menu-item (click)="deleteDataset(ds)">
                    <mat-icon color="warn">delete</mat-icon>
                    <span class="text-red-600">Eliminar</span>
                  </button>
                </mat-menu>
              </td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
            <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
          </table>
        </mat-card>
      }
    </div>
  `
})
export class DatasetListComponent implements OnInit {
  private datasetService = inject(DatasetService);

  datasets = signal<Dataset[]>([]);
  loading = signal(true);

  displayedColumns = ['nombre', 'departamento', 'estado', 'registros', 'fecha', 'acciones'];

  ngOnInit(): void {
    this.loadDatasets();
  }

  loadDatasets(): void {
    this.loading.set(true);
    this.datasetService.getAll().subscribe({
      next: (res) => {
        this.datasets.set(res.data);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  getEstadoColor(estado: string): 'primary' | 'accent' | 'warn' {
    switch (estado) {
      case 'COMPLETADO': return 'primary';
      case 'PROCESANDO': return 'accent';
      default: return 'warn';
    }
  }

  deleteDataset(dataset: Dataset): void {
    if (confirm(`¿Eliminar el dataset "${dataset.nombre}"?`)) {
      this.datasetService.delete(dataset.id).subscribe({
        next: () => this.loadDatasets()
      });
    }
  }
}
