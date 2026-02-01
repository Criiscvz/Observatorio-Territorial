import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatRippleModule } from '@angular/material/core';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RouterLink } from '@angular/router';
import { Dataset, Departamento } from '../../core/models';
import { AuthService } from '../../core/services/auth.service';
import { DepartamentoService } from '../../core/services/departamento.service';

interface StatCard {
  title: string;
  icon: string;
  gradient: string;
  iconBg: string;
}

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
    MatRippleModule,
  ],
  template: `
    <div class="dashboard">
      <!-- Header -->
      <header class="dashboard-header">
        <div class="header-content">
          <div class="welcome-section">
            <span class="greeting">{{ getGreeting() }}</span>
            <h1 class="welcome-title">{{ authService.user()?.name || 'Usuario' }}</h1>
            <p class="welcome-subtitle">Bienvenido al Observatorio de Datos ULEAM</p>
          </div>
          <div class="header-actions">
            <a class="action-btn secondary" routerLink="/admin/datasets/nuevo">
              <mat-icon>cloud_upload</mat-icon>
              <span>Importar</span>
            </a>
            <a class="action-btn primary" routerLink="/admin/departamentos/nuevo">
              <mat-icon>add</mat-icon>
              <span>Nuevo Departamento</span>
            </a>
          </div>
        </div>
      </header>

      @if (loading()) {
        <div class="loading-state">
          <mat-spinner diameter="48"></mat-spinner>
          <p>Cargando datos...</p>
        </div>
      } @else {
        <!-- Stats Grid -->
        <section class="stats-section">
          <div class="stats-grid">
            <!-- Departamentos -->
            <div class="stat-card" [style.--accent-color]="'99, 102, 241'">
              <div class="stat-icon">
                <mat-icon>folder</mat-icon>
              </div>
              <div class="stat-content">
                <span class="stat-label">Departamentos</span>
                <span class="stat-value">{{ departamentos().length }}</span>
              </div>
              <div class="stat-trend positive">
                <mat-icon>trending_up</mat-icon>
                <span>Activos</span>
              </div>
            </div>

            <!-- Datasets -->
            <div class="stat-card" [style.--accent-color]="'236, 72, 153'">
              <div class="stat-icon">
                <mat-icon>table_chart</mat-icon>
              </div>
              <div class="stat-content">
                <span class="stat-label">Datasets</span>
                <span class="stat-value">{{ totalDatasets() }}</span>
              </div>
              <div class="stat-trend">
                <mat-icon>storage</mat-icon>
                <span>Archivos</span>
              </div>
            </div>

            <!-- Registros -->
            <div class="stat-card" [style.--accent-color]="'20, 184, 166'">
              <div class="stat-icon">
                <mat-icon>analytics</mat-icon>
              </div>
              <div class="stat-content">
                <span class="stat-label">Registros</span>
                <span class="stat-value">{{ formatNumber(totalRegistros()) }}</span>
              </div>
              <div class="stat-trend">
                <mat-icon>data_usage</mat-icon>
                <span>Total</span>
              </div>
            </div>

            <!-- Públicos -->
            <div class="stat-card" [style.--accent-color]="'245, 158, 11'">
              <div class="stat-icon">
                <mat-icon>public</mat-icon>
              </div>
              <div class="stat-content">
                <span class="stat-label">Públicos</span>
                <span class="stat-value">{{ departamentosPublicos() }}</span>
              </div>
              <div class="stat-trend">
                <mat-icon>visibility</mat-icon>
                <span>Visibles</span>
              </div>
            </div>
          </div>
        </section>

        <!-- Main Content Grid -->
        <section class="content-grid">
          <!-- Departamentos Recientes -->
          <div class="content-card">
            <div class="card-header">
              <div class="card-title-group">
                <div class="card-icon purple">
                  <mat-icon>folder</mat-icon>
                </div>
                <div>
                  <h3 class="card-title">Departamentos</h3>
                  <p class="card-subtitle">Últimos agregados</p>
                </div>
              </div>
              <a class="view-all" routerLink="/admin/dashboard">
                Ver todos
                <mat-icon>arrow_forward</mat-icon>
              </a>
            </div>

            <div class="card-body">
              @if (departamentos().length > 0) {
                <div class="items-list">
                  @for (depto of departamentosRecientes(); track depto.id) {
                    <a
                      class="list-item"
                      [routerLink]="['/admin/departamentos', depto.id]"
                      matRipple
                    >
                      @if (depto.icono) {
                        <div class="item-icon" [style.background]="getDeptoColor($index)">
                          <mat-icon>{{ depto.icono }}</mat-icon>
                        </div>
                      } @else {
                        <div class="item-avatar" [style.background]="getDeptoColor($index)">
                          {{ depto.nombre.charAt(0).toUpperCase() }}
                        </div>
                      }
                      <div class="item-content">
                        <span class="item-title">{{ depto.nombre }}</span>
                        <span class="item-meta">
                          {{ depto.datasets?.length || 0 }} datasets
                          @if (depto.publico) {
                            <span class="badge success">Público</span>
                          }
                        </span>
                      </div>
                      <mat-icon class="item-arrow">chevron_right</mat-icon>
                    </a>
                  }
                </div>
              } @else {
                <div class="empty-state">
                  <mat-icon>folder_off</mat-icon>
                  <p>No hay departamentos</p>
                  <a routerLink="/admin/departamentos/nuevo" class="empty-action">Crear uno</a>
                </div>
              }
            </div>
          </div>

          <!-- Datasets Recientes -->
          <div class="content-card">
            <div class="card-header">
              <div class="card-title-group">
                <div class="card-icon blue">
                  <mat-icon>description</mat-icon>
                </div>
                <div>
                  <h3 class="card-title">Datasets</h3>
                  <p class="card-subtitle">Últimos importados</p>
                </div>
              </div>
              <a class="view-all" routerLink="/admin/datasets">
                Ver todos
                <mat-icon>arrow_forward</mat-icon>
              </a>
            </div>

            <div class="card-body">
              @if (datasetsRecientes().length > 0) {
                <div class="items-list">
                  @for (ds of datasetsRecientes(); track ds.id) {
                    <a class="list-item" [routerLink]="['/admin/datasets', ds.id]" matRipple>
                      <div class="item-icon blue">
                        <mat-icon>table_chart</mat-icon>
                      </div>
                      <div class="item-content">
                        <span class="item-title">{{ ds.nombre }}</span>
                        <span class="item-meta">
                          {{ ds.total_registros | number }} registros
                          <span class="badge" [class]="getEstadoBadgeClass(ds.estado)">{{
                            ds.estado
                          }}</span>
                        </span>
                      </div>
                      <mat-icon class="item-arrow">chevron_right</mat-icon>
                    </a>
                  }
                </div>
              } @else {
                <div class="empty-state">
                  <mat-icon>description</mat-icon>
                  <p>No hay datasets</p>
                  <a routerLink="/admin/datasets/nuevo" class="empty-action">Importar uno</a>
                </div>
              }
            </div>
          </div>
        </section>

        <!-- Quick Actions -->
        <section class="quick-actions">
          <h3 class="section-title">Acciones Rápidas</h3>
          <div class="actions-grid">
            <a class="quick-action" routerLink="/admin/departamentos/nuevo" matRipple>
              <div class="action-icon purple">
                <mat-icon>add_business</mat-icon>
              </div>
              <span class="action-label">Nuevo Departamento</span>
              <p class="action-desc">Crear una nueva área de trabajo</p>
            </a>

            <a class="quick-action" routerLink="/admin/datasets/nuevo" matRipple>
              <div class="action-icon blue">
                <mat-icon>cloud_upload</mat-icon>
              </div>
              <span class="action-label">Importar Excel</span>
              <p class="action-desc">Subir datos desde archivo</p>
            </a>

            <a class="quick-action" routerLink="/admin/datasets" matRipple>
              <div class="action-icon teal">
                <mat-icon>folder_open</mat-icon>
              </div>
              <span class="action-label">Ver Datasets</span>
              <p class="action-desc">Explorar todos los datos</p>
            </a>

            @if (datasetsRecientes().length > 0) {
              <a
                class="quick-action"
                [routerLink]="['/admin/datasets', datasetsRecientes()[0].id]"
                matRipple
              >
                <div class="action-icon orange">
                  <mat-icon>analytics</mat-icon>
                </div>
                <span class="action-label">Último Análisis</span>
                <p class="action-desc">Continuar analizando</p>
              </a>
            } @else {
              <div class="quick-action disabled">
                <div class="action-icon gray">
                  <mat-icon>analytics</mat-icon>
                </div>
                <span class="action-label">Sin análisis</span>
                <p class="action-desc">Importa datos primero</p>
              </div>
            }
          </div>
        </section>
      }
    </div>
  `,
  styles: [
    `
      .dashboard {
        max-width: 1400px;
        margin: 0 auto;
      }

      /* Header */
      .dashboard-header {
        margin-bottom: 2rem;
      }

      .header-content {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        flex-wrap: wrap;
        gap: 1.5rem;
      }

      .welcome-section {
        flex: 1;
      }

      .greeting {
        font-size: 0.875rem;
        color: var(--text-tertiary);
        text-transform: uppercase;
        letter-spacing: 0.05em;
        font-weight: 500;
      }

      .welcome-title {
        font-size: 2rem;
        font-weight: 700;
        color: var(--text-primary);
        margin: 0.25rem 0;
        letter-spacing: -0.025em;
      }

      .welcome-subtitle {
        font-size: 1rem;
        color: var(--text-secondary);
        margin: 0;
      }

      .header-actions {
        display: flex;
        gap: 0.75rem;
      }

      .action-btn {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.75rem 1.25rem;
        border-radius: var(--radius-xl);
        font-weight: 600;
        font-size: 0.875rem;
        text-decoration: none;
        transition: all var(--transition-fast);
      }

      .action-btn.primary {
        background: linear-gradient(135deg, var(--primary-600), var(--primary-500));
        color: white;
        box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
      }

      .action-btn.primary:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 20px rgba(99, 102, 241, 0.4);
      }

      .action-btn.secondary {
        background: var(--bg-secondary);
        color: var(--text-primary);
        border: 1px solid var(--border-color);
      }

      .action-btn.secondary:hover {
        border-color: var(--primary-300);
        background: var(--hover-bg);
      }

      /* Loading */
      .loading-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 4rem;
        color: var(--text-secondary);
      }

      .loading-state p {
        margin-top: 1rem;
      }

      /* Stats Section */
      .stats-section {
        margin-bottom: 2rem;
      }

      .stats-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 1.5rem;
      }

      @media (max-width: 1024px) {
        .stats-grid {
          grid-template-columns: repeat(2, 1fr);
        }
      }

      @media (max-width: 640px) {
        .stats-grid {
          grid-template-columns: 1fr;
        }
      }

      .stat-card {
        background: var(--card-bg);
        border: 1px solid var(--card-border);
        border-radius: var(--radius-xl);
        padding: 1.5rem;
        display: flex;
        flex-direction: column;
        gap: 1rem;
        transition: all var(--transition-fast);
        position: relative;
        overflow: hidden;
      }

      .stat-card::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 3px;
        background: rgb(var(--accent-color));
      }

      .stat-card:hover {
        transform: translateY(-4px);
        box-shadow: 0 12px 24px var(--shadow-color);
      }

      .stat-icon {
        width: 48px;
        height: 48px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(var(--accent-color), 0.1);
        border-radius: var(--radius-lg);
        color: rgb(var(--accent-color));
        transition: transform var(--transition-fast);
      }

      .stat-card:hover .stat-icon {
        transform: scale(1.1);
      }

      .stat-content {
        display: flex;
        flex-direction: column;
      }

      .stat-label {
        font-size: 0.875rem;
        color: var(--text-secondary);
        font-weight: 500;
      }

      .stat-value {
        font-size: 2rem;
        font-weight: 700;
        color: var(--text-primary);
        letter-spacing: -0.025em;
      }

      .stat-trend {
        display: flex;
        align-items: center;
        gap: 0.375rem;
        font-size: 0.75rem;
        color: var(--text-tertiary);
      }

      .stat-trend mat-icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
      }

      .stat-trend.positive {
        color: #10b981;
      }

      /* Content Grid */
      .content-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 1.5rem;
        margin-bottom: 2rem;
      }

      @media (max-width: 1024px) {
        .content-grid {
          grid-template-columns: 1fr;
        }
      }

      .content-card {
        background: var(--card-bg);
        border: 1px solid var(--card-border);
        border-radius: var(--radius-xl);
        overflow: hidden;
      }

      .card-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 1.25rem 1.5rem;
        border-bottom: 1px solid var(--border-color);
      }

      .card-title-group {
        display: flex;
        align-items: center;
        gap: 0.75rem;
      }

      .card-icon {
        width: 40px;
        height: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: var(--radius-lg);
        color: white;
      }

      .card-icon.purple {
        background: linear-gradient(135deg, #8b5cf6, #7c3aed);
      }
      .card-icon.blue {
        background: linear-gradient(135deg, #3b82f6, #2563eb);
      }
      .card-icon.teal {
        background: linear-gradient(135deg, #14b8a6, #0d9488);
      }
      .card-icon.orange {
        background: linear-gradient(135deg, #f59e0b, #d97706);
      }

      .card-title {
        font-size: 1rem;
        font-weight: 600;
        color: var(--text-primary);
        margin: 0;
      }

      .card-subtitle {
        font-size: 0.75rem;
        color: var(--text-tertiary);
        margin: 0;
      }

      .view-all {
        display: flex;
        align-items: center;
        gap: 0.25rem;
        font-size: 0.875rem;
        font-weight: 500;
        color: var(--primary-600);
        text-decoration: none;
        transition: gap var(--transition-fast);
      }

      .view-all:hover {
        gap: 0.5rem;
      }

      .view-all mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
      }

      .card-body {
        padding: 0.5rem;
      }

      /* Items List */
      .items-list {
        display: flex;
        flex-direction: column;
      }

      .list-item {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 0.875rem 1rem;
        border-radius: var(--radius-lg);
        text-decoration: none;
        transition: background var(--transition-fast);
        cursor: pointer;
      }

      .list-item:hover {
        background: var(--hover-bg);
      }

      .item-avatar {
        width: 40px;
        height: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: var(--radius-md);
        font-weight: 600;
        font-size: 1rem;
        color: white;
        flex-shrink: 0;
      }

      .item-icon {
        width: 40px;
        height: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: var(--radius-md);
        flex-shrink: 0;
      }

      .item-icon.blue {
        background: rgba(59, 130, 246, 0.1);
        color: #3b82f6;
      }

      .item-content {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
      }

      .item-title {
        font-size: 0.875rem;
        font-weight: 500;
        color: var(--text-primary);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .item-meta {
        font-size: 0.75rem;
        color: var(--text-tertiary);
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }

      .badge {
        padding: 0.125rem 0.5rem;
        border-radius: var(--radius-full);
        font-size: 0.625rem;
        font-weight: 600;
        text-transform: uppercase;
      }

      .badge.success {
        background: rgba(16, 185, 129, 0.1);
        color: #10b981;
      }

      .badge.warning {
        background: rgba(245, 158, 11, 0.1);
        color: #f59e0b;
      }

      .badge.error {
        background: rgba(239, 68, 68, 0.1);
        color: #ef4444;
      }

      .badge.info {
        background: rgba(59, 130, 246, 0.1);
        color: #3b82f6;
      }

      .item-arrow {
        color: var(--text-tertiary);
        font-size: 20px;
        transition: transform var(--transition-fast);
      }

      .list-item:hover .item-arrow {
        transform: translateX(4px);
        color: var(--primary-600);
      }

      /* Empty State */
      .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 2rem;
        color: var(--text-tertiary);
      }

      .empty-state mat-icon {
        font-size: 48px;
        width: 48px;
        height: 48px;
        opacity: 0.5;
      }

      .empty-state p {
        margin: 0.5rem 0;
      }

      .empty-action {
        color: var(--primary-600);
        text-decoration: none;
        font-weight: 500;
      }

      .empty-action:hover {
        text-decoration: underline;
      }

      /* Quick Actions */
      .quick-actions {
        margin-bottom: 2rem;
      }

      .section-title {
        font-size: 1.125rem;
        font-weight: 600;
        color: var(--text-primary);
        margin-bottom: 1rem;
      }

      .actions-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 1rem;
      }

      @media (max-width: 1024px) {
        .actions-grid {
          grid-template-columns: repeat(2, 1fr);
        }
      }

      @media (max-width: 640px) {
        .actions-grid {
          grid-template-columns: 1fr;
        }
      }

      .quick-action {
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        padding: 1.5rem;
        background: var(--card-bg);
        border: 2px dashed var(--border-color);
        border-radius: var(--radius-xl);
        text-decoration: none;
        transition: all var(--transition-fast);
        cursor: pointer;
      }

      .quick-action:hover {
        border-color: var(--primary-300);
        background: var(--primary-50);
        transform: translateY(-2px);
      }

      :host-context(.dark) .quick-action:hover {
        background: rgba(99, 102, 241, 0.1);
      }

      .quick-action.disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .quick-action.disabled:hover {
        transform: none;
        border-color: var(--border-color);
        background: var(--card-bg);
      }

      .action-icon {
        width: 56px;
        height: 56px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: var(--radius-xl);
        margin-bottom: 0.75rem;
        transition: transform var(--transition-fast);
      }

      .quick-action:hover .action-icon {
        transform: scale(1.1);
      }

      .action-icon mat-icon {
        font-size: 28px;
        width: 28px;
        height: 28px;
      }

      .action-icon.purple {
        background: rgba(139, 92, 246, 0.1);
        color: #8b5cf6;
      }
      .action-icon.blue {
        background: rgba(59, 130, 246, 0.1);
        color: #3b82f6;
      }
      .action-icon.teal {
        background: rgba(20, 184, 166, 0.1);
        color: #14b8a6;
      }
      .action-icon.orange {
        background: rgba(245, 158, 11, 0.1);
        color: #f59e0b;
      }
      .action-icon.gray {
        background: var(--bg-tertiary);
        color: var(--text-tertiary);
      }

      .action-label {
        font-size: 0.875rem;
        font-weight: 600;
        color: var(--text-primary);
        margin-bottom: 0.25rem;
      }

      .action-desc {
        font-size: 0.75rem;
        color: var(--text-tertiary);
        margin: 0;
      }
    `,
  ],
})
export class DashboardComponent implements OnInit {
  private readonly deptoService = inject(DepartamentoService);
  authService = inject(AuthService);

