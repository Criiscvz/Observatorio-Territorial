import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { DepartamentoService } from '../../core/services/departamento.service';
import { Departamento } from '../../core/models';

@Component({
  selector: 'app-public-departamentos',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatChipsModule,
  ],
  template: `
    <div class="page-container">
      <!-- Page Header -->
      <div class="page-header">
        <div class="header-content">
          <h1 class="page-title">Departamentos Públicos</h1>
          <p class="page-subtitle">Explora los datasets y análisis compartidos por la comunidad universitaria</p>
        </div>
        
        <!-- Search -->
        <div class="search-container">
          <mat-form-field appearance="outline" class="search-field">
            <mat-label>Buscar departamento</mat-label>
            <input matInput [(ngModel)]="searchTerm" (ngModelChange)="filterDepartamentos()" placeholder="Escribe para buscar...">
            <mat-icon matPrefix>search</mat-icon>
            @if (searchTerm) {
              <button matSuffix mat-icon-button (click)="clearSearch()">
                <mat-icon>close</mat-icon>
              </button>
            }
          </mat-form-field>
        </div>
      </div>

      <!-- Results info -->
      <div class="results-info">
        <span class="results-count">
          {{ filteredDepartamentos().length }} departamento(s) encontrado(s)
        </span>
      </div>

      @if (loading()) {
        <div class="loading-container">
          <mat-spinner diameter="48"></mat-spinner>
          <p>Cargando departamentos...</p>
        </div>
      } @else if (filteredDepartamentos().length > 0) {
        <div class="departments-grid">
          @for (depto of filteredDepartamentos(); track depto.id; let i = $index) {
            <a [routerLink]="['/publico/departamentos', depto.id]" class="department-card">
              <div class="card-header">
                <div class="department-avatar" [style.background]="getDeptoGradient(i)">
                  {{ depto.nombre.charAt(0).toUpperCase() }}
                </div>
                <div class="department-meta">
                  <h3>{{ depto.nombre }}</h3>
                  <span class="meta-badge">
                    <mat-icon>folder</mat-icon>
                    {{ depto.datasets_count || 0 }} datasets
                  </span>
                </div>
              </div>
              
              <p class="department-desc">
                {{ depto.descripcion || 'Sin descripción disponible' }}
              </p>

              @if (depto.datasets && depto.datasets.length > 0) {
                <div class="datasets-preview">
                  <span class="preview-label">Datasets recientes:</span>
                  <div class="dataset-chips">
                    @for (ds of depto.datasets.slice(0, 3); track ds.id) {
                      <span class="dataset-chip">{{ ds.nombre }}</span>
                    }
                    @if (depto.datasets.length > 3) {
                      <span class="more-chip">+{{ depto.datasets.length - 3 }} más</span>
                    }
                  </div>
                </div>
              }

              <div class="card-footer">
                <span class="view-link">
                  Ver departamento
                  <mat-icon>arrow_forward</mat-icon>
                </span>
              </div>
            </a>
          }
        </div>
      } @else {
        <div class="empty-state">
          <mat-icon>search_off</mat-icon>
          <h3>No se encontraron departamentos</h3>
          @if (searchTerm) {
            <p>No hay resultados para "{{ searchTerm }}"</p>
            <button mat-stroked-button (click)="clearSearch()">
              Limpiar búsqueda
            </button>
          } @else {
            <p>No hay departamentos públicos disponibles en este momento</p>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .page-container {
      max-width: 1400px;
      margin: 0 auto;
      padding: 2rem 1.5rem;
    }

    /* Page Header */
    .page-header {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: flex-start;
      gap: 1.5rem;
      margin-bottom: 1.5rem;
    }

    .page-title {
      font-size: 2rem;
      font-weight: 700;
      color: var(--text-primary);
      margin: 0;
    }

    .page-subtitle {
      color: var(--text-secondary);
      margin: 0.25rem 0 0;
    }

    .search-container {
      flex: 1;
      max-width: 400px;
      min-width: 280px;
    }

    .search-field {
      width: 100%;
    }

    ::ng-deep .search-field .mat-mdc-form-field-subscript-wrapper {
      display: none;
    }

    /* Results info */
    .results-info {
      margin-bottom: 1.5rem;
    }

    .results-count {
      color: var(--text-secondary);
      font-size: 0.875rem;
    }

    /* Loading */
    .loading-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 4rem;
      color: var(--text-secondary);
    }

    .loading-container p {
      margin-top: 1rem;
    }

    /* Departments Grid */
    .departments-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 1.5rem;
    }

    @media (max-width: 1024px) {
      .departments-grid { grid-template-columns: repeat(2, 1fr); }
    }

    @media (max-width: 640px) {
      .departments-grid { grid-template-columns: 1fr; }
    }

    /* Department Card */
    .department-card {
      display: flex;
      flex-direction: column;
      padding: 1.5rem;
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: var(--radius-xl);
      text-decoration: none;
      transition: all var(--transition-normal);
    }

    .department-card:hover {
      border-color: var(--primary-300);
      box-shadow: 0 12px 40px var(--shadow-color);
      transform: translateY(-4px);
    }

    .card-header {
      display: flex;
      align-items: flex-start;
      gap: 1rem;
      margin-bottom: 1rem;
    }

    .department-avatar {
      width: 56px;
      height: 56px;
      border-radius: var(--radius-lg);
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: 700;
      font-size: 1.5rem;
      flex-shrink: 0;
    }

    .department-meta h3 {
      font-size: 1.125rem;
      font-weight: 600;
      color: var(--text-primary);
      margin: 0 0 0.25rem;
    }

    .meta-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      font-size: 0.75rem;
      color: var(--text-tertiary);
      background: var(--bg-tertiary);
      padding: 0.25rem 0.5rem;
      border-radius: var(--radius-md);
    }

    .meta-badge mat-icon {
      font-size: 14px;
      width: 14px;
      height: 14px;
    }

    .department-desc {
      font-size: 0.875rem;
      color: var(--text-secondary);
      line-height: 1.5;
      margin: 0 0 1rem;
      display: -webkit-box;
      -webkit-line-clamp: 3;
      -webkit-box-orient: vertical;
      overflow: hidden;
      flex: 1;
    }

    /* Datasets Preview */
    .datasets-preview {
      margin-bottom: 1rem;
    }

    .preview-label {
      font-size: 0.75rem;
      color: var(--text-tertiary);
      display: block;
      margin-bottom: 0.5rem;
    }

    .dataset-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }

    .dataset-chip {
      font-size: 0.75rem;
      padding: 0.25rem 0.5rem;
      background: var(--primary-50);
      color: var(--primary-700);
      border-radius: var(--radius-full);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 120px;
    }

    :host-context(.dark) .dataset-chip {
      background: rgba(99, 102, 241, 0.15);
      color: var(--primary-400);
    }

    .more-chip {
      font-size: 0.75rem;
      padding: 0.25rem 0.5rem;
      background: var(--bg-tertiary);
      color: var(--text-secondary);
      border-radius: var(--radius-full);
    }

    /* Card Footer */
    .card-footer {
      padding-top: 1rem;
      border-top: 1px solid var(--border-color);
    }

    .view-link {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      font-size: 0.875rem;
      font-weight: 500;
      color: var(--primary-600);
      transition: gap var(--transition-fast);
    }

    .department-card:hover .view-link {
      gap: 0.5rem;
    }

    .view-link mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    /* Empty State */
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 4rem;
      text-align: center;
    }

    .empty-state mat-icon {
      font-size: 64px;
      width: 64px;
      height: 64px;
      color: var(--text-tertiary);
      opacity: 0.5;
    }

    .empty-state h3 {
      font-size: 1.25rem;
      font-weight: 600;
      color: var(--text-primary);
      margin: 1rem 0 0.5rem;
    }

    .empty-state p {
      color: var(--text-secondary);
      margin: 0 0 1.5rem;
    }
  `]
})
export class PublicDepartamentosComponent implements OnInit {
  private deptoService = inject(DepartamentoService);

