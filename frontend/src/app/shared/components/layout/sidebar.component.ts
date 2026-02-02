import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, output, signal } from '@angular/core';
import { MatBadgeModule } from '@angular/material/badge';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { Departamento } from '@core/models';
import { AuthService } from '@core/services/auth.service';
import { DepartamentoService } from '@core/services/departamento.service';
import { TranslateModule } from '@ngx-translate/core';
import { IsAdminDirective } from '../../directives/is-admin.directive';

interface NavItem {
  label: string;
  icon: string;
  route: string;
  badge?: number;
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    RouterLinkActive,
    MatIconModule,
    MatTooltipModule,
    MatBadgeModule,
    IsAdminDirective,
    TranslateModule,
  ],
  template: `
    <nav class="sidebar">
      <!-- Main navigation -->
      <div class="nav-section">
        <span class="nav-label">{{ 'layout.sidebar.main' | translate }}</span>

        <!-- Dashboard - visible para todos -->
        <a
          class="nav-item"
          routerLink="/admin/dashboard"
          routerLinkActive="active"
          [routerLinkActiveOptions]="{ exact: true }"
          (click)="navigate.emit()"
        >
          <div class="nav-icon-wrapper">
            <mat-icon class="nav-icon">dashboard</mat-icon>
          </div>
          <span class="nav-text">{{ 'layout.sidebar.dashboard' | translate }}</span>
        </a>

        <!-- Subir Dataset - solo admin -->
        <a
          *isAdmin
          class="nav-item"
          routerLink="/admin/datasets/nuevo"
          routerLinkActive="active"
          (click)="navigate.emit()"
        >
          <div class="nav-icon-wrapper">
            <mat-icon class="nav-icon">cloud_upload</mat-icon>
          </div>
          <span class="nav-text">{{ 'layout.sidebar.uploadDataset' | translate }}</span>
        </a>

        <!-- Gestión de Usuarios - solo admin -->
        <a
          *isAdmin
          class="nav-item"
          routerLink="/admin/usuarios"
          routerLinkActive="active"
          (click)="navigate.emit()"
        >
          <div class="nav-icon-wrapper">
            <mat-icon class="nav-icon">people</mat-icon>
          </div>
          <span class="nav-text">{{ 'layout.sidebar.users' | translate }}</span>
        </a>
      </div>

      <!-- Departamentos section -->
      <div class="nav-section">
        <div class="nav-label-row">
          <span class="nav-label">{{ 'layout.sidebar.departments' | translate }}</span>
          <a
            *isAdmin
            class="add-btn"
            routerLink="/admin/departamentos/nuevo"
            [matTooltip]="'layout.sidebar.newDepartment' | translate"
            (click)="navigate.emit()"
          >
            <mat-icon>add</mat-icon>
          </a>
        </div>

        <div class="deptos-list">
          @for (depto of departamentos(); track depto.id) {
            <a
              class="nav-item depto-item"
              [routerLink]="['/admin/departamentos', depto.id]"
              routerLinkActive="active"
              (click)="navigate.emit()"
            >
              <div class="depto-icon" [style.background]="getDeptoColor(depto)">
                @if (depto.icono) {
                  <mat-icon>{{ depto.icono }}</mat-icon>
                } @else {
                  <span>{{ depto.nombre.charAt(0).toUpperCase() }}</span>
                }
              </div>
              <div class="depto-info">
                <span class="depto-name">{{ depto.nombre }}</span>
                @if (depto.datasets_count !== undefined) {
                  <span class="depto-count"
                    >{{ depto.datasets_count }} {{ 'common.units.datasets' | translate }}</span
                  >
                }
              </div>
              @if (depto.publico) {
                <mat-icon class="public-icon" [matTooltip]="'common.labels.public' | translate"
                  >public</mat-icon
                >
              }
            </a>
          } @empty {
            <div class="empty-state">
              <mat-icon>folder_off</mat-icon>
              <span>{{ 'layout.sidebar.noDepartments' | translate }}</span>
              <a
                *isAdmin
                routerLink="/admin/departamentos/nuevo"
                class="empty-action"
                (click)="navigate.emit()"
              >
                {{ 'layout.sidebar.createOne' | translate }}
              </a>
            </div>
          }
        </div>
      </div>

      <!-- Footer -->
      <div class="sidebar-footer">
        <a
          class="nav-item"
          routerLink="/admin/datasets"
          routerLinkActive="active"
          (click)="navigate.emit()"
        >
          <div class="nav-icon-wrapper">
            <mat-icon class="nav-icon">storage</mat-icon>
          </div>
          <span class="nav-text">{{ 'layout.sidebar.allDatasets' | translate }}</span>
        </a>
      </div>
    </nav>
  `,
  styles: [
    `
      .sidebar {
        height: 100%;
        display: flex;
        flex-direction: column;
        padding: 1rem 0.75rem;
        overflow-y: auto;
      }

      .nav-section {
        margin-bottom: 1.5rem;
      }

      .nav-label {
        display: block;
        font-size: 0.7rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--text-tertiary);
        padding: 0 0.75rem;
        margin-bottom: 0.5rem;
      }

      .nav-label-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding-right: 0.5rem;
        margin-bottom: 0.5rem;
      }

      .add-btn {
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--hover-bg);
        border-radius: var(--radius-md);
        color: var(--text-secondary);
        cursor: pointer;
        transition: all var(--transition-fast);
        text-decoration: none;
      }

      .add-btn:hover {
        background: var(--primary-100);
        color: var(--primary-600);
      }

      .add-btn mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
      }

      .nav-item {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 0.625rem 0.75rem;
        border-radius: var(--radius-lg);
        color: var(--text-secondary);
        text-decoration: none;
        cursor: pointer;
        transition: all var(--transition-fast);
        margin-bottom: 0.25rem;
      }

      .nav-item:hover {
        background: var(--hover-bg);
        color: var(--text-primary);
      }

      .nav-item.active {
        background: var(--primary-50);
        color: var(--primary-700);
      }

      :host-context(.dark) .nav-item.active {
        background: rgba(99, 102, 241, 0.15);
        color: var(--primary-400);
      }

      .nav-icon-wrapper {
        width: 36px;
        height: 36px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--bg-tertiary);
        border-radius: var(--radius-md);
        transition: all var(--transition-fast);
      }

      .nav-item:hover .nav-icon-wrapper {
        background: var(--primary-100);
      }

      .nav-item.active .nav-icon-wrapper {
        background: var(--primary-600);
      }

      .nav-icon {
        font-size: 20px;
        color: var(--text-secondary);
        transition: color var(--transition-fast);
      }

      .nav-item:hover .nav-icon {
        color: var(--primary-600);
      }

      .nav-item.active .nav-icon {
        color: white;
      }

      .nav-text {
        flex: 1;
        font-size: 0.875rem;
        font-weight: 500;
      }

      .nav-badge {
        padding: 0.125rem 0.5rem;
        background: var(--primary-100);
        color: var(--primary-700);
        border-radius: var(--radius-full);
        font-size: 0.75rem;
        font-weight: 600;
      }

      /* Departamentos list */
      .deptos-list {
        max-height: 300px;
        overflow-y: auto;
        padding-right: 0.25rem;
      }

      .depto-item {
        padding: 0.5rem 0.75rem;
      }

      .depto-icon {
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: var(--radius-md);
        color: white;
        font-weight: 600;
        font-size: 0.875rem;
        flex-shrink: 0;

        mat-icon {
          font-size: 18px;
          width: 18px;
          height: 18px;
        }
      }

      .depto-info {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
      }

      .depto-name {
        font-size: 0.875rem;
        font-weight: 500;
        color: var(--text-primary);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .depto-count {
        font-size: 0.75rem;
        color: var(--text-tertiary);
      }

      .public-icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
        color: var(--text-tertiary);
      }

      /* Empty state */
      .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 1.5rem;
        text-align: center;
        color: var(--text-tertiary);
      }

      .empty-state mat-icon {
        font-size: 32px;
        width: 32px;
        height: 32px;
        margin-bottom: 0.5rem;
        opacity: 0.5;
      }

      .empty-state span {
        font-size: 0.875rem;
        margin-bottom: 0.5rem;
      }

      .empty-action {
        font-size: 0.875rem;
        color: var(--primary-600);
        text-decoration: none;
        font-weight: 500;
      }

      .empty-action:hover {
        text-decoration: underline;
      }

      /* Footer */
      .sidebar-footer {
        margin-top: auto;
        padding-top: 1rem;
        border-top: 1px solid var(--border-color);
      }
    `,
  ],
})
export class SidebarComponent implements OnInit {
  private readonly deptoService = inject(DepartamentoService);
  private readonly authService = inject(AuthService);

  departamentos = signal<Departamento[]>([]);
  navigate = output<void>();

  // Computed para verificar si el usuario es admin
  isAdmin = computed(() => this.authService.isAdmin());

  // Colores para los departamentos
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

  ngOnInit(): void {
    this.loadDepartamentos();

    // Suscribirse a cambios en departamentos para actualizar automáticamente
    this.deptoService.onDepartamentosChanged$.subscribe(() => {
      this.loadDepartamentos();
    });
  }

  loadDepartamentos(): void {
    this.deptoService.getAll().subscribe({
      next: (departamentos) => this.departamentos.set(departamentos || []),
      error: () => this.departamentos.set([]),
    });
  }

  getDeptoColor(depto: Departamento): string {
    const index = this.departamentos().indexOf(depto);
    return this.deptoColors[index % this.deptoColors.length];
  }
}
