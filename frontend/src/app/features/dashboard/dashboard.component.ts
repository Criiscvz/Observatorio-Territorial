import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatListModule } from '@angular/material/list';
import { MatDividerModule } from '@angular/material/divider';
import { DepartamentoService } from '../../core/services/departamento.service';
import { AuthService } from '../../core/services/auth.service';
import { Departamento, Dataset } from '../../core/models';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatListModule,
    MatDividerModule,
  ],
  template: `
    <div class="space-y-6">
      <!-- Header -->
      <div class="flex justify-between items-center">
        <div>
          <h1 class="text-3xl font-bold text-gray-800">Dashboard</h1>
          <p class="text-gray-500">Bienvenido, {{ authService.user()?.name }}</p>
        </div>
        <div class="flex gap-2">
          <a mat-raised-button color="primary" routerLink="/departamentos/nuevo">
            <mat-icon>add</mat-icon>
            Nuevo Departamento
          </a>
          <a mat-raised-button routerLink="/datasets/nuevo">
            <mat-icon>upload</mat-icon>
            Importar Dataset
          </a>
        </div>
      </div>

      @if (loading()) {
        <div class="flex justify-center py-12">
          <mat-spinner></mat-spinner>
        </div>
      } @else {
        <!-- Stats Cards -->
        <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
          <mat-card class="bg-gradient-to-r from-red-500 to-red-600 text-white">
            <mat-card-content class="py-4">
              <div class="flex items-center gap-4">
                <mat-icon class="text-4xl">folder</mat-icon>
                <div>
                  <p class="text-sm opacity-80">Departamentos</p>
                  <p class="text-3xl font-bold">{{ departamentos().length }}</p>
                </div>
              </div>
            </mat-card-content>
          </mat-card>

          <mat-card class="bg-gradient-to-r from-blue-500 to-blue-600 text-white">
            <mat-card-content class="py-4">
              <div class="flex items-center gap-4">
                <mat-icon class="text-4xl">table_chart</mat-icon>
                <div>
                  <p class="text-sm opacity-80">Datasets</p>
                  <p class="text-3xl font-bold">{{ totalDatasets() }}</p>
                </div>
              </div>
            </mat-card-content>
          </mat-card>

          <mat-card class="bg-gradient-to-r from-green-500 to-green-600 text-white">
            <mat-card-content class="py-4">
              <div class="flex items-center gap-4">
                <mat-icon class="text-4xl">analytics</mat-icon>
                <div>
                  <p class="text-sm opacity-80">Registros Totales</p>
                  <p class="text-3xl font-bold">{{ totalRegistros() | number }}</p>
                </div>
              </div>
            </mat-card-content>
          </mat-card>

          <mat-card class="bg-gradient-to-r from-purple-500 to-purple-600 text-white">
            <mat-card-content class="py-4">
              <div class="flex items-center gap-4">
                <mat-icon class="text-4xl">public</mat-icon>
                <div>
                  <p class="text-sm opacity-80">Públicos</p>
                  <p class="text-3xl font-bold">{{ departamentosPublicos() }}</p>
                </div>
              </div>
            </mat-card-content>
          </mat-card>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <!-- Departamentos Recientes -->
          <mat-card>
            <mat-card-header>
              <mat-icon mat-card-avatar class="!text-red-500">folder</mat-icon>
              <mat-card-title>Departamentos Recientes</mat-card-title>
              <mat-card-subtitle>Últimos departamentos agregados</mat-card-subtitle>
            </mat-card-header>
            <mat-card-content>
              @if (departamentos().length > 0) {
                <mat-list>
                  @for (depto of departamentosRecientes(); track depto.id; let last = $last) {
                    <a mat-list-item [routerLink]="['/departamentos', depto.id]" class="hover:bg-gray-50">
                      <mat-icon matListItemIcon class="!text-red-500">business</mat-icon>
                      <div matListItemTitle>{{ depto.nombre }}</div>
                      <div matListItemLine class="text-sm text-gray-500">
                        {{ depto.datasets?.length || 0 }} datasets
                        @if (depto.publico) {
                          <span class="ml-2 text-green-600">• Público</span>
                        }
                      </div>
                      <mat-icon matListItemMeta>chevron_right</mat-icon>
                    </a>
                    @if (!last) {
                      <mat-divider></mat-divider>
                    }
                  }
                </mat-list>
              } @else {
                <div class="text-center py-8 text-gray-500">
                  <mat-icon class="text-4xl">folder_off</mat-icon>
                  <p class="mt-2">No hay departamentos</p>
                </div>
              }
            </mat-card-content>
            <mat-card-actions align="end">
              <a mat-button color="primary" routerLink="/departamentos/nuevo">
                <mat-icon>add</mat-icon> Crear Departamento
              </a>
            </mat-card-actions>
          </mat-card>

          <!-- Datasets Recientes -->
          <mat-card>
            <mat-card-header>
              <mat-icon mat-card-avatar class="!text-blue-500">description</mat-icon>
              <mat-card-title>Datasets Recientes</mat-card-title>
              <mat-card-subtitle>Últimos datos importados</mat-card-subtitle>
            </mat-card-header>
            <mat-card-content>
              @if (datasetsRecientes().length > 0) {
                <mat-list>
                  @for (ds of datasetsRecientes(); track ds.id; let last = $last) {
                    <a mat-list-item [routerLink]="['/datasets', ds.id]" class="hover:bg-gray-50">
                      <mat-icon matListItemIcon class="!text-blue-500">table_chart</mat-icon>
                      <div matListItemTitle>{{ ds.nombre }}</div>
                      <div matListItemLine class="text-sm text-gray-500">
                        {{ ds.total_registros | number }} registros
                        <span class="ml-2" [class]="getEstadoClass(ds.estado)">• {{ ds.estado }}</span>
                      </div>
                      <mat-icon matListItemMeta>chevron_right</mat-icon>
                    </a>
                    @if (!last) {
                      <mat-divider></mat-divider>
                    }
                  }
                </mat-list>
              } @else {
                <div class="text-center py-8 text-gray-500">
                  <mat-icon class="text-4xl">description</mat-icon>
                  <p class="mt-2">No hay datasets</p>
                </div>
              }
            </mat-card-content>
            <mat-card-actions align="end">
              <a mat-button color="primary" routerLink="/datasets/nuevo">
                <mat-icon>upload</mat-icon> Importar Dataset
              </a>
            </mat-card-actions>
          </mat-card>
        </div>

        <!-- Accesos Rápidos -->
        <mat-card>
          <mat-card-header>
            <mat-icon mat-card-avatar class="!text-orange-500">bolt</mat-icon>
            <mat-card-title>Accesos Rápidos</mat-card-title>
            <mat-card-subtitle>Accede rápidamente a las funciones principales</mat-card-subtitle>
          </mat-card-header>
          <mat-card-content>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4">
              <a routerLink="/departamentos/nuevo" 
                 class="p-4 rounded-lg border-2 border-dashed border-gray-200 hover:border-red-300 hover:bg-red-50 transition-all text-center">
                <mat-icon class="text-3xl text-red-500">add_business</mat-icon>
                <p class="font-medium mt-2">Nuevo Departamento</p>
              </a>
              
              <a routerLink="/datasets/nuevo"
                 class="p-4 rounded-lg border-2 border-dashed border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-all text-center">
                <mat-icon class="text-3xl text-blue-500">cloud_upload</mat-icon>
                <p class="font-medium mt-2">Importar Excel</p>
              </a>
              
              <a routerLink="/datasets"
                 class="p-4 rounded-lg border-2 border-dashed border-gray-200 hover:border-green-300 hover:bg-green-50 transition-all text-center">
                <mat-icon class="text-3xl text-green-500">folder_open</mat-icon>
                <p class="font-medium mt-2">Ver Datasets</p>
              </a>

              @if (datasetsRecientes().length > 0) {
                <a [routerLink]="['/datasets', datasetsRecientes()[0].id]"
                   class="p-4 rounded-lg border-2 border-dashed border-gray-200 hover:border-purple-300 hover:bg-purple-50 transition-all text-center">
                  <mat-icon class="text-3xl text-purple-500">analytics</mat-icon>
                  <p class="font-medium mt-2">Último Análisis</p>
                </a>
              } @else {
                <div class="p-4 rounded-lg border-2 border-dashed border-gray-200 text-center opacity-50">
                  <mat-icon class="text-3xl text-gray-400">analytics</mat-icon>
                  <p class="font-medium mt-2">Sin análisis</p>
                </div>
              }
            </div>
          </mat-card-content>
        </mat-card>
      }
    </div>
  `
})
export class DashboardComponent implements OnInit {
  private readonly deptoService = inject(DepartamentoService);
  authService = inject(AuthService);

