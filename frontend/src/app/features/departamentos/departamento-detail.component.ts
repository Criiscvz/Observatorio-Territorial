import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { DepartamentoService } from '../../core/services/departamento.service';
import { Departamento, Dataset } from '../../core/models';

@Component({
  selector: 'app-departamento-detail',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  template: `
    @if (loading()) {
      <div class="flex justify-center py-12">
        <mat-spinner></mat-spinner>
      </div>
    } @else if (departamento()) {
      <div class="space-y-6">
        <!-- Header -->
        <div class="flex justify-between items-start">
          <div>
            <h1 class="text-3xl font-bold text-gray-800">{{ departamento()?.nombre }}</h1>
            <p class="text-gray-500">{{ departamento()?.descripcion || 'Sin descripción' }}</p>
            <p class="text-sm text-gray-400 mt-1">
              Código: {{ departamento()?.codigo_interno }}
              @if (departamento()?.publico) {
                <span class="ml-2 bg-green-100 text-green-800 px-2 py-1 rounded text-xs">Público</span>
              }
            </p>
          </div>
          <div class="flex gap-2">
            <a mat-button [routerLink]="['/departamentos', departamento()?.id, 'editar']">
              <mat-icon>edit</mat-icon>
              Editar
            </a>
            <a mat-raised-button color="primary" 
               [routerLink]="['/datasets/nuevo']" 
               [queryParams]="{departamento: departamento()?.id}">
              <mat-icon>upload</mat-icon>
              Importar Dataset
            </a>
          </div>
        </div>

        <!-- Lista de Datasets -->
        @if (datasets().length > 0) {
          <div class="space-y-4">
            <h2 class="text-xl font-semibold text-gray-700">Datasets del Departamento</h2>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              @for (dataset of datasets(); track dataset.id) {
                <mat-card class="cursor-pointer hover:shadow-lg transition-shadow">
                  <mat-card-header>
                    <mat-icon mat-card-avatar class="!text-red-500">description</mat-icon>
                    <mat-card-title>{{ dataset.nombre }}</mat-card-title>
                    <mat-card-subtitle>
                      {{ dataset.total_registros | number }} registros
                    </mat-card-subtitle>
                  </mat-card-header>
                  <mat-card-content>
                    <p class="text-sm text-gray-500 mb-2">
                      {{ dataset.descripcion || 'Sin descripción' }}
                    </p>
                    <div class="flex items-center gap-2">
                      <span class="text-xs px-2 py-1 rounded" [class]="getEstadoClass(dataset.estado)">
                        {{ dataset.estado }}
                      </span>
                      <span class="text-xs text-gray-400">
                        {{ dataset.fecha_carga | date:'shortDate' }}
                      </span>
                    </div>
                  </mat-card-content>
                  <mat-card-actions align="end">
                    <a mat-button color="primary" [routerLink]="['/datasets', dataset.id]">
                      <mat-icon>analytics</mat-icon>
                      Ver Análisis
                    </a>
                  </mat-card-actions>
                </mat-card>
              }
            </div>
          </div>
        } @else {
          <mat-card>
            <mat-card-content class="text-center py-12">
              <mat-icon class="text-6xl text-gray-300">insert_chart</mat-icon>
              <h3 class="text-xl text-gray-600 mt-4">Sin datasets</h3>
              <p class="text-gray-500 mb-4">Importa un archivo Excel para comenzar el análisis</p>
              <a mat-raised-button color="primary" 
                 [routerLink]="['/datasets/nuevo']" 
                 [queryParams]="{departamento: departamento()?.id}">
                <mat-icon>upload</mat-icon>
                Importar Dataset
              </a>
            </mat-card-content>
          </mat-card>
        }
      </div>
    }
  `
})
export class DepartamentoDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly deptoService = inject(DepartamentoService);

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
      error: () => this.loading.set(false)
    });
  }

  getEstadoClass(estado: string): string {
    switch (estado) {
      case 'COMPLETADO': return 'bg-green-100 text-green-800';
      case 'PROCESANDO': return 'bg-yellow-100 text-yellow-800';
      case 'ERROR': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  }
}