  departamentos = signal<Departamento[]>([]);
  filteredDepartamentos = signal<Departamento[]>([]);
  loading = signal(true);
  searchTerm = '';

  private deptoGradients = [
    'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)',
    'linear-gradient(135deg, #EC4899 0%, #DB2777 100%)',
    'linear-gradient(135deg, #14B8A6 0%, #0D9488 100%)',
    'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
    'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)',
    'linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)',
    'linear-gradient(135deg, #06B6D4 0%, #0891B2 100%)',
    'linear-gradient(135deg, #84CC16 0%, #65A30D 100%)',
  ];

  ngOnInit(): void {
    this.loadDepartamentos();
  }

  loadDepartamentos(): void {
    this.deptoService.getPublicos().subscribe({
      next: (deptos) => {
        this.departamentos.set(deptos || []);
        this.filteredDepartamentos.set(deptos || []);
        this.loading.set(false);
      },
      error: () => {
        this.departamentos.set([]);
        this.filteredDepartamentos.set([]);
        this.loading.set(false);
      }
    });
  }

  filterDepartamentos(): void {
    const term = this.searchTerm.toLowerCase().trim();
    if (!term) {
      this.filteredDepartamentos.set(this.departamentos());
      return;
    }

    const filtered = this.departamentos().filter(d =>
      d.nombre.toLowerCase().includes(term) ||
      (d.descripcion && d.descripcion.toLowerCase().includes(term))
    );
    this.filteredDepartamentos.set(filtered);
  }

  clearSearch(): void {
    this.searchTerm = '';
    this.filteredDepartamentos.set(this.departamentos());
  }

  getDeptoGradient(index: number): string {
    return this.deptoGradients[index % this.deptoGradients.length];
  }
}