  departamentos = signal<Departamento[]>([]);
  loading = signal(true);

  // Computed values
  totalDatasets = computed(() => {
    let count = 0;
    this.departamentos().forEach(d => {
      count += d.datasets?.length || 0;
    });
    return count;
  });

  totalRegistros = computed(() => {
    let count = 0;
    this.departamentos().forEach(d => {
      d.datasets?.forEach(ds => {
        count += ds.total_registros || 0;
      });
    });
    return count;
  });

  departamentosPublicos = computed(() => {
    return this.departamentos().filter(d => d.publico).length;
  });

  departamentosRecientes = computed(() => {
    return this.departamentos().slice(0, 5);
  });

  datasetsRecientes = computed(() => {
    const allDatasets: Dataset[] = [];
    this.departamentos().forEach(d => {
      d.datasets?.forEach(ds => {
        allDatasets.push(ds);
      });
    });
    // Ordenar por fecha y tomar los últimos 5
    return allDatasets
      .sort((a, b) => new Date(b.fecha_carga || 0).getTime() - new Date(a.fecha_carga || 0).getTime())
      .slice(0, 5);
  });

  ngOnInit(): void {
    this.loadDepartamentos();
  }

  loadDepartamentos(): void {
    this.deptoService.getAll().subscribe({
      next: (departamentos) => {
        this.departamentos.set(departamentos || []);
        this.loading.set(false);
      },
      error: () => {
        this.departamentos.set([]);
        this.loading.set(false);
      }
    });
  }

  getEstadoClass(estado: string): string {
    switch (estado) {
      case 'COMPLETADO': return 'text-green-600';
      case 'PROCESANDO': return 'text-yellow-600';
      case 'ERROR': return 'text-red-600';
      default: return 'text-gray-600';
    }
  }
}
