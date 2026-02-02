import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Dataset, Departamento } from '@core/models';
import { DatasetService } from '@core/services/dataset.service';
import { DepartamentoService } from '@core/services/departamento.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-departamento-detail',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatProgressSpinnerModule,
    TranslateModule,
  ],
  templateUrl: './departamento-detail.component.html',
  styleUrl: './departamento-detail.component.scss',
})
export class DepartamentoDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly deptoService = inject(DepartamentoService);
  private readonly datasetService = inject(DatasetService);
  private readonly translate = inject(TranslateService);

  departamento = signal<Departamento | null>(null);
  datasets = signal<Dataset[]>([]);
  loading = signal(true);

  ngOnInit(): void {
    const id = this.route.snapshot.params['id'];
    this.loadDepartamento(id);
  }

  loadDepartamento(id: string): void {
    this.deptoService.getById(id).subscribe({
      next: (departamento) => {
        this.departamento.set(departamento);
        this.datasets.set(departamento?.datasets || []);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  getEstadoClass(estado: string): string {
    switch (estado) {
      case 'COMPLETADO':
        return 'badge-success';
      case 'PROCESANDO':
        return 'badge-warning';
      case 'ERROR':
        return 'badge-error';
      default:
        return 'badge-neutral';
    }
  }

  deleteDepartamento(): void {
    const depto = this.departamento();
    if (!depto) return;

    const message = this.translate.instant('departamentos.detail.confirmDelete', {
      name: depto.nombre,
    });
    if (confirm(message)) {
      this.deptoService.delete(depto.id).subscribe({
        next: () => {
          this.router.navigate(['/admin/dashboard']);
        },
        error: (err) => {
          console.error('Error al eliminar departamento:', err);
        },
      });
    }
  }

  deleteDataset(dataset: Dataset): void {
    const message = this.translate.instant('datasets.list.confirmDelete', { name: dataset.nombre });
    if (confirm(message)) {
      this.datasetService.delete(dataset.id).subscribe({
        next: () => {
          // Recargar los datasets
          const id = this.departamento()?.id;
          if (id) {
            this.loadDepartamento(id);
          }
        },
        error: (err) => {
          console.error('Error al eliminar dataset:', err);
        },
      });
    }
  }
}