  departamentos = signal<Departamento[]>([]);
  loading = signal(true);

  // Computed values
  totalDatasets = computed(() => {
    let count = 0;
    this.departamentos().forEach((d) => {
      count += d.datasets?.length || 0;
    });
    return count;
  });

  totalRegistros = computed(() => {
    let count = 0;
    this.departamentos().forEach((d) => {
      d.datasets?.forEach((ds) => {
        count += ds.total_registros || 0;
      });
    });
    return count;
  });

  departamentosPublicos = computed(() => {
    return this.departamentos().filter((d) => d.publico).length;
  });

  departamentosRecientes = computed(() => {
    return this.departamentos().slice(0, 5);
  });

  datasetsRecientes = computed(() => {
    const allDatasets: Dataset[] = [];
    this.departamentos().forEach((d) => {
      d.datasets?.forEach((ds) => {
        allDatasets.push(ds);
      });
    });
    // Ordenar por fecha y tomar los últimos 5
    return allDatasets
      .sort(
        (a, b) => new Date(b.fecha_carga || 0).getTime() - new Date(a.fecha_carga || 0).getTime(),
      )
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
      },
    });
  }

  getEstadoClass(estado: string): string {
    switch (estado) {
      case 'COMPLETADO':
        return 'text-green-600';
      case 'PROCESANDO':
        return 'text-yellow-600';
      case 'ERROR':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  }

  getEstadoBadgeClass(estado: string): string {
    switch (estado) {
      case 'COMPLETADO':
        return 'success';
      case 'PROCESANDO':
        return 'warning';
      case 'ERROR':
        return 'error';
      default:
        return 'info';
    }
  }

  getGreeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'Buenos días';
    if (hour < 18) return 'Buenas tardes';
    return 'Buenas noches';
  }

  formatNumber(num: number): string {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  }

  // Colores para departamentos
  private deptoColors = [
    '#6366F1',
    '#EC4899',
    '#14B8A6',
    '#F59E0B',
    '#EF4444',
    '#8B5CF6',
    '#06B6D4',
    '#84CC16',
    '#F97316',
    '#3B82F6',
  ];

  getDeptoColor(index: number): string {
    return this.deptoColors[index % this.deptoColors.length];
  }
}
