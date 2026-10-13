import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, output, signal, DestroyRef } from '@angular/core';
import { MatBadgeModule } from '@angular/material/badge';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { Departamento } from '@core/models';
import { AuthService } from '@core/services/auth.service';
import { DepartamentoService } from '@core/services/departamento.service';
import { AtlasCategoria, AtlasCategoriaService } from '@core/services/atlas-categoria.service';
import { atlasCategoryPresentation } from '@core/utils/atlas-category-presentation';
import { catchError, of, startWith, switchMap } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';
import { IsAdminDirective } from '../../directives/is-admin.directive';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

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

        <!-- Subir Dataset - admin y editor -->
        @if (isAdmin() || isEditor()) {
          <a
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
        }

        <!-- Gestión de Usuarios - solo admin -->
        <a
          *isAdmin
          class="nav-item"
          routerLink="/admin/usuarios"
          routerLinkActive="active"
          (click)="navigate.emit()"
        >
          <div class="nav-icon-wrapper">
            <mat-icon class="nav-icon">manage_accounts</mat-icon>
          </div>
          <span class="nav-text">{{ 'layout.sidebar.users' | translate }}</span>
        </a>

        <!-- Gestión de Permisos - solo admin -->
        <a
          *isAdmin
          class="nav-item"
          routerLink="/admin/permisos"
          routerLinkActive="active"
          (click)="navigate.emit()"
        >
          <div class="nav-icon-wrapper">
            <mat-icon class="nav-icon">security</mat-icon>
          </div>
          <span class="nav-text">{{ 'layout.sidebar.permissions' | translate }}</span>
        </a>
      </div>

      <!-- Departamentos section -->
      <div class="nav-section">
        <div class="nav-label-row">
          <span class="nav-label">{{ 'layout.sidebar.departments' | translate }}</span>
          <a
            *isAdmin
            class="add-btn"
            routerLink="/admin/departamentos"
            [matTooltip]="'layout.sidebar.manageDepartments' | translate"
            [attr.aria-label]="'layout.sidebar.manageDepartments' | translate"
            (click)="navigate.emit()"
          >
            <mat-icon>settings</mat-icon>
          </a>
        </div>

        <input
          class="nav-search observatorio-search"
          type="search"
          [attr.aria-label]="'layout.sidebar.searchDepartments' | translate"
          [placeholder]="'layout.sidebar.searchDepartments' | translate"
          [value]="observatorioSearch()"
          (input)="observatorioSearch.set($any($event.target).value)"
        />
        <div class="deptos-list">
          @for (depto of filteredDepartamentos(); track depto.id) {
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
                <span class="depto-name" [title]="depto.nombre">{{ depto.nombre }}</span>
                @if (depto.datasets || depto.datasets_count !== undefined) {
                  <span class="depto-count"
                    >{{ depto.datasets_count ?? depto.datasets?.length ?? 0 }}
                    {{ 'common.units.datasets' | translate }}</span
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
              <span>{{
                (observatorioSearch()
                  ? 'common.messages.noResults'
                  : 'layout.sidebar.noDepartments'
                ) | translate
              }}</span>
              @if (observatorioSearch()) {
                <button type="button" class="empty-action" (click)="observatorioSearch.set('')">
                  {{ 'layout.sidebar.clearSearch' | translate }}
                </button>
              } @else {
                <a
                  *isAdmin
                  routerLink="/admin/departamentos/nuevo"
                  class="empty-action"
                  (click)="navigate.emit()"
                >
                  {{ 'layout.sidebar.createOne' | translate }}
                </a>
              }
            </div>
          }
        </div>
      </div>

      @if (isAdmin()) {
        <section class="nav-section" aria-labelledby="atlas-nav-title">
          <div class="nav-label-row">
            <span class="nav-label" id="atlas-nav-title">Atlas</span>
            <a
              class="add-btn"
              routerLink="/admin/atlas/categorias"
              matTooltip="Gestionar categorías de Atlas"
              aria-label="Gestionar categorías de Atlas"
              (click)="navigate.emit()"
            >
              <mat-icon>settings</mat-icon>
            </a>
          </div>
          @if (!atlasLoading() && !atlasError()) {
            <input
              class="nav-search atlas-category-search"
              type="search"
              aria-label="Buscar categorías de Atlas"
              placeholder="Buscar categoría…"
              [value]="atlasCategorySearch()"
              (input)="atlasCategorySearch.set($any($event.target).value)"
            />
          }
          <div class="deptos-list">
            @if (atlasLoading()) {
              <p class="empty-state" role="status">Cargando categorías…</p>
            } @else if (atlasError()) {
              <div class="empty-state" role="alert">
                <span>No se pudieron cargar las categorías.</span>
                <button type="button" class="empty-action" (click)="loadAtlasCategorias()">
                  Reintentar
                </button>
              </div>
            } @else {
              @for (categoria of filteredAtlasCategorias(); track categoria.id) {
                <a
                  class="nav-item depto-item"
                  routerLink="/admin/atlas"
                  [queryParams]="{ categoria: categoria.id }"
                  routerLinkActive="active"
                  [routerLinkActiveOptions]="{ exact: true }"
                  (click)="navigate.emit()"
                >
                  <div
                    class="depto-icon atlas-category-icon"
                    [style.--atlas-category-color]="
                      categoryVisual(categoria.nombre, categoria.icono).color
                    "
                  >
                    <mat-icon>{{
                      categoryVisual(categoria.nombre, categoria.icono).icon
                    }}</mat-icon>
                  </div>
                  <div class="depto-info">
                    <span class="depto-name" [title]="categoria.nombre">{{
                      categoria.nombre
                    }}</span>
                  </div>
                </a>
              } @empty {
                <div class="empty-state"><span>No se encontraron categorías.</span></div>
              }
            }
          </div>
          <div class="atlas-nav-actions" aria-label="Accesos de Atlas">
            <a
              class="nav-item"
              routerLink="/admin/atlas"
              routerLinkActive="active"
              [routerLinkActiveOptions]="{ exact: true }"
              (click)="navigate.emit()"
            >
              <div class="nav-icon-wrapper">
                <mat-icon class="nav-icon">library_books</mat-icon>
              </div>
              <span class="nav-text">Todos los archivos</span>
            </a>
            <a
              class="nav-item"
              routerLink="/admin/atlas/subir"
              routerLinkActive="active"
              (click)="navigate.emit()"
            >
              <div class="nav-icon-wrapper"><mat-icon class="nav-icon">upload_file</mat-icon></div>
              <span class="nav-text">Subir PDF de Atlas</span>
            </a>
            <a
              class="nav-item"
              routerLink="/admin/atlas/categorias"
              routerLinkActive="active"
              (click)="navigate.emit()"
            >
              <div class="nav-icon-wrapper"><mat-icon class="nav-icon">category</mat-icon></div>
              <span class="nav-text">Gestionar categorías</span>
            </a>
          </div>
        </section>
      }

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
        <a class="nav-item" routerLink="/publico" (click)="navigate.emit()">
          <div class="nav-icon-wrapper">
            <mat-icon class="nav-icon">public</mat-icon>
          </div>
          <span class="nav-text">{{ 'layout.sidebar.publicView' | translate }}</span>
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
        flex-shrink: 0;
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
        overflow-x: hidden;
        padding: 0.25rem 0.25rem 0.5rem 0;
        overscroll-behavior: contain;
        scrollbar-gutter: stable;
        scroll-padding-block: 0.5rem;
      }

      .atlas-nav-actions {
        margin-top: 0.75rem;
        padding-top: 0.75rem;
        border-top: 1px solid var(--border-color);
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
        background: none;
        border: 0;
        cursor: pointer;
      }

      .empty-action:hover {
        text-decoration: underline;
      }

      /* Footer */
      .sidebar-footer {
        flex-shrink: 0;
        margin-top: auto;
        padding-top: 1rem;
        border-top: 1px solid var(--border-color);
      }
      .atlas-category-icon {
        color: var(--atlas-category-color);
        background: color-mix(in srgb, var(--atlas-category-color) 12%, transparent);
      }
      .nav-search {
        box-sizing: border-box;
        width: 100%;
        padding: 0.65rem;
        margin-bottom: 0.5rem;
        border: 1px solid var(--border-color);
        border-radius: 8px;
        background: var(--bg-primary);
        color: var(--text-primary);
      }
      .nav-search:focus-visible {
        outline: 2px solid var(--primary-500);
        outline-offset: 2px;
      }
    `,
  ],
})
export class SidebarComponent implements OnInit {
  readonly categoryVisual = atlasCategoryPresentation;
  private readonly destroyRef = inject(DestroyRef);
  private readonly deptoService = inject(DepartamentoService);
  private readonly authService = inject(AuthService);
  private readonly atlasCategoriaService = inject(AtlasCategoriaService);
  readonly atlasCategorias = signal<AtlasCategoria[]>([]);
  readonly atlasCategorySearch = signal('');
  readonly filteredAtlasCategorias = computed(() => {
    const normalize = (value: string) =>
      value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLocaleLowerCase('es')
        .trim();
    return this.atlasCategorias().filter((item) =>
      normalize(item.nombre).includes(normalize(this.atlasCategorySearch())),
    );
  });
  readonly atlasLoading = signal(false);
  readonly atlasError = signal(false);

  departamentos = signal<Departamento[]>([]);
  readonly observatorioSearch = signal('');
  readonly filteredDepartamentos = computed(() => {
    const normalize = (value: string) =>
      value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLocaleLowerCase('es')
        .trim();
    const query = normalize(this.observatorioSearch());
    return this.departamentos().filter((item) => normalize(item.nombre).includes(query));
  });
  navigate = output<void>();

  // Computed para verificar si el usuario es admin
  isAdmin = computed(() => this.authService.isAdmin());
  isEditor = computed(() => this.authService.isEditor());

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
    if (this.isAdmin()) {
      this.atlasCategoriaService.onCategoriasChanged$
        .pipe(
          startWith(undefined),
          switchMap(() => {
            this.atlasLoading.set(true);
            this.atlasError.set(false);
            return this.atlasCategoriaService.list().pipe(
              catchError(() => {
                this.atlasError.set(true);
                return of([]);
              }),
            );
          }),
          takeUntilDestroyed(this.destroyRef),
        )
        .subscribe((items) => {
          this.atlasCategorias.set(items);
          this.atlasLoading.set(false);
        });
    }

    // Suscribirse a cambios en departamentos para actualizar automáticamente
    this.deptoService.onDepartamentosChanged$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.loadDepartamentos();
      });
  }

  loadDepartamentos(): void {
    this.deptoService
      .getAll()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (departamentos) => this.departamentos.set(departamentos || []),
        error: () => this.departamentos.set([]),
      });
  }

  loadAtlasCategorias(): void {
    if (!this.isAdmin() || this.atlasLoading()) return;
    this.atlasLoading.set(true);
    this.atlasError.set(false);
    this.atlasCategoriaService
      .list()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (items) => {
          this.atlasCategorias.set(items);
          this.atlasLoading.set(false);
        },
        error: () => {
          this.atlasError.set(true);
          this.atlasLoading.set(false);
        },
      });
  }

  getDeptoColor(depto: Departamento): string {
    const index = this.departamentos().indexOf(depto);
    return this.deptoColors[index % this.deptoColors.length];
  }
}
