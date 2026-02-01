import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { DepartamentoService } from '../../core/services/departamento.service';
import { Departamento, Dataset } from '../../core/models';

@Component({
  selector: 'app-public-departamento-detail',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatChipsModule,
  ],
  template: `
    <div class="page-container">
      @if (loading()) {
        <div class="loading-container">
          <mat-spinner diameter="48"></mat-spinner>
          <p>Cargando departamento...</p>
        </div>
      } @else if (departamento()) {
        <!-- Breadcrumb -->
        <nav class="breadcrumb">
          <a routerLink="/publico/departamentos">
            <mat-icon>arrow_back</mat-icon>
            Departamentos
          </a>
        </nav>

        <!-- Department Header -->
        <div class="department-header">
          <div class="header-avatar" [style.background]="deptoGradient">
            {{ departamento()!.nombre.charAt(0).toUpperCase() }}
          </div>
          <div class="header-info">
            <h1>{{ departamento()!.nombre }}</h1>
            <p class="description">{{ departamento()!.descripcion || 'Sin descripción' }}</p>
            <div class="header-stats">
              <span class="stat">
                <mat-icon>table_chart</mat-icon>
                {{ departamento()!.datasets?.length || 0 }} datasets
              </span>
              <span class="stat">
                <mat-icon>storage</mat-icon>
                {{ totalRegistros | number }} registros
              </span>
            </div>
          </div>
        </div>

        <!-- Datasets Section -->
        <section class="datasets-section">
          <h2 class="section-title">
            <mat-icon>folder_open</mat-icon>
            Datasets Disponibles
          </h2>

          @if (datasets.length > 0) {
            <div class="datasets-grid">
              @for (ds of datasets; track ds.id; let i = $index) {
                <a [routerLink]="['/publico/datasets', ds.id]" class="dataset-card">
                  <div class="card-icon" [style.background]="getDatasetColor(i)">
                    <mat-icon>description</mat-icon>
                  </div>
                  <div class="card-content">
                    <h3>{{ ds.nombre }}</h3>
                    <div class="dataset-meta">
                      <span class="meta-item">
                        <mat-icon>grid_on</mat-icon>
                        {{ ds.total_registros | number }} registros
                      </span>
                      @if (ds.created_at) {
                        <span class="meta-item">
                          <mat-icon>calendar_today</mat-icon>
                          {{ ds.created_at | date:'dd/MM/yyyy' }}
                        </span>
                      }
                    </div>
                    <div class="variables-preview">
                      @if (ds.variables && ds.variables.length > 0) {
                        @for (v of ds.variables.slice(0, 4); track v.id) {
                          <span class="variable-chip" [class]="getTypeClass(v.tipo_dato)">
                            {{ v.nombre_original }}
                          </span>
                        }
                        @if (ds.variables.length > 4) {
                          <span class="more-chip">+{{ ds.variables.length - 4 }}</span>
                        }
                      }
                    </div>
                  </div>
                  <mat-icon class="card-arrow">chevron_right</mat-icon>
                </a>
              }
            </div>
          } @else {
            <div class="empty-state">
              <mat-icon>folder_off</mat-icon>
              <h3>Sin datasets</h3>
              <p>Este departamento aún no tiene datasets públicos disponibles</p>
            </div>
          }
        </section>
      } @else {
        <!-- Error state -->
        <div class="error-state">
          <mat-icon>error_outline</mat-icon>
          <h2>Departamento no encontrado</h2>
          <p>El departamento que buscas no existe o no está disponible públicamente</p>
          <a mat-stroked-button routerLink="/publico/departamentos">
            <mat-icon>arrow_back</mat-icon>
            Volver a departamentos
          </a>
        </div>
      }
    </div>
  `,
  styles: [`
    .page-container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 2rem 1.5rem;
    }

    /* Loading */
    .loading-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 6rem;
      color: var(--text-secondary);
    }

    .loading-container p {
      margin-top: 1rem;
    }

    /* Breadcrumb */
    .breadcrumb {
      margin-bottom: 1.5rem;
    }

    .breadcrumb a {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      color: var(--text-secondary);
      text-decoration: none;
      font-size: 0.875rem;
      font-weight: 500;
      transition: color var(--transition-fast);
    }

    .breadcrumb a:hover {
      color: var(--primary-600);
    }

    .breadcrumb mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    /* Department Header */
    .department-header {
      display: flex;
      align-items: flex-start;
      gap: 1.5rem;
      padding: 2rem;
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: var(--radius-xl);
      margin-bottom: 2rem;
    }

    @media (max-width: 640px) {
      .department-header {
        flex-direction: column;
        text-align: center;
        align-items: center;
      }
    }

    .header-avatar {
      width: 80px;
      height: 80px;
      border-radius: var(--radius-xl);
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: 700;
      font-size: 2rem;
      flex-shrink: 0;
    }

    .header-info h1 {
      font-size: 1.75rem;
      font-weight: 700;
      color: var(--text-primary);
      margin: 0 0 0.5rem;
    }

    .description {
      color: var(--text-secondary);
      line-height: 1.6;
      margin: 0 0 1rem;
    }

    .header-stats {
      display: flex;
      gap: 1.5rem;
      flex-wrap: wrap;
    }

    @media (max-width: 640px) {
      .header-stats { justify-content: center; }
    }

    .stat {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.875rem;
      color: var(--text-secondary);
    }

    .stat mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      color: var(--primary-600);
    }

    /* Datasets Section */
    .datasets-section {
      margin-top: 2rem;
    }

    .section-title {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 1.25rem;
      font-weight: 600;
      color: var(--text-primary);
      margin-bottom: 1.5rem;
    }

    .section-title mat-icon {
      color: var(--primary-600);
    }

    /* Datasets Grid */
    .datasets-grid {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .dataset-card {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 1.25rem;
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: var(--radius-lg);
      text-decoration: none;
      transition: all var(--transition-fast);
    }

    .dataset-card:hover {
      border-color: var(--primary-300);
      box-shadow: 0 8px 24px var(--shadow-color);
    }

    .card-icon {
      width: 48px;
      height: 48px;
      border-radius: var(--radius-lg);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .card-icon mat-icon {
      color: white;
      font-size: 24px;
      width: 24px;
      height: 24px;
    }

    .card-content {
      flex: 1;
      min-width: 0;
    }

    .card-content h3 {
      font-size: 1rem;
      font-weight: 600;
      color: var(--text-primary);
      margin: 0 0 0.5rem;
    }

    .dataset-meta {
      display: flex;
      gap: 1rem;
      flex-wrap: wrap;
      margin-bottom: 0.5rem;
    }

    .meta-item {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      font-size: 0.75rem;
      color: var(--text-tertiary);
    }

    .meta-item mat-icon {
      font-size: 14px;
      width: 14px;
      height: 14px;
    }

    .variables-preview {
      display: flex;
      flex-wrap: wrap;
      gap: 0.375rem;
    }

    .variable-chip {
      font-size: 0.625rem;
      padding: 0.125rem 0.375rem;
      border-radius: var(--radius-sm);
      text-transform: uppercase;
      font-weight: 500;
    }

    .variable-chip.type-numeric {
      background: var(--type-numeric-bg);
      color: var(--type-numeric-color);
    }

    .variable-chip.type-categoric {
      background: var(--type-categoric-bg);
      color: var(--type-categoric-color);
    }

    .variable-chip.type-date {
      background: var(--type-date-bg);
      color: var(--type-date-color);
    }

    .variable-chip.type-text {
      background: var(--type-text-bg);
      color: var(--type-text-color);
    }

    .more-chip {
      font-size: 0.625rem;
      padding: 0.125rem 0.375rem;
      background: var(--bg-tertiary);
      color: var(--text-secondary);
      border-radius: var(--radius-sm);
    }

    .card-arrow {
      color: var(--text-tertiary);
      transition: transform var(--transition-fast);
    }

    .dataset-card:hover .card-arrow {
      transform: translateX(4px);
      color: var(--primary-600);
    }

    /* Empty State */
    .empty-state, .error-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 4rem;
      text-align: center;
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: var(--radius-xl);
    }

    .empty-state mat-icon, .error-state mat-icon {
      font-size: 64px;
      width: 64px;
      height: 64px;
      color: var(--text-tertiary);
      opacity: 0.5;
    }

    .empty-state h3, .error-state h2 {
      font-size: 1.25rem;
      font-weight: 600;
      color: var(--text-primary);
      margin: 1rem 0 0.5rem;
    }

    .empty-state p, .error-state p {
      color: var(--text-secondary);
      margin: 0 0 1.5rem;
    }
  `]
})
export class PublicDepartamentoDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private deptoService = inject(DepartamentoService);

  departamento = signal<Departamento | null>(null);
  loading = signal(true);

  deptoGradient = 'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)';

  private datasetColors = [
    '#6366F1', '#EC4899', '#14B8A6', '#F59E0B', '#EF4444',
    '#8B5CF6', '#06B6D4', '#84CC16', '#F97316', '#3B82F6'
  ];

  get datasets(): Dataset[] {
    return this.departamento()?.datasets || [];
  }

  get totalRegistros(): number {
    return this.datasets.reduce((sum, ds) => sum + (ds.total_registros || 0), 0);
  }

  ngOnInit(): void {
    const id = this.route.snapshot.params['id'];
    this.loadDepartamento(id);
  }

  loadDepartamento(id: string): void {
    this.deptoService.getPublicById(id).subscribe({
      next: (depto) => {
        this.departamento.set(depto);
        this.loading.set(false);
      },
      error: () => {
        this.departamento.set(null);
        this.loading.set(false);
      }
    });
  }

  getDatasetColor(index: number): string {
    return this.datasetColors[index % this.datasetColors.length];
  }

  getTypeClass(tipo: string): string {
    switch (tipo) {
      case 'NUMERICO': return 'type-numeric';
      case 'CATEGORICO': return 'type-categoric';
      case 'FECHA': return 'type-date';
      default: return 'type-text';
    }
  }
}
