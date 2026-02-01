import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { NgxEchartsDirective } from 'ngx-echarts';
import { EChartsOption } from 'echarts';

import { DashboardService, BivariableResponse } from '../../core/services/dashboard.service';
import { ChartThemeService } from '../../core/services/chart-theme.service';
import { VariableMetadato, ChartData } from '../../core/models';

interface ChartType {
  id: string;
  name: string;
  icon: string;
  description: string;
  forTypes: ('NUMERICO' | 'CATEGORICO' | 'FECHA' | 'TEXTO')[];
  bivariable?: boolean;
}

interface ActiveChart {
  id: string;
  title: string;
  chartType: ChartType;
  variableX: VariableMetadato;
  variableY?: VariableMetadato;
  data: ChartData | BivariableResponse | null;
  loading: boolean;
}

@Component({
  selector: 'app-public-dataset-view',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatTabsModule,
    MatTableModule,
    MatPaginatorModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatFormFieldModule,
    MatChipsModule,
    MatTooltipModule,
    MatDividerModule,
    NgxEchartsDirective,
  ],
  template: `
    <div class="page-container">
      @if (loading()) {
        <div class="loading-container">
          <mat-spinner diameter="48"></mat-spinner>
          <p>Cargando dataset...</p>
        </div>
      } @else if (datasetInfo()) {
        <!-- Breadcrumb -->
        <nav class="breadcrumb">
          <a [routerLink]="['/publico/departamentos', departamentoId()]">
            <mat-icon>arrow_back</mat-icon>
            Volver al departamento
          </a>
        </nav>

        <!-- Dataset Header -->
        <div class="dataset-header">
          <div class="header-icon">
            <mat-icon>description</mat-icon>
          </div>
          <div class="header-info">
            <h1>{{ datasetInfo()?.nombre }}</h1>
            <div class="header-stats">
              <span class="stat">
                <mat-icon>grid_on</mat-icon>
                {{ datasetInfo()?.total_registros | number }} registros
              </span>
              <span class="stat">
                <mat-icon>view_column</mat-icon>
                {{ variables().length }} variables
              </span>
            </div>
          </div>
        </div>

        <!-- Tabs -->
        <mat-tab-group animationDuration="200ms" class="dataset-tabs">
          <!-- Tab: Datos -->
          <mat-tab>
            <ng-template mat-tab-label>
              <mat-icon class="tab-icon">table_chart</mat-icon>
              Datos
            </ng-template>
            <div class="tab-content">
              <mat-card class="data-card">
                <div class="table-container">
                  @if (visibleColumns().length > 0 && tableData().length > 0) {
                    <table mat-table [dataSource]="tableData()" class="data-table">
                      @for (col of visibleColumns(); track col.id) {
                        <ng-container [matColumnDef]="col.nombre_columna">
                          <th mat-header-cell *matHeaderCellDef>
                            <div class="header-cell">
                              <span>{{ col.nombre_original || col.nombre_columna }}</span>
                              <span class="type-indicator" [class]="getTypeClass(col.tipo_dato)">
                                {{ getTypeShort(col.tipo_dato) }}
                              </span>
                            </div>
                          </th>
                          <td mat-cell *matCellDef="let row">{{ row.data[col.nombre_columna] }}</td>
                        </ng-container>
                      }
                      <tr mat-header-row *matHeaderRowDef="columnNames()"></tr>
                      <tr mat-row *matRowDef="let row; columns: columnNames();"></tr>
                    </table>
                  } @else {
                    <div class="empty-state">
                      <mat-icon>table_rows</mat-icon>
                      <p>No hay datos disponibles</p>
                    </div>
                  }
                </div>
                <mat-paginator
                  [length]="pagination().total"
                  [pageSize]="pagination().per_page"
                  [pageIndex]="pagination().current_page - 1"
                  [pageSizeOptions]="[25, 50, 100]"
                  (page)="onPageChange($event)"
                  showFirstLastButtons>
                </mat-paginator>
              </mat-card>
            </div>
          </mat-tab>

          <!-- Tab: Análisis -->
          <mat-tab>
            <ng-template mat-tab-label>
              <mat-icon class="tab-icon">analytics</mat-icon>
              Análisis
            </ng-template>
            <div class="tab-content">
              <!-- Chart Creator -->
              <mat-card class="chart-creator-card">
                <mat-card-header>
                  <mat-card-title>Crear Visualización</mat-card-title>
                  <mat-card-subtitle>Selecciona el tipo de gráfico y las variables</mat-card-subtitle>
                </mat-card-header>
                <mat-card-content>
                  <!-- Chart Types Grid -->
                  <div class="chart-types-grid">
                    @for (type of chartTypes; track type.id) {
                      <div 
                        class="chart-type-item"
                        [class.selected]="selectedChartType()?.id === type.id"
                        (click)="selectChartType(type)">
                        <mat-icon>{{ type.icon }}</mat-icon>
                        <span class="type-name">{{ type.name }}</span>
                        <span class="type-desc">{{ type.description }}</span>
                      </div>
                    }
                  </div>

                  <mat-divider class="creator-divider"></mat-divider>

                  <!-- Variable Selection -->
                  <div class="variable-selection">
                    <mat-form-field appearance="outline">
                      <mat-label>Variable Principal</mat-label>
                      <mat-select [(value)]="selectedVariableX">
                        @for (v of compatibleVariablesX(); track v.id) {
                          <mat-option [value]="v">
                            {{ v.nombre_original }}
                            <span class="option-type">({{ v.tipo_dato }})</span>
                          </mat-option>
                        }
                      </mat-select>
                      @if (compatibleVariablesX().length === 0) {
                        <mat-hint class="hint-error">{{ getIncompatibilityMessage() }}</mat-hint>
                      } @else {
                        <mat-hint>{{ compatibleVariablesX().length }} variables disponibles</mat-hint>
                      }
                    </mat-form-field>

                    @if (selectedChartType()?.bivariable) {
                      <mat-form-field appearance="outline">
                        <mat-label>Variable Secundaria</mat-label>
                        <mat-select [(value)]="selectedVariableY">
                          @for (v of compatibleVariablesY(); track v.id) {
                            <mat-option [value]="v">
                              {{ v.nombre_original }}
                              <span class="option-type">({{ v.tipo_dato }})</span>
                            </mat-option>
                          }
                        </mat-select>
                        @if (selectedVariableX && compatibleVariablesY().length === 0) {
                          <mat-hint class="hint-error">{{ getIncompatibilityMessage() }}</mat-hint>
                        } @else if (compatibleVariablesY().length > 0) {
                          <mat-hint>{{ compatibleVariablesY().length }} variables compatibles</mat-hint>
                        }
                      </mat-form-field>
                    }

                    <button 
                      mat-raised-button 
                      color="primary" 
                      [disabled]="!canAddChart()"
                      (click)="addChart()">
                      <mat-icon>add_chart</mat-icon>
                      Agregar Gráfico
                    </button>
                  </div>
                </mat-card-content>
              </mat-card>

              <!-- Quick Actions -->
              <div class="quick-actions">
                <button mat-stroked-button (click)="addAllUnivariate()" [disabled]="addingChart()">
                  <mat-icon>auto_graph</mat-icon>
                  Generar Todo Automático
                </button>
                <button mat-stroked-button color="warn" (click)="clearAllCharts()" [disabled]="activeCharts().length === 0">
                  <mat-icon>delete_sweep</mat-icon>
                  Limpiar
                </button>
                <span class="charts-counter">{{ activeCharts().length }} gráfico(s)</span>
              </div>

              <!-- Charts Grid -->
              @if (activeCharts().length > 0) {
                <div class="charts-grid">
                  @for (chart of activeCharts(); track chart.id) {
                    <mat-card class="chart-card">
                      <button mat-icon-button class="remove-chart" (click)="removeChart(chart.id)">
                        <mat-icon>close</mat-icon>
                      </button>
                      <mat-card-header>
                        <mat-icon mat-card-avatar>{{ chart.chartType.icon }}</mat-icon>
                        <mat-card-title>{{ chart.title }}</mat-card-title>
                        <mat-card-subtitle>{{ chart.chartType.name }}</mat-card-subtitle>
                      </mat-card-header>
                      <mat-card-content>
                        @if (chart.loading) {
                          <div class="chart-loading">
                            <mat-spinner diameter="32"></mat-spinner>
                          </div>
                        } @else if (chart.data) {
                          <div echarts [options]="getChartOptions(chart)" class="chart-canvas"></div>
                        } @else {
                          <div class="chart-error">
                            <mat-icon>error_outline</mat-icon>
                            <p>No se pudieron cargar los datos</p>
                          </div>
                        }
                      </mat-card-content>
                    </mat-card>
                  }
                </div>
              } @else {
                <div class="no-charts">
                  <mat-icon>insert_chart</mat-icon>
                  <h3>Sin gráficos</h3>
                  <p>Selecciona un tipo de gráfico y variables para comenzar a analizar</p>
                </div>
              }
            </div>
          </mat-tab>
        </mat-tab-group>
      } @else {
        <div class="error-state">
          <mat-icon>error_outline</mat-icon>
          <h2>Dataset no encontrado</h2>
          <p>El dataset que buscas no existe o no está disponible públicamente</p>
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
      max-width: 1400px;
      margin: 0 auto;
      padding: 2rem 1.5rem;
    }

    .loading-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 6rem;
      color: var(--text-secondary);
    }

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
    }

    .breadcrumb a:hover { color: var(--primary-600); }

    /* Dataset Header */
    .dataset-header {
      display: flex;
      align-items: center;
      gap: 1.5rem;
      padding: 1.5rem;
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: var(--radius-xl);
      margin-bottom: 1.5rem;
    }

    .header-icon {
      width: 64px;
      height: 64px;
      background: var(--primary-50);
      border-radius: var(--radius-lg);
      display: flex;
      align-items: center;
      justify-content: center;
    }

    :host-context(.dark) .header-icon {
      background: rgba(99, 102, 241, 0.15);
    }

    .header-icon mat-icon {
      font-size: 32px;
      width: 32px;
      height: 32px;
      color: var(--primary-600);
    }

    .header-info h1 {
      font-size: 1.5rem;
      font-weight: 700;
      color: var(--text-primary);
      margin: 0 0 0.5rem;
    }

    .header-stats {
      display: flex;
      gap: 1.5rem;
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

    /* Tabs */
    .dataset-tabs { margin-bottom: 2rem; }

    .tab-icon {
      margin-right: 0.5rem;
    }

    .tab-content {
      padding: 1.5rem 0;
    }

    /* Data Table */
    .data-card {
      overflow: hidden;
    }

    .table-container {
      overflow-x: auto;
    }

    .data-table {
      width: 100%;
      background: transparent !important;
    }

    .header-cell {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .type-indicator {
      font-size: 0.625rem;
      padding: 0.125rem 0.375rem;
      border-radius: var(--radius-sm);
      text-transform: uppercase;
      font-weight: 600;
    }

    .type-indicator.type-numeric { background: var(--type-numeric-bg); color: var(--type-numeric-color); }
    .type-indicator.type-categoric { background: var(--type-categoric-bg); color: var(--type-categoric-color); }
    .type-indicator.type-date { background: var(--type-date-bg); color: var(--type-date-color); }
    .type-indicator.type-text { background: var(--type-text-bg); color: var(--type-text-color); }

    /* Chart Creator */
    .chart-creator-card {
      margin-bottom: 1.5rem;
    }

    .chart-types-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
      gap: 0.75rem;
      margin-top: 1rem;
    }

    .chart-type-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 1rem;
      border: 2px solid var(--border-color);
      border-radius: var(--radius-lg);
      cursor: pointer;
      text-align: center;
      transition: all var(--transition-fast);
    }

    .chart-type-item:hover {
      border-color: var(--primary-300);
      background: var(--hover-bg);
    }

    .chart-type-item.selected {
      border-color: var(--primary-500);
      background: var(--primary-50);
    }

    :host-context(.dark) .chart-type-item.selected {
      background: rgba(99, 102, 241, 0.15);
    }

    .chart-type-item mat-icon {
      font-size: 28px;
      width: 28px;
      height: 28px;
      color: var(--text-secondary);
      margin-bottom: 0.5rem;
    }

    .chart-type-item.selected mat-icon {
      color: var(--primary-600);
    }

    .type-name {
      font-weight: 600;
      font-size: 0.875rem;
      color: var(--text-primary);
    }

    .type-desc {
      font-size: 0.75rem;
      color: var(--text-tertiary);
      margin-top: 0.25rem;
    }

    .creator-divider {
      margin: 1.5rem 0;
    }

    .variable-selection {
      display: flex;
      gap: 1rem;
      flex-wrap: wrap;
      align-items: flex-end;
    }

    .variable-selection mat-form-field {
      flex: 1;
      min-width: 200px;
    }

    .option-type {
      font-size: 0.75rem;
      color: var(--text-tertiary);
      margin-left: 0.5rem;
    }

    /* Quick Actions */
    .quick-actions {
      display: flex;
      gap: 0.75rem;
      align-items: center;
      margin-bottom: 1.5rem;
    }

    .charts-counter {
      margin-left: auto;
      color: var(--text-secondary);
      font-size: 0.875rem;
    }

    /* Charts Grid */
    .charts-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 1.5rem;
    }

    @media (max-width: 1024px) {
      .charts-grid { grid-template-columns: 1fr; }
    }

    .chart-card {
      position: relative;
    }

    .remove-chart {
      position: absolute;
      top: 8px;
      right: 8px;
      z-index: 10;
    }

    .chart-canvas {
      height: 280px;
    }

    .chart-loading, .chart-error {
      height: 280px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      color: var(--text-tertiary);
    }

    .no-charts {
      text-align: center;
      padding: 4rem;
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: var(--radius-xl);
    }

    .no-charts mat-icon {
      font-size: 64px;
      width: 64px;
      height: 64px;
      color: var(--text-tertiary);
      opacity: 0.5;
    }

    .no-charts h3 {
      color: var(--text-primary);
      margin: 1rem 0 0.5rem;
    }

    .no-charts p {
      color: var(--text-secondary);
    }

    .empty-state, .error-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 4rem;
      text-align: center;
    }

    .error-state mat-icon {
      font-size: 64px;
      width: 64px;
      height: 64px;
      color: var(--error-color);
      opacity: 0.5;
    }

    .error-state h2 {
      margin: 1rem 0 0.5rem;
    }

    .error-state p {
      color: var(--text-secondary);
      margin-bottom: 1.5rem;
    }

    .hint-error {
      color: var(--warning-color, #F59E0B) !important;
      font-weight: 500;
    }

    ::ng-deep .mat-mdc-form-field-hint {
      font-size: 0.75rem;
    }
  `]
})
export class PublicDatasetViewComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private dashboardService = inject(DashboardService);
  private chartTheme = inject(ChartThemeService);

  readonly chartTypes: ChartType[] = [
    // Univariables
    { id: 'bar', name: 'Barras', icon: 'bar_chart', description: 'Comparar categorías', forTypes: ['CATEGORICO', 'TEXTO'] },
    { id: 'pie', name: 'Pastel', icon: 'pie_chart', description: 'Proporciones', forTypes: ['CATEGORICO'] },
    { id: 'donut', name: 'Anillo', icon: 'donut_large', description: 'Con total', forTypes: ['CATEGORICO'] },
    { id: 'histogram', name: 'Histograma', icon: 'equalizer', description: 'Distribución', forTypes: ['NUMERICO'] },
    { id: 'line', name: 'Líneas', icon: 'show_chart', description: 'Tendencias', forTypes: ['FECHA', 'NUMERICO', 'CATEGORICO'] },
    { id: 'area', name: 'Área', icon: 'area_chart', description: 'Tendencias con área', forTypes: ['FECHA', 'NUMERICO', 'CATEGORICO'] },
    { id: 'funnel', name: 'Embudo', icon: 'filter_list', description: 'Procesos', forTypes: ['CATEGORICO'] },
    { id: 'treemap', name: 'Treemap', icon: 'grid_view', description: 'Jerarquía', forTypes: ['CATEGORICO'] },
    { id: 'gauge', name: 'Indicador', icon: 'speed', description: 'Medidor', forTypes: ['NUMERICO'] },
    { id: 'radar', name: 'Radar', icon: 'radar', description: 'Múltiples ejes', forTypes: ['CATEGORICO'] },
    // Bivariables
    { id: 'scatter', name: 'Dispersión', icon: 'scatter_plot', description: 'Correlación 2 numéricas', forTypes: ['NUMERICO'], bivariable: true },
    { id: 'grouped_bar', name: 'Barras Agrupadas', icon: 'stacked_bar_chart', description: 'Promedio por categoría', forTypes: ['CATEGORICO', 'NUMERICO', 'TEXTO'], bivariable: true },
    { id: 'heatmap', name: 'Mapa de Calor', icon: 'grid_on', description: 'Matriz de frecuencias', forTypes: ['CATEGORICO', 'TEXTO'], bivariable: true },
    { id: 'box_compare', name: 'Comparar Promedios', icon: 'leaderboard', description: 'Promedio por categoría', forTypes: ['CATEGORICO', 'NUMERICO', 'TEXTO'], bivariable: true },
    { id: 'line_time', name: 'Serie Temporal', icon: 'timeline', description: 'Evolución en el tiempo', forTypes: ['FECHA', 'NUMERICO'], bivariable: true },
    { id: 'stacked_bar', name: 'Barras Apiladas', icon: 'stacked_bar_chart', description: 'Categorías por tiempo', forTypes: ['FECHA', 'CATEGORICO'], bivariable: true },
  ];

  loading = signal(true);
  datasetId = signal('');
  departamentoId = signal('');
  datasetInfo = signal<{ id: string; nombre: string; total_registros: number } | null>(null);
  variables = signal<VariableMetadato[]>([]);
  tableData = signal<{ id: number; data: Record<string, any> }[]>([]);
  pagination = signal({ current_page: 1, last_page: 1, per_page: 50, total: 0 });

  selectedChartType = signal<ChartType | null>(null);
  selectedVariableX: VariableMetadato | null = null;
  selectedVariableY: VariableMetadato | null = null;
  activeCharts = signal<ActiveChart[]>([]);
  addingChart = signal(false);

  visibleColumns = computed(() => this.variables().filter(v => v.es_visible));
  columnNames = computed(() => this.visibleColumns().map(v => v.nombre_columna));
  
  // Todas las variables visibles son analizables (TEXTO se trata como CATEGORICO)
  analysableVariables = computed(() => this.variables().filter(v => v.es_visible));

  // Variables compatibles con el tipo de gráfico seleccionado (Variable X)
  compatibleVariablesX = computed(() => {
    const chartType = this.selectedChartType();
    const vars = this.analysableVariables();
    if (!chartType) return vars;

    return vars.filter(v => {
      switch (chartType.id) {
        case 'scatter':
        case 'histogram':
        case 'gauge':
          return v.tipo_dato === 'NUMERICO';
        case 'pie':
        case 'donut':
        case 'funnel':
        case 'treemap':
        case 'radar':
          return v.tipo_dato === 'CATEGORICO' || v.tipo_dato === 'TEXTO';
        case 'bar':
        case 'heatmap':
        case 'stacked_bar':
          return v.tipo_dato === 'CATEGORICO' || v.tipo_dato === 'TEXTO';
        case 'grouped_bar':
        case 'box_compare':
          return v.tipo_dato === 'CATEGORICO' || v.tipo_dato === 'NUMERICO' || v.tipo_dato === 'TEXTO';
        case 'line_time':
          return v.tipo_dato === 'FECHA' || v.tipo_dato === 'NUMERICO';
        case 'line':
        case 'area':
          return v.tipo_dato === 'FECHA' || v.tipo_dato === 'NUMERICO' || v.tipo_dato === 'CATEGORICO';
        default:
          return true;
      }
    });
  });

  // Variables compatibles para Y (solo bivariables)
  compatibleVariablesY = computed(() => {
    const chartType = this.selectedChartType();
    const vars = this.analysableVariables();
    if (!chartType?.bivariable) return [];

    const selectedX = this.selectedVariableX;
    const tipoX = selectedX?.tipo_dato === 'TEXTO' ? 'CATEGORICO' : selectedX?.tipo_dato;

    return vars.filter(v => {
      if (selectedX && v.id === selectedX.id) return false;
      const tipoY = v.tipo_dato === 'TEXTO' ? 'CATEGORICO' : v.tipo_dato;

      switch (chartType.id) {
        case 'scatter':
          return v.tipo_dato === 'NUMERICO';
        case 'heatmap':
          return v.tipo_dato === 'CATEGORICO' || v.tipo_dato === 'TEXTO';
        case 'stacked_bar':
          if (tipoX === 'FECHA') return tipoY === 'CATEGORICO';
          if (tipoX === 'CATEGORICO') return tipoY === 'FECHA' || tipoY === 'CATEGORICO';
          return tipoY === 'CATEGORICO';
        case 'grouped_bar':
        case 'box_compare':
          if (tipoX === 'CATEGORICO') return v.tipo_dato === 'NUMERICO';
          if (tipoX === 'NUMERICO') return v.tipo_dato === 'CATEGORICO' || v.tipo_dato === 'TEXTO';
          return v.tipo_dato === 'NUMERICO' || v.tipo_dato === 'CATEGORICO';
        case 'line_time':
          if (selectedX?.tipo_dato === 'FECHA') return v.tipo_dato === 'NUMERICO';
          if (selectedX?.tipo_dato === 'NUMERICO') return v.tipo_dato === 'FECHA';
          return v.tipo_dato === 'FECHA' || v.tipo_dato === 'NUMERICO';
        default:
          return true;
      }
    });
  });

  // Mensaje de incompatibilidad
  getIncompatibilityMessage(): string | null {
    const chartType = this.selectedChartType();
    if (!chartType) return null;

    if (this.compatibleVariablesX().length === 0) {
      switch (chartType.id) {
        case 'scatter':
        case 'histogram':
        case 'gauge':
          return 'Este gráfico requiere variables numéricas';
        case 'pie':
        case 'donut':
        case 'heatmap':
        case 'funnel':
        case 'treemap':
        case 'radar':
          return 'Este gráfico requiere variables categóricas';
        case 'line_time':
          return 'Este gráfico requiere una fecha y una numérica';
        default:
          return 'No hay variables compatibles';
      }
    }

    if (chartType.bivariable && this.selectedVariableX && this.compatibleVariablesY().length === 0) {
      switch (chartType.id) {
        case 'scatter':
          return 'Selecciona otra variable numérica';
        case 'heatmap':
          return 'Selecciona otra variable categórica';
        case 'grouped_bar':
        case 'box_compare':
          return 'Selecciona una variable del tipo opuesto';
        case 'line_time':
          return 'Selecciona una fecha o numérica';
        default:
          return 'No hay variables compatibles';
      }
    }

    return null;
  }

  get colors() { return this.chartTheme.getColors(); }
  get chartConfig() { return this.chartTheme.config(); }

  ngOnInit(): void {
    this.datasetId.set(this.route.snapshot.params['id']);
    this.loadData();
  }

  loadData(page = 1): void {
    this.loading.set(true);
    this.dashboardService.getPublicDatasetData(this.datasetId(), page).subscribe({
      next: (res) => {
        this.datasetInfo.set(res.dataset);
        this.variables.set(res.variables || []);
        this.tableData.set(res.data || []);
        this.pagination.set(res.pagination);
        if (res.dataset.departamento_id) {
          this.departamentoId.set(res.dataset.departamento_id);
        }
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  onPageChange(event: PageEvent): void {
    this.loadData(event.pageIndex + 1);
  }

  selectChartType(type: ChartType): void {
    this.selectedChartType.set(type);
    if (!type.bivariable) this.selectedVariableY = null;
  }

  canAddChart(): boolean {
    const type = this.selectedChartType();
    if (!type || !this.selectedVariableX) return false;
    if (type.bivariable && !this.selectedVariableY) return false;
    return true;
  }

  addChart(): void {
    const type = this.selectedChartType();
    if (!this.canAddChart() || !type || !this.selectedVariableX) return;

    const chartId = `chart-${Date.now()}`;
    const title = type.bivariable && this.selectedVariableY
      ? `${this.selectedVariableX.nombre_original} vs ${this.selectedVariableY.nombre_original}`
      : this.selectedVariableX.nombre_original;

    const newChart: ActiveChart = {
      id: chartId,
      title,
      chartType: type,
      variableX: this.selectedVariableX,
      variableY: this.selectedVariableY || undefined,
      data: null,
      loading: true
    };

    this.activeCharts.update(charts => [...charts, newChart]);
    this.addingChart.set(true);

    if (type.bivariable && this.selectedVariableY) {
      this.loadBivariableData(newChart);
    } else {
      this.loadUnivariableData(newChart);
    }
  }

  private loadUnivariableData(chart: ActiveChart): void {
    this.dashboardService.getPublicUnivariableStats({
      dataset_id: this.datasetId(),
      variable_id: chart.variableX.id,
      chart_type: chart.chartType.id
    }).subscribe({
      next: (res) => {
        const chartData: ChartData = {
          variable: res.nombre_variable,
          tipo: chart.variableX.tipo_dato === 'NUMERICO' ? 'numeric' : 
                chart.variableX.tipo_dato === 'FECHA' ? 'date' : 'categorical',
          chart_type: res.chart_type as any,
          data: { labels: res.data?.labels || [], values: res.data?.values || [] },
          stats: res.stats
        };
        this.updateChartData(chart.id, chartData);
      },
      error: () => this.updateChartData(chart.id, null)
    });
  }

  private loadBivariableData(chart: ActiveChart): void {
    if (!chart.variableY) return;

    this.dashboardService.getPublicBivariableStats({
      dataset_id: this.datasetId(),
      variable_x_id: chart.variableX.id,
      variable_y_id: chart.variableY.id,
      chart_type: chart.chartType.id
    }).subscribe({
      next: (res) => this.updateChartData(chart.id, res),
      error: () => this.updateChartData(chart.id, null)
    });
  }

  private updateChartData(chartId: string, data: ChartData | BivariableResponse | null): void {
    this.activeCharts.update(charts =>
      charts.map(c => c.id === chartId ? { ...c, data, loading: false } : c)
    );
    this.addingChart.set(false);
  }

  removeChart(chartId: string): void {
    this.activeCharts.update(charts => charts.filter(c => c.id !== chartId));
  }

  clearAllCharts(): void {
    this.activeCharts.set([]);
  }

  addAllUnivariate(): void {
    const vars = this.analysableVariables();
    this.addingChart.set(true);
    
    vars.forEach((variable, i) => {
      setTimeout(() => {
        const type = this.getDefaultChartType(variable.tipo_dato);
        if (!type) return;
        
        const chart: ActiveChart = {
          id: `chart-auto-${Date.now()}-${i}`,
          title: variable.nombre_original,
          chartType: type,
          variableX: variable,
          data: null,
          loading: true
        };
        
        this.activeCharts.update(charts => [...charts, chart]);
        this.loadUnivariableData(chart);
      }, i * 100);
    });
  }

  private getDefaultChartType(tipo: string): ChartType | undefined {
    switch (tipo) {
      case 'CATEGORICO': return this.chartTypes.find(t => t.id === 'bar');
      case 'NUMERICO': return this.chartTypes.find(t => t.id === 'histogram');
      case 'FECHA': return this.chartTypes.find(t => t.id === 'line');
      default: return undefined;
    }
  }

  getChartOptions(chart: ActiveChart): EChartsOption {
    if (!chart.data) return {};
    const cfg = this.chartConfig;
    const colors = this.colors;

    // Basic chart options with theme
    if ('variable_x_id' in chart.data || 'nombre_variable_x' in chart.data) {
      // Bivariable
      return this.getBivariableOptions(chart.data as BivariableResponse, chart.chartType.id, cfg, colors);
    }

    // Univariable
    const data = chart.data as ChartData;
    return this.getUnivariableOptions(data, chart.chartType.id, cfg, colors);
  }

  private getUnivariableOptions(data: ChartData, type: string, cfg: any, colors: string[]): EChartsOption {
    const labels = data.data?.labels || [];
    const values = data.data?.values || [];
    const title = data.variable || 'Variable';
    const total = values.reduce((a, b) => a + b, 0);
    const maxValue = Math.max(...values, 1);

    const baseOptions = {
      backgroundColor: 'transparent',
      textStyle: { color: cfg.textColor },
      tooltip: {
        backgroundColor: cfg.tooltipBg,
        borderColor: cfg.tooltipBorder,
        textStyle: { color: cfg.textColor },
        extraCssText: 'border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);'
      }
    };

    switch (type) {
      case 'bar':
        return {
          ...baseOptions,
          title: { text: title, left: 'center', textStyle: { color: cfg.textColor } },
          xAxis: { type: 'category', data: labels, axisLabel: { color: cfg.textColorSecondary, rotate: labels.length > 6 ? 45 : 0 } },
          yAxis: { type: 'value', axisLabel: { color: cfg.textColorSecondary }, splitLine: { lineStyle: { color: cfg.splitLineColor } } },
          series: [{ type: 'bar', data: values.map((v, i) => ({ value: v, itemStyle: { color: colors[i % colors.length], borderRadius: [4, 4, 0, 0] } })) }],
          grid: { bottom: labels.length > 6 ? 80 : 40, left: 60, right: 20, top: 60 }
        };
      case 'pie':
      case 'donut':
        return {
          ...baseOptions,
          title: { text: title, left: 'center', textStyle: { color: cfg.textColor } },
          legend: { bottom: 10, textStyle: { color: cfg.textColorSecondary }, type: 'scroll' },
          series: [{
            type: 'pie',
            radius: type === 'donut' ? ['40%', '70%'] : '70%',
            center: ['50%', '50%'],
            data: labels.map((l, i) => ({ name: l, value: values[i], itemStyle: { color: colors[i % colors.length] } })),
            label: { show: true, color: cfg.textColorSecondary },
            emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.2)' } }
          }]
        };
      case 'histogram':
        return {
          ...baseOptions,
          title: { text: `Distribución: ${title}`, left: 'center', textStyle: { color: cfg.textColor } },
          xAxis: { type: 'category', data: labels, axisLabel: { color: cfg.textColorSecondary, rotate: 45 } },
          yAxis: { type: 'value', axisLabel: { color: cfg.textColorSecondary }, splitLine: { lineStyle: { color: cfg.splitLineColor } } },
          series: [{ type: 'bar', data: values, itemStyle: { color: colors[2], borderRadius: [4, 4, 0, 0] } }],
          grid: { bottom: 80, left: 60, right: 20, top: 60 }
        };
      case 'line':
        return {
          ...baseOptions,
          title: { text: title, left: 'center', textStyle: { color: cfg.textColor } },
          xAxis: { type: 'category', data: labels, boundaryGap: false, axisLabel: { color: cfg.textColorSecondary } },
          yAxis: { type: 'value', axisLabel: { color: cfg.textColorSecondary }, splitLine: { lineStyle: { color: cfg.splitLineColor } } },
          series: [{ type: 'line', data: values, smooth: true, itemStyle: { color: colors[3] }, areaStyle: { color: `${colors[3]}20` } }],
          grid: { bottom: 40, left: 60, right: 20, top: 60 }
        };
      case 'area':
        return {
          ...baseOptions,
          title: { text: title, left: 'center', textStyle: { color: cfg.textColor } },
          xAxis: { type: 'category', data: labels, boundaryGap: false, axisLabel: { color: cfg.textColorSecondary } },
          yAxis: { type: 'value', axisLabel: { color: cfg.textColorSecondary }, splitLine: { lineStyle: { color: cfg.splitLineColor } } },
          series: [{
            type: 'line', data: values, smooth: true,
            itemStyle: { color: colors[4] },
            areaStyle: { 
              color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [
                { offset: 0, color: `${colors[4]}60` },
                { offset: 1, color: `${colors[4]}05` }
              ]}
            }
          }],
          grid: { bottom: 40, left: 60, right: 20, top: 60 }
        };
      case 'funnel':
        return {
          ...baseOptions,
          title: { text: title, left: 'center', textStyle: { color: cfg.textColor } },
          legend: { bottom: 10, textStyle: { color: cfg.textColorSecondary } },
          series: [{
            type: 'funnel',
            left: '10%', right: '10%', top: 60, bottom: 60,
            minSize: '20%', maxSize: '100%',
            sort: 'descending',
            gap: 2,
            label: { show: true, position: 'inside', color: '#fff' },
            data: labels.map((l, i) => ({ name: l, value: values[i], itemStyle: { color: colors[i % colors.length] } }))
          }]
        };
      case 'treemap':
        return {
          ...baseOptions,
          title: { text: title, left: 'center', textStyle: { color: cfg.textColor } },
          series: [{
            type: 'treemap',
            roam: false,
            breadcrumb: { show: false },
            label: { show: true, formatter: '{b}', color: '#fff' },
            data: labels.map((l, i) => ({ name: l, value: values[i], itemStyle: { color: colors[i % colors.length] } }))
          }]
        };
      case 'gauge': {
        const gaugeAvg = total / Math.max(values.length, 1);
        return {
          ...baseOptions,
          title: { text: title, left: 'center', textStyle: { color: cfg.textColor } },
          series: [{
            type: 'gauge',
            min: data.stats?.min ?? 0,
            max: data.stats?.max ?? 100,
            progress: { show: true, width: 18 },
            axisLine: { lineStyle: { width: 18, color: [[0.3, '#EF4444'], [0.7, '#F59E0B'], [1, '#10B981']] } },
            axisTick: { show: false },
            splitLine: { length: 12, lineStyle: { width: 2, color: cfg.splitLineColor } },
            axisLabel: { distance: 25, color: cfg.textColorSecondary },
            pointer: { itemStyle: { color: colors[0] } },
            title: { show: true, offsetCenter: [0, '70%'], color: cfg.textColorSecondary },
            detail: { valueAnimation: true, formatter: '{value}', color: cfg.textColor, fontSize: 24 },
            data: [{ value: Number(gaugeAvg.toFixed(1)), name: 'Promedio' }]
          }]
        };
      }
      case 'radar':
        return {
          ...baseOptions,
          title: { text: title, left: 'center', textStyle: { color: cfg.textColor } },
          radar: {
            indicator: labels.map((l, i) => ({ name: l, max: maxValue * 1.2 })),
            axisName: { color: cfg.textColorSecondary },
            splitLine: { lineStyle: { color: cfg.splitLineColor } },
            splitArea: { areaStyle: { color: ['transparent', `${cfg.splitLineColor}30`] } }
          },
          series: [{
            type: 'radar',
            data: [{ value: values, name: title, itemStyle: { color: colors[0] }, areaStyle: { color: `${colors[0]}40` } }]
          }]
        };
      default:
        return {};
    }
  }

  private getBivariableOptions(data: BivariableResponse, type: string, cfg: any, colors: string[]): EChartsOption {
    const d = data.data;
    const varX = data.nombre_variable_x || 'X';
    const varY = data.nombre_variable_y || 'Y';
    const correlation = d.correlation ?? data.stats?.correlation;

    // Normalizar datos
    const categories = d.categories || d.labels || d.labels_x || [];
    const values = d.values || [];
    const counts = d.counts || [];

    const baseOptions = {
      backgroundColor: 'transparent',
      textStyle: { color: cfg.textColor },
      tooltip: { 
        backgroundColor: cfg.tooltipBg, 
        borderColor: cfg.tooltipBorder, 
        textStyle: { color: cfg.textColor },
        extraCssText: 'border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);'
      }
    };

    // LINE_TIME (serie temporal)
    if (type === 'line_time' || (d.labels && d.values && !d.points && !d.heatmap && !d.series)) {
      const labels = d.labels || [];
      const vals = d.values || [];
      const total = vals.reduce((a: number, b: number) => a + b, 0);
      const avg = vals.length > 0 ? total / vals.length : 0;
      
      return {
        ...baseOptions,
        title: { text: `${varY} en el tiempo`, left: 'center', textStyle: { color: cfg.textColor } },
        xAxis: { type: 'category', data: labels, boundaryGap: false, axisLabel: { color: cfg.textColorSecondary, rotate: labels.length > 10 ? 45 : 0 } },
        yAxis: { type: 'value', name: varY, axisLabel: { color: cfg.textColorSecondary }, splitLine: { lineStyle: { color: cfg.splitLineColor } } },
        series: [{
          type: 'line', data: vals, smooth: true, symbol: 'circle', symbolSize: 6,
          lineStyle: { color: colors[0], width: 3 },
          itemStyle: { color: colors[0] },
          areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [
            { offset: 0, color: `${colors[0]}40` },
            { offset: 1, color: `${colors[0]}05` }
          ]}}
        }],
        grid: { bottom: labels.length > 10 ? 80 : 40, left: 60, right: 20, top: 60 }
      };
    }

    // SCATTER (2 numéricas)
    if (d.points && d.points.length > 0) {
      const correlationText = correlation !== undefined ? correlation.toFixed(3) : 'N/A';
      return {
        ...baseOptions,
        title: { 
          text: `${varX} vs ${varY}`, 
          subtext: `Correlación: ${correlationText}`,
          left: 'center', 
          textStyle: { color: cfg.textColor },
          subtextStyle: { color: cfg.textColorSecondary }
        },
        xAxis: { type: 'value', name: varX, scale: true, axisLabel: { color: cfg.textColorSecondary }, splitLine: { lineStyle: { color: cfg.splitLineColor } } },
        yAxis: { type: 'value', name: varY, scale: true, axisLabel: { color: cfg.textColorSecondary }, splitLine: { lineStyle: { color: cfg.splitLineColor } } },
        series: [{ 
          type: 'scatter', 
          data: d.points, 
          symbolSize: 8,
          itemStyle: { color: colors[5], opacity: 0.7 },
          emphasis: { itemStyle: { opacity: 1, borderColor: '#fff', borderWidth: 2 } }
        }],
        grid: { bottom: 50, left: 60, right: 30, top: 70 }
      };
    }

    // HEATMAP (2 categóricas)
    if (d.heatmap && d.labels_x && d.labels_y) {
      const maxVal = Math.max(...d.heatmap.map((h: [number, number, number]) => h[2]), 1);
      return {
        ...baseOptions,
        title: { text: `${varX} × ${varY}`, left: 'center', textStyle: { color: cfg.textColor } },
        xAxis: { type: 'category', data: d.labels_x, axisLabel: { color: cfg.textColorSecondary, rotate: 45 }, splitArea: { show: true } },
        yAxis: { type: 'category', data: d.labels_y, axisLabel: { color: cfg.textColorSecondary }, splitArea: { show: true } },
        visualMap: { 
          min: 0, max: maxVal, calculable: true, orient: 'horizontal', left: 'center', bottom: 10,
          inRange: { color: ['#FDF2F8', '#FBCFE8', '#F9A8D4', '#EC4899', '#BE185D'] }
        },
        series: [{ 
          type: 'heatmap', 
          data: d.heatmap,
          label: { show: d.labels_x.length <= 8 && d.labels_y.length <= 8, formatter: (p: any) => p.value[2] > 0 ? p.value[2] : '' },
          emphasis: { itemStyle: { shadowBlur: 10 } }
        }],
        grid: { bottom: 70, top: 60, left: 80, right: 20 }
      };
    }

    // STACKED/GROUPED BAR (con series)
    if (d.series && Array.isArray(d.series) && d.labels_x) {
      return {
        ...baseOptions,
        title: { text: `${varY} por ${varX}`, left: 'center', textStyle: { color: cfg.textColor } },
        legend: { bottom: 10, textStyle: { color: cfg.textColorSecondary }, type: 'scroll' },
        xAxis: { type: 'category', data: d.labels_x, axisLabel: { color: cfg.textColorSecondary, rotate: d.labels_x.length > 6 ? 45 : 0 } },
        yAxis: { type: 'value', axisLabel: { color: cfg.textColorSecondary }, splitLine: { lineStyle: { color: cfg.splitLineColor } } },
        series: d.series.map((s: any, i: number) => ({ 
          name: s.name, 
          type: 'bar', 
          stack: type === 'stacked_bar' ? 'total' : undefined,
          data: s.data, 
          itemStyle: { color: colors[i % colors.length], borderRadius: type !== 'stacked_bar' ? [4, 4, 0, 0] : 0 }
        })),
        grid: { bottom: 70, left: 60, right: 20, top: 60 }
      };
    }

    // BAR COMPARATIVO (grouped_bar, box_compare - categórica vs numérica)
    if (categories.length > 0 && values.length > 0) {
      const total = values.reduce((a: number, b: number) => a + b, 0);
      const avg = total / values.length;
      
      return {
        ...baseOptions,
        title: { 
          text: `Promedio de ${varY} por ${varX}`,
          subtext: `${categories.length} categorías`,
          left: 'center', 
          textStyle: { color: cfg.textColor },
          subtextStyle: { color: cfg.textColorSecondary }
        },
        xAxis: { type: 'category', data: categories, axisLabel: { color: cfg.textColorSecondary, rotate: categories.length > 5 ? 45 : 0 } },
        yAxis: { type: 'value', name: `Promedio de ${varY}`, axisLabel: { color: cfg.textColorSecondary }, splitLine: { lineStyle: { color: cfg.splitLineColor } } },
        series: [{
          type: 'bar',
          data: values.map((v: number, i: number) => ({ 
            value: v, 
            name: categories[i],
            itemStyle: { 
              color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [
                { offset: 0, color: colors[i % colors.length] },
                { offset: 1, color: this.adjustColor(colors[i % colors.length], -40) }
              ]},
              borderRadius: [6, 6, 0, 0]
            }
          })),
          barWidth: '60%',
          markLine: {
            silent: true, symbol: 'none',
            lineStyle: { color: '#EF4444', type: 'dashed', width: 2 },
            data: [{ yAxis: avg, label: { formatter: `Prom: ${avg.toFixed(1)}`, position: 'end', color: '#EF4444' } }]
          }
        }],
        grid: { bottom: categories.length > 5 ? 90 : 50, left: 70, right: 20, top: 70 }
      };
    }

    return {};
  }

  private adjustColor(color: string, amount: number): string {
    const clamp = (val: number) => Math.min(255, Math.max(0, val));
    let hex = color.replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    const r = clamp(parseInt(hex.substring(0, 2), 16) + amount);
    const g = clamp(parseInt(hex.substring(2, 4), 16) + amount);
    const b = clamp(parseInt(hex.substring(4, 6), 16) + amount);
    return `#${[r, g, b].map(c => c.toString(16).padStart(2, '0')).join('')}`;
  }

  getTypeClass(tipo: string): string {
    switch (tipo) {
      case 'NUMERICO': return 'type-numeric';
      case 'CATEGORICO': return 'type-categoric';
      case 'FECHA': return 'type-date';
      default: return 'type-text';
    }
  }

  getTypeShort(tipo: string): string {
    switch (tipo) {
      case 'NUMERICO': return 'NUM';
      case 'CATEGORICO': return 'CAT';
      case 'FECHA': return 'DATE';
      default: return 'TXT';
    }
  }
}
