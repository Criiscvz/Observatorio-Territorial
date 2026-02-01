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
  templateUrl: './dataset-list.component.html',
  styleUrl: './dataset-list.component.scss'
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
        this.datasets.set(res?.data || []);
        this.loading.set(false);
      },
      error: () => {
        this.datasets.set([]);
        this.loading.set(false);
      }
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
