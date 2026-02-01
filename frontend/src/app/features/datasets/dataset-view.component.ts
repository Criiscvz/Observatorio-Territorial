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
import { MatInputModule } from '@angular/material/input';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatSliderModule } from '@angular/material/slider';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatDividerModule } from '@angular/material/divider';
import { NgxEchartsDirective } from 'ngx-echarts';
import { EChartsOption } from 'echarts';

import { DatasetService } from '../../core/services/dataset.service';
import { DashboardService, BivariableResponse } from '../../core/services/dashboard.service';
import { ChartThemeService } from '../../core/services/chart-theme.service';
import { ThemeService } from '../../core/services/theme.service';
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
  error?: string | null;
  filters?: {
    min?: number;
    max?: number;
    limit?: number;
  };
}

interface ColumnWithUniqueId extends VariableMetadato {
  _uniqueId: string;
}

@Component({
  selector: 'app-dataset-view',
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
    MatInputModule,
    MatCheckboxModule,
    MatChipsModule,
    MatTooltipModule,
    MatSnackBarModule,
    MatSliderModule,
    MatExpansionModule,
    MatDividerModule,
    NgxEchartsDirective,
  ],
  template: `
    <div class="space-y-6">
      @if (loading()) {
        <div class="flex justify-center py-12">
          <mat-spinner></mat-spinner>
        </div>
      } @else if (datasetInfo()) {
        <!-- Header -->
        <div class="dataset-header">
          <div class="flex items-center gap-4">
            <a mat-icon-button [routerLink]="['/departamentos', departamentoId()]" matTooltip="Volver">
              <mat-icon>arrow_back</mat-icon>
            </a>
            <div>
              <h1 class="dataset-title">{{ datasetInfo()?.nombre }}</h1>
              <p class="dataset-subtitle">{{ datasetInfo()?.total_registros | number }} registros</p>
            </div>
          </div>
        </div>

        <!-- Tabs principales -->
        <mat-tab-group animationDuration="200ms">
          <!-- Tab: Datos -->
          <mat-tab>
            <ng-template mat-tab-label>
              <mat-icon class="mr-2">table_chart</mat-icon>
              Datos
            </ng-template>
            <div class="py-4">
              <mat-card>
                <mat-card-content>
                  <div class="overflow-x-auto">
                    @if (visibleColumns().length > 0 && tableData().length > 0) {
                      <table mat-table [dataSource]="tableData()" class="w-full">
                        <ng-container *ngFor="let col of visibleColumns()" [matColumnDef]="col._uniqueId">
                          <th mat-header-cell *matHeaderCellDef>
                            <div class="flex items-center gap-1">
                              <span>{{ col.nombre_original || col.nombre_columna }}</span>
                            </div>
                          </th>
                          <td mat-cell *matCellDef="let row">{{ row.data[col.nombre_columna] }}</td>
                        </ng-container>
                        <tr mat-header-row *matHeaderRowDef="columnNames()"></tr>
                        <tr mat-row *matRowDef="let row; columns: columnNames();"></tr>
                      </table>
                    } @else if (!loading()) {
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
                </mat-card-content>
              </mat-card>
            </div>
          </mat-tab>

          <!-- Tab: Configurar Variables -->
          <mat-tab>
            <ng-template mat-tab-label>
              <mat-icon class="mr-2">settings</mat-icon>
              Variables
            </ng-template>
            <div class="py-4">
              <mat-card>
                <mat-card-header>
                  <mat-card-title>Configuración de Variables</mat-card-title>
                  <mat-card-subtitle>Cambia el tipo de dato o visibilidad de cada columna</mat-card-subtitle>
                </mat-card-header>
                <mat-card-content>
                  <table mat-table [dataSource]="variables()" class="w-full">
                    <ng-container matColumnDef="nombre">
                      <th mat-header-cell *matHeaderCellDef>Columna</th>
                      <td mat-cell *matCellDef="let v">
                        <span class="font-medium">{{ v.nombre_original }}</span>
                      </td>
                    </ng-container>
                    <ng-container matColumnDef="tipo_dato">
                      <th mat-header-cell *matHeaderCellDef>Tipo</th>
                      <td mat-cell *matCellDef="let v">
                        <mat-form-field appearance="outline" class="!w-36 !text-sm">
                          <mat-select [(value)]="v.tipo_dato" (selectionChange)="updateVariable(v)">
                            <mat-option value="NUMERICO">Numérico</mat-option>
                            <mat-option value="CATEGORICO">Categórico</mat-option>
                            <mat-option value="FECHA">Fecha</mat-option>
                            <mat-option value="TEXTO">Texto</mat-option>
                          </mat-select>
                        </mat-form-field>
                      </td>
                    </ng-container>
                    <ng-container matColumnDef="es_visible">
                      <th mat-header-cell *matHeaderCellDef>Visible</th>
                      <td mat-cell *matCellDef="let v">
                        <mat-checkbox [(ngModel)]="v.es_visible" (change)="updateVariable(v)" color="primary">
                        </mat-checkbox>
                      </td>
                    </ng-container>
                    <tr mat-header-row *matHeaderRowDef="['nombre', 'tipo_dato', 'es_visible']"></tr>
                    <tr mat-row *matRowDef="let row; columns: ['nombre', 'tipo_dato', 'es_visible'];"></tr>
                  </table>
                </mat-card-content>
              </mat-card>
            </div>
          </mat-tab>

          <!-- Tab: Análisis y Gráficos -->
          <mat-tab>
            <ng-template mat-tab-label>
              <mat-icon class="mr-2">analytics</mat-icon>
              Análisis
            </ng-template>
            <div class="py-4 space-y-4">
              <!-- Panel de creación de gráficos -->
              <mat-card>
                <mat-card-header>
                  <mat-card-title>Crear Gráfico</mat-card-title>
                  <mat-card-subtitle>Selecciona el tipo de gráfico y las variables a analizar</mat-card-subtitle>
                </mat-card-header>
                <mat-card-content class="!pt-4">
                  <!-- Selector de tipo de gráfico visual -->
                  <div class="mb-4">
                    <p class="section-label">Tipo de Gráfico:</p>
                    <div class="chart-type-grid">
                      @for (type of chartTypes; track type.id) {
                        <div 
                          class="chart-type-card"
                          [class.selected]="selectedChartType()?.id === type.id"
                          (click)="selectChartType(type)">
                          <mat-icon class="chart-type-icon" [class.selected]="selectedChartType()?.id === type.id">
                            {{ type.icon }}
                          </mat-icon>
                          <p class="chart-type-name">{{ type.name }}</p>
                          <p class="chart-type-desc">{{ type.description }}</p>
                        </div>
                      }
                    </div>
                  </div>

                  <mat-divider class="!my-4"></mat-divider>

                  <!-- Mensaje de incompatibilidad -->
                  @if (getIncompatibilityMessage()) {
                    <div class="alert alert-warning mb-4">
                      <mat-icon>warning</mat-icon>
                      <span>{{ getIncompatibilityMessage() }}</span>
                    </div>
                  }

                  <!-- Selección de variables -->
                  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <mat-form-field appearance="outline">
                      <mat-label>Variable Principal (X)</mat-label>
                      <mat-select [(value)]="selectedVariableX" (selectionChange)="onVariableXChange()">
                        @for (v of compatibleVariablesX(); track v.id) {
                          <mat-option [value]="v">
                            <div class="flex items-center gap-2">
                              <span>{{ v.nombre_original }}</span>
                              <span class="type-badge" [class]="getTipoClass(v.tipo_dato)">
                                {{ v.tipo_dato }}
                              </span>
                            </div>
                          </mat-option>
                        }
                        @if (compatibleVariablesX().length === 0) {
                          <mat-option disabled>No hay variables compatibles</mat-option>
                        }
                      </mat-select>
                      <mat-hint *ngIf="selectedChartType()">
                        {{ getVariableHint('x') }}
                      </mat-hint>
                    </mat-form-field>

                    @if (selectedChartType()?.bivariable) {
                      <mat-form-field appearance="outline">
                        <mat-label>Variable Secundaria (Y)</mat-label>
                        <mat-select [(value)]="selectedVariableY" [disabled]="!selectedVariableX">
                          @for (v of compatibleVariablesY(); track v.id) {
                            <mat-option [value]="v">
                              <div class="flex items-center gap-2">
                                <span>{{ v.nombre_original }}</span>
                                <span class="type-badge" [class]="getTipoClass(v.tipo_dato)">
                                  {{ v.tipo_dato }}
                                </span>
                              </div>
                            </mat-option>
                          }
                          @if (compatibleVariablesY().length === 0 && selectedVariableX) {
                            <mat-option disabled>No hay variables compatibles</mat-option>
                          }
                        </mat-select>
                        <mat-hint>{{ getVariableHint('y') }}</mat-hint>
                      </mat-form-field>
                    }

                    <!-- Filtros opcionales -->
                    @if (selectedChartType() && selectedVariableX) {
                      <mat-form-field appearance="outline">
                        <mat-label>Límite de resultados</mat-label>
                        <mat-select [(value)]="chartLimit">
                          <mat-option [value]="10">Top 10</mat-option>
                          <mat-option [value]="20">Top 20</mat-option>
                          <mat-option [value]="50">Top 50</mat-option>
                          <mat-option [value]="100">Top 100</mat-option>
                          <mat-option [value]="null">Sin límite</mat-option>
                        </mat-select>
                      </mat-form-field>

                      <div class="flex items-end">
                        <button mat-raised-button color="primary" 
                                [disabled]="!canAddChart() || addingChart()"
                                (click)="addChart()">
                          @if (addingChart()) {
                            <mat-icon class="animate-spin">refresh</mat-icon>
                          } @else {
                            <mat-icon>add_chart</mat-icon>
                          }
                          Agregar Gráfico
                        </button>
                      </div>
                    }
                  </div>
                </mat-card-content>
              </mat-card>

              <!-- Acciones rápidas -->
              <div class="actions-bar">
                <button mat-stroked-button (click)="addAllUnivariate()" [disabled]="addingChart()">
                  <mat-icon>auto_graph</mat-icon>
                  Generar Todos (Univariable)
                </button>
                <button mat-stroked-button color="warn" (click)="clearAllCharts()" 
                        [disabled]="activeCharts().length === 0">
                  <mat-icon>delete_sweep</mat-icon>
                  Limpiar Todo
                </button>
                <span class="flex-grow"></span>
                <span class="charts-count">
                  {{ activeCharts().length }} gráfico(s) activo(s)
                </span>
              </div>

              <!-- Grilla de gráficos activos -->
              @if (activeCharts().length > 0) {
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  @for (chart of activeCharts(); track chart.id) {
                    <mat-card class="relative">
                      <!-- Botón eliminar -->
                      <button mat-icon-button class="!absolute top-2 right-2 z-10" 
                              (click)="removeChart(chart.id)" matTooltip="Eliminar gráfico">
                        <mat-icon>close</mat-icon>
                      </button>

                      <mat-card-header>
                        <mat-icon mat-card-avatar class="!text-red-500">{{ chart.chartType.icon }}</mat-icon>
                        <mat-card-title>{{ chart.title }}</mat-card-title>
                        <mat-card-subtitle>{{ chart.chartType.name }}</mat-card-subtitle>
                      </mat-card-header>

                      <mat-card-content>
                        @if (chart.loading) {
                          <div class="chart-loading">
                            <mat-spinner diameter="40"></mat-spinner>
                          </div>
                        } @else if (chart.error) {
                          <div class="chart-error">
                            <mat-icon>error_outline</mat-icon>
                            <p class="error-message">{{ chart.error }}</p>
                            <button mat-stroked-button color="primary" (click)="retryChart(chart)">
                              <mat-icon>refresh</mat-icon>
                              Reintentar
                            </button>
                          </div>
                        } @else if (chart.data) {
                          <!-- Estadísticas si aplica -->
                          @if (getChartStats(chart)) {
                            <div class="stats-grid">
                              @if (getChartStats(chart)?.mean !== undefined) {
                                <div class="stat-box stat-info">
                                  <span class="stat-label">Promedio</span>
                                  <span class="stat-value">{{ formatNumber(getChartStats(chart)?.mean) }}</span>
                                </div>
                              }
                              @if (getChartStats(chart)?.count !== undefined) {
                                <div class="stat-box stat-success">
                                  <span class="stat-label">Total</span>
                                  <span class="stat-value">{{ getChartStats(chart)?.count | number }}</span>
                                </div>
                              }
                              @if (getChartStats(chart)?.correlation !== undefined) {
                                <div class="stat-box" [class]="getCorrelationBoxClass(getChartStats(chart)?.correlation)">
                                  <span class="stat-label">Correlación</span>
                                  <span class="stat-value">{{ getChartStats(chart)?.correlation }}</span>
                                </div>
                              }
                            </div>
                          }
                          <div echarts [options]="getChartOptions(chart)" class="chart-container"></div>
                        } @else {
                          <div class="chart-empty">
                            <mat-icon>insert_chart_outlined</mat-icon>
                            <p>No hay datos disponibles</p>
                          </div>
                        }
                      </mat-card-content>
                    </mat-card>
                  }
                </div>
              } @else {
                <mat-card>
                  <mat-card-content class="charts-empty-state">
                    <mat-icon>insert_chart</mat-icon>
                    <h3>Sin gráficos</h3>
                    <p>Selecciona un tipo de gráfico y una variable para comenzar</p>
                  </mat-card-content>
                </mat-card>
              }
            </div>
          </mat-tab>
        </mat-tab-group>
      }
    </div>
  `,
  styles: [`
    .mat-mdc-table { background: transparent; }
    ::ng-deep .mat-mdc-form-field-subscript-wrapper { display: none; }
    
    /* Header del dataset */
    .dataset-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: var(--radius-xl);
      padding: 1rem;
    }
    
    .dataset-title {
      font-size: 1.5rem;
      font-weight: 700;
      color: var(--text-primary);
      margin: 0;
    }
    
    .dataset-subtitle {
      color: var(--text-secondary);
      margin: 0;
    }
    
    /* Estado vacío */
    .empty-state {
      text-align: center;
      padding: 2rem;
      color: var(--text-tertiary);
    }
    
    .empty-state mat-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
    }
    
    /* Selector de tipos de gráfico */
    .section-label {
      font-size: 0.875rem;
      font-weight: 500;
      color: var(--text-secondary);
      margin-bottom: 0.75rem;
    }
    
    .chart-type-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 0.75rem;
    }
    
    @media (min-width: 768px) {
      .chart-type-grid { grid-template-columns: repeat(4, 1fr); }
    }
    
    @media (min-width: 1024px) {
      .chart-type-grid { grid-template-columns: repeat(6, 1fr); }
    }
    
    .chart-type-card {
      padding: 0.75rem;
      border-radius: var(--radius-lg);
      border: 2px solid var(--border-color);
      cursor: pointer;
      text-align: center;
      transition: all var(--transition-fast);
      background: var(--bg-secondary);
    }
    
    .chart-type-card:hover {
      border-color: var(--primary-300);
      background: var(--hover-bg);
    }
    
    .chart-type-card.selected {
      border-color: var(--primary-500);
      background: var(--primary-50);
    }
    
    :host-context(.dark) .chart-type-card.selected {
      background: rgba(99, 102, 241, 0.15);
    }
    
    .chart-type-icon {
      font-size: 32px;
      width: 32px;
      height: 32px;
      color: var(--text-secondary);
    }
    
    .chart-type-icon.selected {
      color: var(--primary-600);
    }
    
    :host-context(.dark) .chart-type-icon.selected {
      color: var(--primary-400);
    }
    
    .chart-type-name {
      font-weight: 500;
      font-size: 0.875rem;
      margin-top: 0.25rem;
      color: var(--text-primary);
    }
    
    .chart-type-desc {
      font-size: 0.75rem;
      color: var(--text-tertiary);
      margin: 0;
    }
    
    /* Estadísticas del gráfico */
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 0.5rem;
      margin-bottom: 0.75rem;
    }
    
    .stat-box {
      padding: 0.5rem;
      border-radius: var(--radius-md);
      text-align: center;
    }
    
    .stat-box.stat-info {
      background: var(--info-bg);
    }
    
    .stat-box.stat-success {
      background: var(--success-bg);
    }
    
    .stat-box.stat-warning {
      background: var(--warning-bg);
    }
    
    .stat-box.stat-error {
      background: var(--error-bg);
    }
    
    .stat-label {
      display: block;
      font-size: 0.75rem;
      color: var(--text-secondary);
    }
    
    .stat-value {
      font-weight: 700;
      color: var(--text-primary);
    }
    
    .stat-box.stat-info .stat-value { color: var(--info-color); }
    .stat-box.stat-success .stat-value { color: var(--success-color); }
    .stat-box.stat-warning .stat-value { color: var(--warning-color); }
    .stat-box.stat-error .stat-value { color: var(--error-color); }
    
    /* Contenedor del gráfico */
    .chart-container {
      height: 256px;
    }
    
    .chart-loading {
      height: 256px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .chart-empty {
      height: 256px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      color: var(--text-tertiary);
      gap: 0.5rem;
    }
    
    .chart-empty mat-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      opacity: 0.5;
    }
    
    .chart-error {
      height: 256px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: 1rem;
      gap: 0.75rem;
    }
    
    .chart-error mat-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      color: var(--error-color);
      opacity: 0.7;
    }
    
    .chart-error .error-message {
      color: var(--text-secondary);
      font-size: 0.875rem;
      margin: 0;
      max-width: 280px;
    }
    
    /* Barra de acciones */
    .actions-bar {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      align-items: center;
    }
    
    .charts-count {
      color: var(--text-secondary);
    }
    
    /* Estado vacío de gráficos */
    .charts-empty-state {
      text-align: center;
      padding: 3rem 1rem;
    }
    
    .charts-empty-state mat-icon {
      font-size: 64px;
      width: 64px;
      height: 64px;
      color: var(--text-tertiary);
      opacity: 0.5;
    }
    
    .charts-empty-state h3 {
      font-size: 1.25rem;
      color: var(--text-secondary);
      margin-top: 1rem;
    }
    
    .charts-empty-state p {
      color: var(--text-tertiary);
    }
  `]
})
export class DatasetViewComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly datasetService = inject(DatasetService);
  private readonly dashboardService = inject(DashboardService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly chartTheme = inject(ChartThemeService);
  readonly themeService = inject(ThemeService);

  // Tipos de gráficos disponibles - organizados por complejidad
  readonly chartTypes: ChartType[] = [
    // === UNIVARIABLES ===
    { id: 'bar', name: 'Barras Verticales', icon: 'bar_chart', description: 'Comparar frecuencias por categoría', forTypes: ['CATEGORICO', 'TEXTO'] },
    { id: 'pie', name: 'Pastel (Torta)', icon: 'pie_chart', description: 'Mostrar proporciones del total', forTypes: ['CATEGORICO'] },
    { id: 'donut', name: 'Anillo (Donut)', icon: 'donut_large', description: 'Proporciones con total central', forTypes: ['CATEGORICO'] },
    { id: 'histogram', name: 'Histograma', icon: 'equalizer', description: 'Distribución de valores numéricos', forTypes: ['NUMERICO'] },
    { id: 'line', name: 'Líneas', icon: 'show_chart', description: 'Tendencias y evolución temporal', forTypes: ['FECHA', 'NUMERICO', 'CATEGORICO'] },
    { id: 'area', name: 'Área', icon: 'area_chart', description: 'Tendencias con área sombreada', forTypes: ['FECHA', 'NUMERICO', 'CATEGORICO'] },
    { id: 'funnel', name: 'Embudo', icon: 'filter_list', description: 'Procesos secuenciales', forTypes: ['CATEGORICO'] },
    { id: 'treemap', name: 'Treemap', icon: 'grid_view', description: 'Jerarquía por tamaño', forTypes: ['CATEGORICO'] },
    { id: 'gauge', name: 'Indicador', icon: 'speed', description: 'Medidor de progreso', forTypes: ['NUMERICO'] },
    { id: 'radar', name: 'Radar', icon: 'radar', description: 'Comparar múltiples categorías', forTypes: ['CATEGORICO'] },
    // === BIVARIABLES ===
    { id: 'scatter', name: 'Dispersión (Scatter)', icon: 'scatter_plot', description: 'Correlación entre 2 numéricas', forTypes: ['NUMERICO'], bivariable: true },
    { id: 'grouped_bar', name: 'Barras Agrupadas', icon: 'stacked_bar_chart', description: 'Comparar promedios por categoría', forTypes: ['CATEGORICO', 'NUMERICO', 'TEXTO'], bivariable: true },
    { id: 'heatmap', name: 'Mapa de Calor', icon: 'grid_on', description: 'Matriz de frecuencias cruzadas', forTypes: ['CATEGORICO', 'TEXTO'], bivariable: true },
    { id: 'box_compare', name: 'Comparar Promedios', icon: 'leaderboard', description: 'Promedio numérico por categoría', forTypes: ['CATEGORICO', 'NUMERICO', 'TEXTO'], bivariable: true },
    { id: 'line_time', name: 'Serie Temporal', icon: 'timeline', description: 'Evolución de valores en el tiempo', forTypes: ['FECHA', 'NUMERICO'], bivariable: true },
    { id: 'stacked_bar', name: 'Barras Apiladas', icon: 'stacked_bar_chart', description: 'Evolución de categorías en el tiempo', forTypes: ['FECHA', 'CATEGORICO'], bivariable: true },
  ];

  // Estado
  loading = signal(true);
  datasetId = signal<string>('');
  departamentoId = signal<string>('');
  datasetInfo = signal<{ id: string; nombre: string; total_registros: number } | null>(null);
  variables = signal<VariableMetadato[]>([]);
  tableData = signal<{ id: number; data: Record<string, any> }[]>([]);
  pagination = signal({ current_page: 1, last_page: 1, per_page: 50, total: 0 });

  // Gráficos
  selectedChartType = signal<ChartType | null>(null);
  selectedVariableX: VariableMetadato | null = null;
  selectedVariableY: VariableMetadato | null = null;
  chartLimit: number | null = 20;
  activeCharts = signal<ActiveChart[]>([]);
  addingChart = signal(false);

  // Computed - generamos identificadores únicos para evitar duplicados en mat-table
  visibleColumns = computed<ColumnWithUniqueId[]>(() => {
    const vars = this.variables();
    // Si no hay variables visibles, mostrar todas
    const visible = vars.filter(v => v.es_visible);
    const columns = visible.length > 0 ? visible : vars;
    
    // Generar nombres únicos para columnas duplicadas usando índice
    return columns.map((col, index) => ({
      ...col,
      _uniqueId: `col_${index}_${col.nombre_columna}`
    }));
  });
  columnNames = computed(() => this.visibleColumns().map(v => v._uniqueId));
  // Todas las variables visibles son analizables (TEXTO se trata como CATEGORICO en el backend)
  analysableVariables = computed(() => this.variables().filter(v => v.es_visible));

  // Computed: Variables compatibles con el tipo de gráfico seleccionado (Variable X)
  compatibleVariablesX = computed(() => {
    const chartType = this.selectedChartType();
    const vars = this.analysableVariables();
    
    if (!chartType) return vars;

    // Filtrar según el tipo de gráfico
    return vars.filter(v => {
      switch (chartType.id) {
        // Solo numéricas
        case 'scatter':
        case 'histogram':
        case 'gauge':
          return v.tipo_dato === 'NUMERICO';
        // Solo categóricas (TEXTO se permite porque backend lo trata como categórico)
        case 'pie':
        case 'donut':
        case 'funnel':
        case 'treemap':
        case 'radar':
          return v.tipo_dato === 'CATEGORICO' || v.tipo_dato === 'TEXTO';
        // Categóricas y texto
        case 'bar':
        case 'heatmap':
        case 'stacked_bar':
          return v.tipo_dato === 'CATEGORICO' || v.tipo_dato === 'TEXTO';
        // Categóricas y numéricas
        case 'grouped_bar':
        case 'box_compare':
          return v.tipo_dato === 'CATEGORICO' || v.tipo_dato === 'NUMERICO' || v.tipo_dato === 'TEXTO';
        // Fechas y numéricas
        case 'line_time':
          return v.tipo_dato === 'FECHA' || v.tipo_dato === 'NUMERICO';
        // Líneas y áreas aceptan varios tipos
        case 'line':
        case 'area':
          return v.tipo_dato === 'FECHA' || v.tipo_dato === 'NUMERICO' || v.tipo_dato === 'CATEGORICO';
        default:
          return true;
      }
    });
  });

  // Computed: Variables compatibles para Y (solo bivariables)
  compatibleVariablesY = computed(() => {
    const chartType = this.selectedChartType();
    const vars = this.analysableVariables();
    
    if (!chartType?.bivariable) return [];

    const selectedX = this.selectedVariableX;
    // Normalizar tipo: TEXTO se trata como CATEGORICO
    const tipoX = selectedX?.tipo_dato === 'TEXTO' ? 'CATEGORICO' : selectedX?.tipo_dato;

    return vars.filter(v => {
      // No permitir la misma variable
      if (selectedX && v.id === selectedX.id) return false;
      
      // Normalizar tipo Y
      const tipoY = v.tipo_dato === 'TEXTO' ? 'CATEGORICO' : v.tipo_dato;

      switch (chartType.id) {
        case 'scatter':
          // Scatter: ambas deben ser numéricas
          return v.tipo_dato === 'NUMERICO';
          
        case 'heatmap':
          // Heatmap: ambas deben ser categóricas (TEXTO cuenta como categórica)
          return v.tipo_dato === 'CATEGORICO' || v.tipo_dato === 'TEXTO';
          
        case 'stacked_bar':
          // Barras apiladas: ambas categóricas O fecha + categórica
          if (tipoX === 'FECHA') return tipoY === 'CATEGORICO';
          if (tipoX === 'CATEGORICO') return tipoY === 'FECHA' || tipoY === 'CATEGORICO';
          return tipoY === 'CATEGORICO';
          
        case 'grouped_bar':
        case 'box_compare':
          // Barras agrupadas: categórica + numérica (cualquier orden)
          // O texto + numérica
          if (tipoX === 'CATEGORICO') {
            return v.tipo_dato === 'NUMERICO';
          }
          if (tipoX === 'NUMERICO') {
            return v.tipo_dato === 'CATEGORICO' || v.tipo_dato === 'TEXTO';
          }
          return v.tipo_dato === 'NUMERICO' || v.tipo_dato === 'CATEGORICO';
          
        case 'line_time':
          // Serie temporal: fecha + numérica
          if (selectedX?.tipo_dato === 'FECHA') {
            return v.tipo_dato === 'NUMERICO';
          }
          if (selectedX?.tipo_dato === 'NUMERICO') {
            return v.tipo_dato === 'FECHA';
          }
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
          return 'Este gráfico requiere variables numéricas. No hay variables numéricas disponibles.';
        case 'pie':
        case 'donut':
        case 'funnel':
        case 'treemap':
        case 'radar':
          return 'Este gráfico requiere variables categóricas. No hay variables categóricas disponibles.';
        case 'heatmap':
        case 'bar':
        case 'stacked_bar':
          return 'Este gráfico requiere variables categóricas o de texto.';
        case 'line_time':
          return 'Serie temporal requiere una variable de fecha y una numérica.';
        default:
          return 'No hay variables compatibles con este tipo de gráfico.';
      }
    }

    if (chartType.bivariable && this.selectedVariableX && this.compatibleVariablesY().length === 0) {
      const tipoX = this.selectedVariableX.tipo_dato;
      switch (chartType.id) {
        case 'scatter':
          return 'Dispersión requiere dos variables numéricas. Selecciona otra variable numérica.';
        case 'heatmap':
          return 'Mapa de calor requiere dos variables categóricas o de texto.';
        case 'grouped_bar':
        case 'box_compare':
          if (tipoX === 'NUMERICO') return 'Selecciona una variable categórica o de texto para comparar.';
          return 'Selecciona una variable numérica para mostrar promedios.';
        case 'line_time':
          if (tipoX === 'FECHA') return 'Selecciona una variable numérica para ver su evolución.';
          if (tipoX === 'NUMERICO') return 'Selecciona una variable de fecha para el eje temporal.';
          return 'Selecciona una fecha y una numérica.';
        case 'stacked_bar':
          if (tipoX === 'FECHA') return 'Selecciona una variable categórica para las series.';
          return 'Selecciona una variable de fecha o categórica.';
        default:
          return 'No hay variables compatibles para la variable Y.';
      }
    }

    return null;
  }

  // Colores y gradientes dinámicos basados en el tema
  get colors(): string[] {
    return this.chartTheme.getColors();
  }
  
  get gradients() {
    return this.chartTheme.getGradients();
  }

  // Obtener configuración de tema para gráficos
  get chartConfig() {
    return this.chartTheme.config();
  }

  ngOnInit(): void {
    this.datasetId.set(this.route.snapshot.params['id']);
    this.loadData();
  }

  loadData(page: number = 1): void {
    this.loading.set(true);
    this.dashboardService.getDatasetData(this.datasetId(), page).subscribe({
      next: (res) => {
        this.datasetInfo.set(res.dataset);
        this.variables.set(res.variables || []);
        this.tableData.set(res.data || []);
        this.pagination.set(res.pagination);
        
        // El departamento_id puede venir en la respuesta o necesitamos obtenerlo
        if (res.dataset.departamento_id) {
          this.departamentoId.set(res.dataset.departamento_id);
          this.loading.set(false);
        } else {
          this.datasetService.getById(this.datasetId()).subscribe({
            next: (dsRes) => {
              if (dsRes && dsRes.departamento_id) {
                this.departamentoId.set(dsRes.departamento_id);
              }
              this.loading.set(false);
            },
            error: () => this.loading.set(false)
          });
        }
      },
      error: () => this.loading.set(false)
    });
  }

  onPageChange(event: PageEvent): void {
    this.loadData(event.pageIndex + 1);
  }

  selectChartType(type: ChartType): void {
    this.selectedChartType.set(type);
    // Reset variables si cambia de bivariable a univariable
    if (!type.bivariable) {
      this.selectedVariableY = null;
    }
    // Reset variable X si no es compatible con el nuevo tipo
    if (this.selectedVariableX) {
      const compatible = this.compatibleVariablesX().find(v => v.id === this.selectedVariableX?.id);
      if (!compatible) {
        this.selectedVariableX = null;
      }
    }
  }

  onVariableXChange(): void {
    // Reset variable Y cuando cambia X para evitar combinaciones inválidas
    this.selectedVariableY = null;
  }

  getVariableHint(axis: 'x' | 'y'): string {
    const chartType = this.selectedChartType();
    if (!chartType) return '';
    
    const compatibleCount = axis === 'x' ? this.compatibleVariablesX().length : this.compatibleVariablesY().length;
    const countHint = compatibleCount > 0 ? ` (${compatibleCount} disponibles)` : '';

    if (axis === 'x') {
      switch (chartType.id) {
        case 'scatter': 
        case 'histogram': 
        case 'gauge': 
          return `Variable numérica${countHint}`;
        case 'pie':
        case 'donut':
        case 'funnel':
        case 'treemap':
        case 'radar':
          return `Variable categórica${countHint}`;
        case 'heatmap':
        case 'stacked_bar':
        case 'bar':
          return `Variable categórica o texto${countHint}`;
        case 'grouped_bar':
        case 'box_compare':
          return `Categórica, texto o numérica${countHint}`;
        case 'line_time': 
          return `Fecha o numérica${countHint}`;
        case 'line':
        case 'area':
          return `Fecha, numérica o categórica${countHint}`;
        default: 
          return compatibleCount > 0 ? `${compatibleCount} variables compatibles` : '';
      }
    } else {
      const tipoX = this.selectedVariableX?.tipo_dato;
      switch (chartType.id) {
        case 'scatter': 
          return `Otra variable numérica${countHint}`;
        case 'heatmap': 
          return `Otra variable categórica o texto${countHint}`;
        case 'grouped_bar':
        case 'box_compare': 
          if (tipoX === 'CATEGORICO' || tipoX === 'TEXTO') return `Variable numérica${countHint}`;
          if (tipoX === 'NUMERICO') return `Variable categórica o texto${countHint}`;
          return countHint || '';
        case 'line_time':
          if (tipoX === 'FECHA') return `Variable numérica${countHint}`;
          if (tipoX === 'NUMERICO') return `Variable de fecha${countHint}`;
          return `Fecha o numérica${countHint}`;
        case 'stacked_bar':
          if (tipoX === 'FECHA') return `Variable categórica${countHint}`;
          if (tipoX === 'CATEGORICO') return `Fecha o categórica${countHint}`;
          return countHint || '';
        default: 
          return compatibleCount > 0 ? `${compatibleCount} variables compatibles` : '';
      }
    }
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
      loading: true,
      filters: { limit: this.chartLimit || undefined }
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
    this.dashboardService.getUnivariableStats({
      dataset_id: this.datasetId(),
      variable_id: chart.variableX.id,
      chart_type: chart.chartType.id,
      limit: chart.filters?.limit
    }).subscribe({
      next: (res) => {
        const chartData: ChartData = {
          variable: res.nombre_variable,
          tipo: chart.variableX.tipo_dato === 'NUMERICO' ? 'numeric' : 
                chart.variableX.tipo_dato === 'FECHA' ? 'date' : 'categorical',
          chart_type: res.chart_type as any,
          data: {
            labels: res.data?.labels || [],
            values: res.data?.values || []
          },
          stats: res.stats
        };
        
        // Verificar que hay datos
        if (!chartData.data.labels?.length && !chartData.data.values?.length) {
          this.updateChartError(chart.id, 'No hay datos disponibles para esta variable');
        } else {
          this.updateChartData(chart.id, chartData);
        }
      },
      error: (err) => this.updateChartError(chart.id, this.getChartErrorMessage(err))
    });
  }

  private loadBivariableData(chart: ActiveChart): void {
    if (!chart.variableY) return;

    this.dashboardService.getBivariableStats({
      dataset_id: this.datasetId(),
      variable_x_id: chart.variableX.id,
      variable_y_id: chart.variableY.id,
      chart_type: chart.chartType.id,
      limit: chart.filters?.limit
    }).subscribe({
      next: (res) => {
        // Verificar que hay datos
        if (!res.data || (
          !res.data.points?.length && 
          !res.data.series?.length && 
          !res.data.heatmap?.length &&
          !res.data.values?.length
        )) {
          this.updateChartError(chart.id, 'No hay datos suficientes para correlacionar estas variables');
        } else {
          this.updateChartData(chart.id, res);
        }
      },
      error: (err) => this.updateChartError(chart.id, this.getChartErrorMessage(err))
    });
  }

  private updateChartData(chartId: string, data: ChartData | BivariableResponse | null): void {
    this.activeCharts.update(charts => 
      charts.map(c => c.id === chartId ? { ...c, data, loading: false, error: null } : c)
    );
    this.addingChart.set(false);
  }

  private updateChartError(chartId: string, error: string): void {
    this.activeCharts.update(charts =>
      charts.map(c => c.id === chartId ? { ...c, data: null, loading: false, error } : c)
    );
    this.addingChart.set(false);
  }

  private getChartErrorMessage(error: any): string {
    if (error.status === 400) {
      return 'Las variables seleccionadas no son compatibles para este tipo de gráfico';
    }
    if (error.status === 404) {
      return 'No se encontraron datos para las variables seleccionadas';
    }
    if (error.status === 500) {
      return 'Error del servidor al procesar los datos';
    }
    if (error.status === 0) {
      return 'Error de conexión. Verifica tu conexión a internet';
    }
    return error.error?.message || 'Error desconocido al cargar el gráfico';
  }

  removeChart(chartId: string): void {
    this.activeCharts.update(charts => charts.filter(c => c.id !== chartId));
  }

  retryChart(chart: ActiveChart): void {
    // Marcar como cargando
    this.activeCharts.update(charts =>
      charts.map(c => c.id === chart.id ? { ...c, loading: true, error: null } : c)
    );
    
    // Reintentar carga
    if (chart.chartType.bivariable && chart.variableY) {
      this.loadBivariableData(chart);
    } else {
      this.loadUnivariableData(chart);
    }
  }

  clearAllCharts(): void {
    this.activeCharts.set([]);
  }

  addAllUnivariate(): void {
    const variables = this.analysableVariables();
    this.addingChart.set(true);

    variables.forEach((variable, index) => {
      setTimeout(() => {
        const type = this.getDefaultChartType(variable.tipo_dato);
        if (!type) return;

        const chartId = `chart-auto-${Date.now()}-${index}`;
        const newChart: ActiveChart = {
          id: chartId,
          title: variable.nombre_original,
          chartType: type,
          variableX: variable,
          data: null,
          loading: true
        };

        this.activeCharts.update(charts => [...charts, newChart]);
        this.loadUnivariableData(newChart);
      }, index * 100); // Pequeño delay para no saturar
    });
  }

  private getDefaultChartType(tipoDato: string): ChartType | undefined {
    switch (tipoDato) {
      case 'CATEGORICO': return this.chartTypes.find(t => t.id === 'bar');
      case 'NUMERICO': return this.chartTypes.find(t => t.id === 'histogram');
      case 'FECHA': return this.chartTypes.find(t => t.id === 'line');
      default: return undefined;
    }
  }

  updateVariable(variable: VariableMetadato): void {
    this.dashboardService.updateVariable(variable.id, {
      tipo_dato: variable.tipo_dato,
      es_visible: variable.es_visible
    }).subscribe({
      next: () => this.snackBar.open('Variable actualizada', 'OK', { duration: 2000 }),
      error: () => this.snackBar.open('Error al actualizar', 'OK', { duration: 2000 })
    });
  }

  getChartStats(chart: ActiveChart): any {
    if (!chart.data) return null;
    
    // Para datos bivariables
    if ('variable_x_id' in chart.data || 'nombre_variable_x' in chart.data) {
      const biData = chart.data as BivariableResponse;
      return {
        correlation: biData.data?.correlation || biData.stats?.correlation,
        count: biData.data?.stats?.count || biData.stats?.count
      };
    }
    
    // Para datos univariables
    const data = chart.data as ChartData;
    return data.stats;
  }

  getChartOptions(chart: ActiveChart): EChartsOption {
    if (!chart.data) return {};

    const type = chart.chartType.id;

    // Datos bivariables (tienen variable_x_id o nombre_variable_x)
    if ('variable_x_id' in chart.data || 'nombre_variable_x' in chart.data) {
      return this.getBivariableChartOptions(chart.data as BivariableResponse, type);
    }

    // Datos univariables
    const data = chart.data as ChartData;
    return this.getUnivariableChartOptions(data, type);
  }

  private getUnivariableChartOptions(data: ChartData, type: string): EChartsOption {
    const labels = data.data?.labels || [];
    const values = data.data?.values || [];
    const variableName = data.variable || 'Variable';
    const total = values.reduce((a, b) => a + b, 0);
    const maxValue = Math.max(...values, 1);
    
    // Obtener configuración de tema
    const cfg = this.chartConfig;
    const colors = this.colors;

    // Estilos comunes mejorados con tema dinámico
    const titleStyle = { 
      text: variableName, 
      left: 'center', 
      top: 10, 
      textStyle: { 
        fontSize: 16, 
        fontWeight: 'bold' as const,
        color: cfg.textColor
      },
      subtextStyle: { fontSize: 12, color: cfg.textColorSecondary }
    };

    const tooltipStyle = {
      backgroundColor: cfg.tooltipBg,
      borderColor: cfg.tooltipBorder,
      borderWidth: 1,
      textStyle: { color: cfg.textColor },
      extraCssText: 'box-shadow: 0 4px 12px rgba(0,0,0,0.15); border-radius: 8px;'
    };

    switch (type) {
      case 'bar':
        return {
          title: { ...titleStyle, subtext: `Total: ${total.toLocaleString()} registros` },
          tooltip: { 
            ...tooltipStyle,
            trigger: 'axis' as const,
            axisPointer: { type: 'shadow' as const, shadowStyle: { color: 'rgba(99, 102, 241, 0.1)' } },
            formatter: (params: any) => {
              const p = Array.isArray(params) ? params[0] : params;
              const percent = total > 0 ? ((p.value / total) * 100).toFixed(1) : 0;
              return `<div style="font-weight:600;margin-bottom:8px;color:${colors[0]}">${variableName}</div>` +
                     `<div style="display:flex;align-items:center;gap:8px;">` +
                     `<span style="width:12px;height:12px;background:${p.color};border-radius:3px;"></span>` +
                     `<span>${p.name}</span></div>` +
                     `<div style="font-size:18px;font-weight:700;margin-top:4px;">${p.value.toLocaleString()}</div>` +
                     `<div style="color:${cfg.textColorSecondary};font-size:12px;">${percent}% del total</div>`;
            }
          },
          legend: { show: false },
          xAxis: { 
            type: 'category' as const, 
            data: labels, 
            axisLabel: { rotate: labels.length > 6 ? 45 : 0, interval: 0, color: cfg.textColorSecondary, fontSize: 11 },
            axisLine: { lineStyle: { color: cfg.axisLineColor } },
            axisTick: { show: false }
          },
          yAxis: { 
            type: 'value' as const, 
            name: 'Cantidad',
            nameTextStyle: { color: cfg.textColorSecondary, padding: [0, 0, 0, 40] },
            axisLine: { show: false },
            axisTick: { show: false },
            splitLine: { lineStyle: { color: cfg.splitLineColor, type: 'dashed' as const } }
          },
          series: [{ 
            type: 'bar' as const, 
            name: variableName,
            data: values.map((v, i) => ({ 
              value: v, 
              name: labels[i],
              itemStyle: { 
                color: {
                  type: 'linear' as const, x: 0, y: 0, x2: 0, y2: 1,
                  colorStops: [
                    { offset: 0, color: colors[i % colors.length] },
                    { offset: 1, color: this.adjustColor(colors[i % colors.length], -30) }
                  ]
                },
                borderRadius: [6, 6, 0, 0]
              }
            })),
            barWidth: '60%',
            label: { 
              show: values.length <= 12, 
              position: 'top' as const, 
              formatter: '{c}',
              color: cfg.textColor,
              fontWeight: 'bold' as const
            },
            emphasis: {
              itemStyle: { shadowBlur: 20, shadowColor: 'rgba(0,0,0,0.2)' }
            },
            animationDelay: (idx: number) => idx * 50
          }],
          grid: { bottom: labels.length > 6 ? 100 : 60, left: 70, right: 30, top: 80 },
          animationEasing: 'elasticOut' as const
        };

      case 'pie':
        return {
          title: { ...titleStyle, subtext: `${labels.length} categorías | ${total.toLocaleString()} registros` },
          tooltip: { 
            ...tooltipStyle,
            trigger: 'item' as const,
            formatter: (params: any) => {
              return `<div style="font-weight:600;margin-bottom:8px;color:${colors[0]}">${variableName}</div>` +
                     `<div style="display:flex;align-items:center;gap:8px;">` +
                     `<span style="width:14px;height:14px;background:${params.color};border-radius:50%;"></span>` +
                     `<span style="font-weight:500">${params.name}</span></div>` +
                     `<div style="font-size:22px;font-weight:700;margin:8px 0;">${params.value.toLocaleString()}</div>` +
                     `<div style="background:${cfg.splitLineColor};padding:4px 8px;border-radius:4px;font-weight:600;color:${colors[0]};">` +
                     `${params.percent}% del total</div>`;
            }
          },
          legend: { 
            orient: 'vertical' as const, 
            right: 20, 
            top: 'middle' as const,
            type: 'scroll' as const,
            textStyle: { color: cfg.textColorSecondary },
            formatter: (name: string) => {
              const idx = labels.indexOf(name);
              const val = idx >= 0 ? values[idx] : 0;
              const pct = total > 0 ? ((val / total) * 100).toFixed(1) : 0;
              return name.length > 15 ? `${name.substring(0, 15)}... (${pct}%)` : `${name} (${pct}%)`;
            }
          },
          series: [{
            type: 'pie' as const,
            radius: ['0%', '70%'],
            center: ['35%', '55%'],
            roseType: 'radius' as const,
            data: labels.map((l, i) => ({ 
              name: l, 
              value: values[i], 
              itemStyle: { 
                color: colors[i % colors.length],
                borderColor: cfg.tooltipBg,
                borderWidth: 2
              }
            })),
            label: { 
              show: labels.length <= 8, 
              formatter: '{b}\n{d}%',
              fontSize: 11,
              color: cfg.textColor
            },
            labelLine: { length: 15, length2: 10 },
            emphasis: {
              label: { show: true, fontSize: 14, fontWeight: 'bold' as const },
              itemStyle: { shadowBlur: 20, shadowColor: 'rgba(0,0,0,0.3)' },
              scaleSize: 10
            },
            animationType: 'scale' as const,
            animationEasing: 'elasticOut' as const
          }]
        };

      case 'donut':
        return {
          title: { ...titleStyle },
          tooltip: { 
            ...tooltipStyle,
            trigger: 'item' as const,
            formatter: (params: any) => {
              return `<div style="font-weight:600;margin-bottom:8px;color:#EC4899">${variableName}</div>` +
                     `<div style="display:flex;align-items:center;gap:8px;">` +
                     `<span style="width:14px;height:14px;background:${params.color};border-radius:50%;"></span>` +
                     `<span style="font-weight:500">${params.name}</span></div>` +
                     `<div style="font-size:22px;font-weight:700;margin:8px 0;">${params.value.toLocaleString()}</div>` +
                     `<div style="background:#FDF2F8;padding:4px 8px;border-radius:4px;font-weight:600;color:#EC4899;">` +
                     `${params.percent}%</div>`;
            }
          },
          legend: { 
            orient: 'vertical' as const, 
            right: 20, 
            top: 'middle' as const,
            type: 'scroll' as const,
            textStyle: { color: '#4B5563' }
          },
          graphic: [
            { type: 'text' as const, left: '28%', top: '42%', style: { text: total.toLocaleString(), fontSize: 28, fontWeight: 'bold' as const, fill: '#1F2937' } },
            { type: 'text' as const, left: '28%', top: '52%', style: { text: 'Total', fontSize: 14, fill: '#6B7280' } }
          ],
          series: [{
            type: 'pie' as const,
            radius: ['50%', '75%'],
            center: ['32%', '50%'],
            avoidLabelOverlap: true,
            itemStyle: { borderRadius: 8, borderColor: '#fff', borderWidth: 3 },
            data: labels.map((l, i) => ({ 
              name: l, 
              value: values[i], 
              itemStyle: { color: this.colors[i % this.colors.length] }
            })),
            label: { show: labels.length <= 6, formatter: '{b}: {d}%', fontSize: 11 },
            emphasis: {
              label: { show: true, fontSize: 14, fontWeight: 'bold' as const },
              itemStyle: { shadowBlur: 20, shadowColor: 'rgba(0,0,0,0.2)' }
            },
            animationType: 'scale' as const,
            animationEasing: 'elasticOut' as const
          }]
        };

      case 'histogram':
        return {
          title: { ...titleStyle, text: `Distribución de ${variableName}`, subtext: `${values.length} rangos | ${total.toLocaleString()} registros` },
          tooltip: { 
            ...tooltipStyle,
            trigger: 'axis' as const,
            axisPointer: { type: 'shadow' as const },
            formatter: (params: any) => {
              const p = Array.isArray(params) ? params[0] : params;
              const percent = total > 0 ? ((p.value / total) * 100).toFixed(1) : 0;
              return `<div style="font-weight:600;margin-bottom:8px;color:#14B8A6">${variableName}</div>` +
                     `<div style="color:#6B7280;font-size:12px;">Rango</div>` +
                     `<div style="font-weight:500;margin-bottom:8px;">${p.name}</div>` +
                     `<div style="font-size:20px;font-weight:700;">${p.value.toLocaleString()}</div>` +
                     `<div style="color:#6B7280;font-size:12px;">${percent}% de los datos</div>`;
            }
          },
          xAxis: { 
            type: 'category' as const, 
            data: labels, 
            axisLabel: { rotate: 45, color: '#4B5563', fontSize: 10 },
            axisLine: { lineStyle: { color: '#E5E7EB' } },
            axisTick: { show: false }
          },
          yAxis: { 
            type: 'value' as const, 
            name: 'Frecuencia',
            nameTextStyle: { color: '#6B7280' },
            axisLine: { show: false },
            splitLine: { lineStyle: { color: '#F3F4F6', type: 'dashed' as const } }
          },
          series: [{ 
            type: 'bar' as const, 
            name: 'Frecuencia',
            data: values, 
            barWidth: '85%',
            itemStyle: { 
              color: { 
                type: 'linear' as const, x: 0, y: 0, x2: 0, y2: 1, 
                colorStops: [{ offset: 0, color: '#14B8A6' }, { offset: 1, color: '#0D9488' }] 
              },
              borderRadius: [4, 4, 0, 0]
            },
            emphasis: { itemStyle: { color: '#0F766E' } },
            label: { show: values.length <= 15, position: 'top' as const, formatter: '{c}', fontSize: 10, color: '#374151' }
          }],
          grid: { bottom: 90, left: 70, right: 30, top: 80 },
          dataZoom: [{ type: 'inside' as const, start: 0, end: 100 }]
        };

      case 'line':
      case 'area':
        const isArea = type === 'area';
        return {
          title: { ...titleStyle, text: `Tendencia de ${variableName}`, subtext: `${labels.length} puntos de datos` },
          tooltip: { 
            ...tooltipStyle,
            trigger: 'axis' as const,
            formatter: (params: any) => {
              const p = Array.isArray(params) ? params[0] : params;
              return `<div style="font-weight:600;margin-bottom:8px;color:#F59E0B">${variableName}</div>` +
                     `<div style="color:#6B7280;font-size:12px;">${p.name}</div>` +
                     `<div style="font-size:24px;font-weight:700;color:#1F2937;">${p.value.toLocaleString()}</div>`;
            }
          },
          xAxis: { 
            type: 'category' as const, 
            data: labels,
            boundaryGap: false,
            axisLabel: { rotate: labels.length > 10 ? 45 : 0, color: '#4B5563', fontSize: 11 },
            axisLine: { lineStyle: { color: '#E5E7EB' } },
            axisTick: { show: false }
          },
          yAxis: { 
            type: 'value' as const,
            axisLine: { show: false },
            splitLine: { lineStyle: { color: '#F3F4F6', type: 'dashed' as const } }
          },
          series: [{
            type: 'line' as const,
            name: variableName,
            data: values,
            smooth: true,
            symbol: 'circle',
            symbolSize: values.length <= 20 ? 10 : 6,
            lineStyle: { 
              color: '#F59E0B', 
              width: 4,
              shadowColor: 'rgba(245, 158, 11, 0.3)',
              shadowBlur: 10,
              shadowOffsetY: 8
            },
            itemStyle: { 
              color: '#F59E0B',
              borderColor: '#fff',
              borderWidth: 2
            },
            areaStyle: isArea ? { 
              color: { 
                type: 'linear' as const, x: 0, y: 0, x2: 0, y2: 1, 
                colorStops: [
                  { offset: 0, color: 'rgba(245, 158, 11, 0.4)' }, 
                  { offset: 1, color: 'rgba(245, 158, 11, 0.02)' }
                ] 
              }
            } : undefined,
            emphasis: {
              itemStyle: { 
                color: '#D97706',
                borderColor: '#F59E0B',
                borderWidth: 3,
                shadowBlur: 15,
                shadowColor: 'rgba(245, 158, 11, 0.5)'
              }
            },
            label: { show: values.length <= 10, position: 'top' as const, formatter: '{c}', fontWeight: 'bold' as const }
          }],
          grid: { bottom: labels.length > 10 ? 90 : 50, left: 60, right: 30, top: 80 },
          dataZoom: [{ type: 'inside' as const }, { type: 'slider' as const, show: labels.length > 15, bottom: 10, height: 20 }]
        };

      case 'funnel':
        return {
          title: { ...titleStyle, subtext: `${labels.length} etapas` },
          tooltip: { 
            ...tooltipStyle,
            trigger: 'item' as const,
            formatter: (params: any) => {
              const pct = total > 0 ? ((params.value / total) * 100).toFixed(1) : 0;
              return `<div style="font-weight:600;margin-bottom:8px;color:${colors[params.dataIndex % colors.length]}">${variableName}</div>` +
                     `<div style="font-weight:500">${params.name}</div>` +
                     `<div style="font-size:20px;font-weight:700;margin:8px 0;">${params.value.toLocaleString()}</div>` +
                     `<div style="color:${cfg.textColorSecondary}">${pct}% del total</div>`;
            }
          },
          legend: { bottom: 10, textStyle: { color: cfg.textColorSecondary } },
          series: [{
            type: 'funnel' as const,
            left: '10%',
            top: 60,
            bottom: 50,
            width: '80%',
            min: 0,
            max: maxValue,
            minSize: '20%',
            maxSize: '100%',
            sort: 'descending' as const,
            gap: 2,
            label: { show: true, position: 'inside' as const, formatter: '{b}', fontSize: 12 },
            labelLine: { length: 10 },
            itemStyle: { borderColor: cfg.tooltipBg, borderWidth: 2 },
            emphasis: { 
              label: { fontSize: 14, fontWeight: 'bold' as const },
              itemStyle: { shadowBlur: 20, shadowColor: 'rgba(0,0,0,0.2)' }
            },
            data: labels.map((l, i) => ({ 
              name: l, 
              value: values[i], 
              itemStyle: { color: colors[i % colors.length] }
            })).sort((a, b) => b.value - a.value)
          }]
        };

      case 'treemap':
        return {
          title: { ...titleStyle, subtext: `${labels.length} categorías | ${total.toLocaleString()} total` },
          tooltip: { 
            ...tooltipStyle,
            formatter: (params: any) => {
              const pct = total > 0 ? ((params.value / total) * 100).toFixed(1) : 0;
              return `<div style="font-weight:600;margin-bottom:8px;color:${params.color}">${variableName}</div>` +
                     `<div style="font-weight:500">${params.name}</div>` +
                     `<div style="font-size:18px;font-weight:700;margin:8px 0;">${params.value.toLocaleString()}</div>` +
                     `<div style="color:${cfg.textColorSecondary}">${pct}% del total</div>`;
            }
          },
          series: [{
            type: 'treemap' as const,
            top: 60,
            bottom: 30,
            left: 20,
            right: 20,
            roam: false,
            nodeClick: false,
            breadcrumb: { show: false },
            label: {
              show: true,
              formatter: '{b}',
              fontSize: 12,
              color: '#fff'
            },
            itemStyle: {
              borderColor: cfg.tooltipBg,
              borderWidth: 2,
              gapWidth: 2
            },
            emphasis: {
              itemStyle: { shadowBlur: 20, shadowColor: 'rgba(0,0,0,0.3)' }
            },
            data: labels.map((l, i) => ({
              name: l,
              value: values[i],
              itemStyle: { color: colors[i % colors.length] }
            }))
          }]
        };

      case 'gauge':
        const avgValue = total / values.length;
        const gaugeMax = Math.max(...values) * 1.2;
        return {
          title: { ...titleStyle, subtext: `Promedio: ${avgValue.toFixed(1)}` },
          tooltip: { ...tooltipStyle, formatter: '{b}: {c}' },
          series: [{
            type: 'gauge' as const,
            startAngle: 180,
            endAngle: 0,
            min: 0,
            max: gaugeMax,
            splitNumber: 5,
            itemStyle: {
              color: {
                type: 'linear' as const,
                x: 0, y: 0, x2: 1, y2: 0,
                colorStops: [
                  { offset: 0, color: colors[4] },
                  { offset: 0.5, color: colors[3] },
                  { offset: 1, color: colors[2] }
                ]
              },
              shadowColor: 'rgba(0,0,0,0.3)',
              shadowBlur: 10
            },
            progress: { show: true, width: 18 },
            pointer: { 
              icon: 'path://M2090.36389,615.30999 L2## 66.4,620.09999 L2090.36389,625.0999 L2080.1,625.0999 L2080.1,615.30999 L2090.36389,615.30999 z M2090.36389,615.30999', 
              length: '75%', 
              width: 8 
            },
            axisLine: { lineStyle: { width: 18, color: [[1, cfg.splitLineColor]] } },
            axisTick: { show: false },
            splitLine: { distance: -18, length: 18, lineStyle: { color: cfg.textColorSecondary, width: 2 } },
            axisLabel: { distance: 25, color: cfg.textColorSecondary, fontSize: 11 },
            anchor: { show: true, showAbove: true, size: 20, itemStyle: { borderWidth: 8, borderColor: colors[0] } },
            title: { show: true, offsetCenter: [0, '70%'], fontSize: 14, color: cfg.textColorSecondary },
            detail: { 
              valueAnimation: true, 
              offsetCenter: [0, '40%'], 
              fontSize: 28, 
              fontWeight: 'bold' as const,
              formatter: (val: number) => val.toFixed(1),
              color: cfg.textColor
            },
            data: [{ value: avgValue, name: variableName }]
          }]
        };

      case 'radar':
        const maxRadar = Math.max(...values);
        return {
          title: { ...titleStyle, subtext: `${labels.length} dimensiones` },
          tooltip: { ...tooltipStyle },
          legend: { bottom: 10, textStyle: { color: cfg.textColorSecondary } },
          radar: {
            indicator: labels.map((l, i) => ({ name: l, max: maxRadar * 1.1 })),
            shape: 'polygon' as const,
            splitNumber: 4,
            axisName: { color: cfg.textColorSecondary, fontSize: 11 },
            splitLine: { lineStyle: { color: cfg.splitLineColor } },
            splitArea: { show: true, areaStyle: { color: ['rgba(99,102,241,0.05)', 'rgba(99,102,241,0.1)'] } },
            axisLine: { lineStyle: { color: cfg.axisLineColor } }
          },
          series: [{
            type: 'radar' as const,
            name: variableName,
            data: [{
              value: values,
              name: variableName,
              symbol: 'circle',
              symbolSize: 6,
              lineStyle: { width: 3, color: colors[0] },
              areaStyle: { 
                color: {
                  type: 'radial' as const,
                  x: 0.5, y: 0.5, r: 0.5,
                  colorStops: [
                    { offset: 0, color: `${colors[0]}40` },
                    { offset: 1, color: `${colors[0]}10` }
                  ]
                }
              },
              itemStyle: { color: colors[0], borderColor: '#fff', borderWidth: 2 }
            }],
            emphasis: { 
              lineStyle: { width: 4 },
              areaStyle: { color: `${colors[0]}50` }
            }
          }]
        };

      default:
        return {};
    }
  }

  // Función auxiliar para ajustar colores
  private adjustColor(hex: string, amount: number): string {
    const num = parseInt(hex.replace('#', ''), 16);
    const r = Math.min(255, Math.max(0, (num >> 16) + amount));
    const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00FF) + amount));
    const b = Math.min(255, Math.max(0, (num & 0x0000FF) + amount));
    return `#${(1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1)}`;
  }

  private getBivariableChartOptions(data: BivariableResponse, type: string): EChartsOption {
    const d = data.data;
    const varX = data.nombre_variable_x || data.variable_x || 'Variable X';
    const varY = data.nombre_variable_y || data.variable_y || 'Variable Y';
    const correlation = d.correlation ?? data.stats?.correlation;
    
    // Normalizar datos - el backend puede enviar categories o labels
    const categories = d.categories || d.labels || d.labels_x || [];
    const values = d.values || [];
    const counts = d.counts || [];

    // Estilos comunes
    const tooltipStyle = {
      backgroundColor: 'rgba(255, 255, 255, 0.98)',
      borderColor: '#E5E7EB',
      borderWidth: 1,
      textStyle: { color: '#1F2937' },
      extraCssText: 'box-shadow: 0 8px 24px rgba(0,0,0,0.15); border-radius: 12px; padding: 12px;'
    };

    // ========== LINE_TIME (serie temporal: fecha + numérica) ==========
    if (type === 'line_time' || (d.labels && d.values && !d.points && !d.heatmap && !d.series)) {
      const labels = d.labels || [];
      const values = d.values || [];
      const counts = d.counts || [];
      const total = values.reduce((a: number, b: number) => a + b, 0);
      const avg = values.length > 0 ? total / values.length : 0;
      
      return {
        title: { 
          text: `Evolución de ${varY} en el tiempo`,
          subtext: `${labels.length} periodos | Promedio: ${avg.toFixed(2)}`,
          left: 'center', 
          top: 10,
          textStyle: { fontSize: 16, fontWeight: 'bold' as const, color: '#1F2937' },
          subtextStyle: { fontSize: 12, color: '#6B7280' }
        },
        tooltip: { 
          ...tooltipStyle,
          trigger: 'axis' as const,
          formatter: (params: any) => {
            const p = Array.isArray(params) ? params[0] : params;
            const count = counts[p.dataIndex] || 0;
            return `<div style="font-weight:600;color:#6366F1;margin-bottom:8px;">${varX}</div>` +
                   `<div style="font-size:14px;font-weight:500;margin-bottom:10px;">${p.name}</div>` +
                   `<div style="display:grid;gap:8px;">` +
                   `<div><span style="color:#6B7280;font-size:11px;">Promedio de ${varY}</span><br/>` +
                   `<span style="font-size:24px;font-weight:700;color:#6366F1;">${p.value.toLocaleString()}</span></div>` +
                   (count > 0 ? `<div><span style="color:#6B7280;font-size:11px;">Registros en este periodo</span><br/>` +
                   `<span style="font-size:16px;font-weight:600;">${count.toLocaleString()}</span></div>` : '') +
                   `</div>`;
          }
        },
        xAxis: { 
          type: 'category' as const, 
          data: labels,
          boundaryGap: false,
          axisLabel: { rotate: labels.length > 10 ? 45 : 0, color: '#4B5563', fontSize: 11 },
          axisLine: { lineStyle: { color: '#E5E7EB' } },
          axisTick: { show: false }
        },
        yAxis: { 
          type: 'value' as const, 
          name: varY,
          nameTextStyle: { color: '#6B7280' },
          axisLine: { show: false },
          splitLine: { lineStyle: { color: '#F3F4F6', type: 'dashed' as const } }
        },
        series: [{
          type: 'line' as const,
          name: varY,
          data: values,
          smooth: true,
          symbol: 'circle',
          symbolSize: labels.length <= 20 ? 8 : 4,
          lineStyle: { 
            color: '#6366F1', 
            width: 3,
            shadowColor: 'rgba(99, 102, 241, 0.3)',
            shadowBlur: 10,
            shadowOffsetY: 5
          },
          itemStyle: { 
            color: '#6366F1',
            borderColor: '#fff',
            borderWidth: 2
          },
          areaStyle: { 
            color: { 
              type: 'linear' as const, x: 0, y: 0, x2: 0, y2: 1, 
              colorStops: [
                { offset: 0, color: 'rgba(99, 102, 241, 0.4)' }, 
                { offset: 1, color: 'rgba(99, 102, 241, 0.02)' }
              ] 
            }
          },
          emphasis: {
            itemStyle: { 
              borderColor: '#6366F1',
              borderWidth: 3,
              shadowBlur: 15,
              shadowColor: 'rgba(99, 102, 241, 0.5)'
            }
          },
          markLine: {
            silent: true,
            symbol: 'none',
            lineStyle: { color: '#EF4444', type: 'dashed' as const, width: 2 },
            data: [{ yAxis: avg, label: { formatter: `Prom: ${avg.toFixed(1)}`, position: 'end' as const, color: '#EF4444' } }]
          }
        }],
        grid: { bottom: labels.length > 10 ? 90 : 50, left: 70, right: 30, top: 80 },
        dataZoom: [
          { type: 'inside' as const }, 
          { type: 'slider' as const, show: labels.length > 15, bottom: 10, height: 20 }
        ]
      };
    }

    // ========== SCATTER (2 numéricas) ==========
    if (d.points && d.points.length > 0) {
      const correlationColor = correlation !== undefined 
        ? (Math.abs(correlation) >= 0.7 ? '#10B981' : Math.abs(correlation) >= 0.4 ? '#F59E0B' : '#EF4444')
        : '#6366F1';
      const correlationText = correlation !== undefined ? correlation.toFixed(3) : 'N/A';
      
      return {
        title: { 
          text: `Relación: ${varX} vs ${varY}`,
          subtext: `Correlación: ${correlationText} | ${d.points.length} puntos`,
          left: 'center', 
          top: 10,
          textStyle: { fontSize: 16, fontWeight: 'bold' as const, color: '#1F2937' },
          subtextStyle: { fontSize: 12, color: correlationColor }
        },
        tooltip: { 
          ...tooltipStyle,
          trigger: 'item' as const,
          formatter: (p: any) => {
            return `<div style="font-weight:600;color:#8B5CF6;margin-bottom:8px;">Punto de Datos</div>` +
                   `<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">` +
                   `<div><span style="color:#6B7280;font-size:11px;">${varX}</span><br/>` +
                   `<span style="font-size:18px;font-weight:700;">${p.value[0].toLocaleString()}</span></div>` +
                   `<div><span style="color:#6B7280;font-size:11px;">${varY}</span><br/>` +
                   `<span style="font-size:18px;font-weight:700;">${p.value[1].toLocaleString()}</span></div></div>`;
          }
        },
        xAxis: { 
          type: 'value' as const, 
          name: varX, 
          nameLocation: 'middle' as const, 
          nameGap: 35,
          nameTextStyle: { fontWeight: 'bold' as const, color: '#374151' },
          scale: true,
          axisLine: { lineStyle: { color: '#D1D5DB' } },
          splitLine: { lineStyle: { color: '#F3F4F6', type: 'dashed' as const } }
        },
        yAxis: { 
          type: 'value' as const, 
          name: varY, 
          nameLocation: 'middle' as const, 
          nameGap: 50,
          nameTextStyle: { fontWeight: 'bold' as const, color: '#374151' },
          scale: true,
          axisLine: { lineStyle: { color: '#D1D5DB' } },
          splitLine: { lineStyle: { color: '#F3F4F6', type: 'dashed' as const } }
        },
        series: [{ 
          type: 'scatter' as const, 
          name: `${varX} vs ${varY}`,
          data: d.points,
          symbolSize: (val: number[]) => Math.min(20, Math.max(8, 10)),
          itemStyle: { 
            color: {
              type: 'radial' as const,
              x: 0.5, y: 0.5, r: 0.5,
              colorStops: [
                { offset: 0, color: '#8B5CF6' },
                { offset: 0.7, color: '#7C3AED' },
                { offset: 1, color: '#6D28D9' }
              ]
            },
            opacity: 0.75,
            shadowBlur: 3,
            shadowColor: 'rgba(139, 92, 246, 0.3)'
          },
          emphasis: { 
            itemStyle: { 
              opacity: 1,
              shadowBlur: 20, 
              shadowColor: 'rgba(139, 92, 246, 0.5)',
              borderColor: '#fff',
              borderWidth: 2
            },
            scale: 1.5
          }
        }],
        grid: { bottom: 70, left: 80, right: 40, top: 90 },
        dataZoom: [
          { type: 'inside' as const, xAxisIndex: 0 }, 
          { type: 'inside' as const, yAxisIndex: 0 },
          { type: 'slider' as const, xAxisIndex: 0, bottom: 10, height: 20 }
        ]
      };
    }

    // ========== HEATMAP (2 categóricas) ==========
    if (d.heatmap && d.labels_x && d.labels_y) {
      const maxVal = Math.max(...d.heatmap.map((h: [number, number, number]) => h[2]), 1);
      const totalCells = d.heatmap.reduce((sum: number, h: [number, number, number]) => sum + h[2], 0);
      
      return {
        title: { 
          text: `Mapa de Calor: ${varX} × ${varY}`,
          subtext: `${d.labels_x.length} × ${d.labels_y.length} celdas | ${totalCells.toLocaleString()} registros`,
          left: 'center', 
          top: 10,
          textStyle: { fontSize: 16, fontWeight: 'bold' as const, color: '#1F2937' },
          subtextStyle: { fontSize: 12, color: '#6B7280' }
        },
        tooltip: { 
          ...tooltipStyle,
          position: 'top' as const,
          formatter: (p: any) => {
            const xLabel = d.labels_x![p.value[0]];
            const yLabel = d.labels_y![p.value[1]];
            const freq = p.value[2];
            const pct = totalCells > 0 ? ((freq / totalCells) * 100).toFixed(1) : 0;
            return `<div style="font-weight:600;color:#EC4899;margin-bottom:8px;">Cruce de Variables</div>` +
                   `<div style="display:grid;gap:4px;font-size:13px;">` +
                   `<div><span style="color:#6B7280">${varX}:</span> <strong>${xLabel}</strong></div>` +
                   `<div><span style="color:#6B7280">${varY}:</span> <strong>${yLabel}</strong></div>` +
                   `</div>` +
                   `<div style="margin-top:8px;padding-top:8px;border-top:1px solid #E5E7EB;">` +
                   `<div style="font-size:24px;font-weight:700;color:#EC4899;">${freq.toLocaleString()}</div>` +
                   `<div style="font-size:12px;color:#6B7280;">${pct}% del total</div></div>`;
          }
        },
        xAxis: { 
          type: 'category' as const, 
          data: d.labels_x, 
          name: varX,
          nameLocation: 'middle' as const,
          nameGap: 45,
          splitArea: { show: true },
          axisLabel: { rotate: 45, fontSize: 10, color: '#4B5563' },
          axisLine: { lineStyle: { color: '#E5E7EB' } }
        },
        yAxis: { 
          type: 'category' as const, 
          data: d.labels_y, 
          name: varY,
          splitArea: { show: true },
          axisLabel: { fontSize: 10, color: '#4B5563' },
          axisLine: { lineStyle: { color: '#E5E7EB' } }
        },
        visualMap: { 
          min: 0, 
          max: maxVal, 
          calculable: true, 
          orient: 'horizontal' as const, 
          left: 'center', 
          bottom: 10,
          itemWidth: 20,
          itemHeight: 140,
          text: ['Alto', 'Bajo'],
          textStyle: { color: '#6B7280' },
          inRange: { 
            color: ['#FDF2F8', '#FBCFE8', '#F9A8D4', '#F472B6', '#EC4899', '#DB2777', '#BE185D'] 
          }
        },
        series: [{ 
          type: 'heatmap' as const, 
          data: d.heatmap, 
          label: { 
            show: d.labels_x!.length <= 10 && d.labels_y!.length <= 10, 
            fontSize: 11,
            fontWeight: 'bold' as const,
            formatter: (p: any) => p.value[2] > 0 ? p.value[2] : ''
          },
          emphasis: {
            itemStyle: { 
              shadowBlur: 15, 
              shadowColor: 'rgba(236, 72, 153, 0.4)',
              borderColor: '#fff',
              borderWidth: 2
            }
          },
          itemStyle: { borderRadius: 4, borderColor: '#fff', borderWidth: 1 }
        }],
        grid: { bottom: 80, top: 80, left: 100, right: 30 }
      };
    }

    // ========== GROUPED/STACKED BAR (series) ==========
    if (d.series && Array.isArray(d.series) && d.labels_x) {
      const seriesNames = d.series.map((s: { name: string }) => s.name);
      const totalValues = d.series.reduce((sum: number, s: { data: number[] }) => 
        sum + s.data.reduce((a: number, b: number) => a + b, 0), 0);
      
      return {
        title: { 
          text: `${varY} por ${varX}`,
          subtext: `${seriesNames.length} grupos | ${totalValues.toLocaleString()} registros totales`,
          left: 'center', 
          top: 10,
          textStyle: { fontSize: 16, fontWeight: 'bold' as const, color: '#1F2937' },
          subtextStyle: { fontSize: 12, color: '#6B7280' }
        },
        tooltip: { 
          ...tooltipStyle,
          trigger: 'axis' as const, 
          axisPointer: { type: 'shadow' as const, shadowStyle: { color: 'rgba(99, 102, 241, 0.08)' } },
          formatter: (params: any) => {
            if (!Array.isArray(params)) return '';
            const total = params.reduce((sum: number, p: any) => sum + (p.value || 0), 0);
            let tooltip = `<div style="font-weight:600;color:#6366F1;margin-bottom:10px;font-size:14px;">${varX}: ${params[0].axisValue}</div>`;
            tooltip += `<div style="display:grid;gap:6px;">`;
            params.forEach((p: any) => {
              const pct = total > 0 ? ((p.value / total) * 100).toFixed(1) : 0;
              tooltip += `<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;">` +
                `<div style="display:flex;align-items:center;gap:6px;">` +
                `<span style="width:12px;height:12px;background:${p.color};border-radius:3px;"></span>` +
                `<span style="color:#4B5563">${p.seriesName}</span></div>` +
                `<div><strong style="font-size:14px;">${p.value.toLocaleString()}</strong> <span style="color:#9CA3AF;font-size:11px;">(${pct}%)</span></div></div>`;
            });
            tooltip += `</div>`;
            tooltip += `<div style="margin-top:10px;padding-top:8px;border-top:1px solid #E5E7EB;text-align:right;">` +
                       `<span style="color:#6B7280">Total:</span> <strong style="font-size:16px;">${total.toLocaleString()}</strong></div>`;
            return tooltip;
          }
        },
        legend: { 
          bottom: 10, 
          type: 'scroll' as const,
          textStyle: { color: '#4B5563' },
          data: seriesNames
        },
        xAxis: { 
          type: 'category' as const, 
          data: d.labels_x, 
          axisLabel: { rotate: d.labels_x.length > 6 ? 45 : 0, color: '#4B5563', fontSize: 11 },
          axisLine: { lineStyle: { color: '#E5E7EB' } },
          axisTick: { show: false }
        },
        yAxis: { 
          type: 'value' as const, 
          name: 'Cantidad',
          nameTextStyle: { color: '#6B7280' },
          axisLine: { show: false },
          splitLine: { lineStyle: { color: '#F3F4F6', type: 'dashed' as const } }
        },
        series: d.series.map((s: { name: string; data: number[] }, i: number) => ({ 
          name: s.name, 
          type: 'bar' as const, 
          data: s.data,
          barGap: '10%',
          itemStyle: { 
            color: this.colors[i % this.colors.length],
            borderRadius: [4, 4, 0, 0]
          },
          emphasis: {
            itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.2)' }
          },
          label: { 
            show: d.series!.length <= 2 && d.labels_x!.length <= 6, 
            position: 'top' as const, 
            formatter: '{c}',
            fontSize: 10,
            fontWeight: 'bold' as const
          }
        })),
        grid: { bottom: 80, left: 60, right: 30, top: 80 }
      };
    }

    // ========== BAR COMPARATIVO (categórica vs numérica - promedios) ==========
    if (categories.length > 0 && values.length > 0) {
      const total = values.reduce((a: number, b: number) => a + b, 0);
      const avg = total / values.length;
      
      return {
        title: { 
          text: `Promedio de ${varY} por ${varX}`,
          subtext: `${categories.length} categorías | Promedio general: ${avg.toFixed(2)}`,
          left: 'center', 
          top: 10,
          textStyle: { fontSize: 16, fontWeight: 'bold' as const, color: '#1F2937' },
          subtextStyle: { fontSize: 12, color: '#6B7280' }
        },
        tooltip: { 
          ...tooltipStyle,
          trigger: 'axis' as const,
          axisPointer: { type: 'shadow' as const },
          formatter: (params: any) => {
            const p = Array.isArray(params) ? params[0] : params;
            const count = counts[p.dataIndex] || 0;
            const diff = avg > 0 ? (((p.value - avg) / avg) * 100).toFixed(1) : 0;
            const diffColor = p.value >= avg ? '#10B981' : '#EF4444';
            const diffSign = p.value >= avg ? '+' : '';
            return `<div style="font-weight:600;color:#14B8A6;margin-bottom:8px;">${varX}</div>` +
                   `<div style="font-size:14px;font-weight:500;margin-bottom:10px;">${p.name}</div>` +
                   `<div style="display:grid;gap:8px;">` +
                   `<div><span style="color:#6B7280;font-size:11px;">Promedio de ${varY}</span><br/>` +
                   `<span style="font-size:24px;font-weight:700;color:#14B8A6;">${p.value.toLocaleString()}</span></div>` +
                   (count > 0 ? `<div><span style="color:#6B7280;font-size:11px;">Cantidad de registros</span><br/>` +
                   `<span style="font-size:16px;font-weight:600;">${count.toLocaleString()}</span></div>` : '') +
                   `<div style="background:#F3F4F6;padding:6px 10px;border-radius:6px;margin-top:4px;">` +
                   `<span style="color:${diffColor};font-weight:600;">${diffSign}${diff}%</span>` +
                   `<span style="color:#6B7280;font-size:11px;"> vs promedio general</span></div></div>`;
          }
        },
        legend: { show: false },
        xAxis: { 
          type: 'category' as const, 
          data: categories,
          axisLabel: { rotate: categories.length > 5 ? 45 : 0, color: '#4B5563', fontSize: 11 },
          axisLine: { lineStyle: { color: '#E5E7EB' } },
          axisTick: { show: false }
        },
        yAxis: { 
          type: 'value' as const, 
          name: `Promedio de ${varY}`,
          nameTextStyle: { color: '#6B7280', padding: [0, 0, 0, 50] },
          axisLine: { show: false },
          splitLine: { lineStyle: { color: '#F3F4F6', type: 'dashed' as const } }
        },
        series: [
          { 
            type: 'bar' as const, 
            name: varY,
            data: values.map((v: number, i: number) => ({ 
              value: v, 
              name: categories[i],
              itemStyle: { 
                color: {
                  type: 'linear' as const, x: 0, y: 0, x2: 0, y2: 1,
                  colorStops: [
                    { offset: 0, color: this.colors[i % this.colors.length] },
                    { offset: 1, color: this.adjustColor(this.colors[i % this.colors.length], -40) }
                  ]
                },
                borderRadius: [8, 8, 0, 0]
              }
            })),
            barWidth: '60%',
            label: { 
              show: categories.length <= 10, 
              position: 'top' as const, 
              formatter: (p: any) => p.value.toFixed(1),
              fontWeight: 'bold' as const,
              color: '#374151'
            },
            emphasis: {
              itemStyle: { shadowBlur: 15, shadowColor: 'rgba(0,0,0,0.2)' }
            },
            markLine: {
              silent: true,
              symbol: 'none',
              lineStyle: { color: '#EF4444', type: 'dashed' as const, width: 2 },
              data: [{ yAxis: avg, label: { formatter: `Prom: ${avg.toFixed(1)}`, position: 'end' as const } }]
            }
          }
        ],
        grid: { bottom: categories.length > 5 ? 100 : 60, left: 80, right: 30, top: 80 }
      };
    }

    return {};
  }

  getTipoClass(tipo: string): string {
    switch (tipo) {
      case 'NUMERICO': return 'type-numeric';
      case 'CATEGORICO': return 'type-categoric';
      case 'FECHA': return 'type-date';
      default: return 'type-text';
    }
  }

  getCorrelationClass(correlation: number | undefined): string {
    if (correlation === undefined) return '';
    const abs = Math.abs(correlation);
    if (abs >= 0.7) return 'text-success';
    if (abs >= 0.4) return 'text-warning';
    return 'text-error';
  }

  getCorrelationBoxClass(correlation: number | undefined): string {
    if (correlation === undefined) return 'stat-info';
    const abs = Math.abs(correlation);
    if (abs >= 0.7) return 'stat-success';
    if (abs >= 0.4) return 'stat-warning';
    return 'stat-error';
  }

  formatNumber(value: number | undefined): string {
    if (value === undefined || value === null) return '-';
    if (Math.abs(value) >= 1000000) return (value / 1000000).toFixed(1) + 'M';
    if (Math.abs(value) >= 1000) return (value / 1000).toFixed(1) + 'K';
    return value.toFixed(2);
  }
}
