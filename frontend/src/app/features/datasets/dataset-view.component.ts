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
        <div class="flex justify-between items-start bg-white rounded-lg shadow p-4">
          <div class="flex items-center gap-4">
            <a mat-icon-button [routerLink]="['/departamentos', departamentoId()]" matTooltip="Volver">
              <mat-icon>arrow_back</mat-icon>
            </a>
            <div>
              <h1 class="text-2xl font-bold text-gray-800">{{ datasetInfo()?.nombre }}</h1>
              <p class="text-gray-500">{{ datasetInfo()?.total_registros | number }} registros</p>
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
                          <th mat-header-cell *matHeaderCellDef class="!bg-gray-50">
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
                      <div class="text-center py-8 text-gray-500">
                        <mat-icon class="text-4xl">table_rows</mat-icon>
                        <p class="mt-2">No hay datos disponibles</p>
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
                    <p class="text-sm font-medium text-gray-700 mb-3">Tipo de Gráfico:</p>
                    <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                      @for (type of chartTypes; track type.id) {
                        <div 
                          class="p-3 rounded-lg border-2 cursor-pointer transition-all text-center"
                          [class.border-red-500]="selectedChartType()?.id === type.id"
                          [class.bg-red-50]="selectedChartType()?.id === type.id"
                          [class.border-gray-200]="selectedChartType()?.id !== type.id"
                          [class.hover:border-red-300]="selectedChartType()?.id !== type.id"
                          (click)="selectChartType(type)">
                          <mat-icon class="text-3xl" [class.text-red-500]="selectedChartType()?.id === type.id">
                            {{ type.icon }}
                          </mat-icon>
                          <p class="font-medium text-sm mt-1">{{ type.name }}</p>
                          <p class="text-xs text-gray-500">{{ type.description }}</p>
                        </div>
                      }
                    </div>
                  </div>

                  <mat-divider class="!my-4"></mat-divider>

                  <!-- Selección de variables -->
                  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <mat-form-field appearance="outline">
                      <mat-label>Variable Principal (X)</mat-label>
                      <mat-select [(value)]="selectedVariableX">
                        @for (v of analysableVariables(); track v.id) {
                          <mat-option [value]="v">
                            <div class="flex items-center gap-2">
                              <span>{{ v.nombre_original }}</span>
                              <span class="text-xs px-1 rounded" [class]="getTipoClass(v.tipo_dato)">
                                {{ v.tipo_dato }}
                              </span>
                            </div>
                          </mat-option>
                        }
                      </mat-select>
                    </mat-form-field>

                    @if (selectedChartType()?.bivariable) {
                      <mat-form-field appearance="outline">
                        <mat-label>Variable Secundaria (Y)</mat-label>
                        <mat-select [(value)]="selectedVariableY">
                          @for (v of analysableVariables(); track v.id) {
                            <mat-option [value]="v" [disabled]="v.id === selectedVariableX?.id">
                              <div class="flex items-center gap-2">
                                <span>{{ v.nombre_original }}</span>
                                <span class="text-xs px-1 rounded" [class]="getTipoClass(v.tipo_dato)">
                                  {{ v.tipo_dato }}
                                </span>
                              </div>
                            </mat-option>
                          }
                        </mat-select>
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
              <div class="flex flex-wrap gap-2">
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
                <span class="text-gray-500 self-center">
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
                          <div class="h-64 flex items-center justify-center">
                            <mat-spinner diameter="40"></mat-spinner>
                          </div>
                        } @else if (chart.data) {
                          <!-- Estadísticas si aplica -->
                          @if (getChartStats(chart)) {
                            <div class="grid grid-cols-3 gap-2 mb-3 text-sm">
                              @if (getChartStats(chart)?.mean !== undefined) {
                                <div class="bg-blue-50 p-2 rounded text-center">
                                  <span class="block text-xs text-gray-500">Promedio</span>
                                  <span class="font-bold text-blue-600">{{ formatNumber(getChartStats(chart)?.mean) }}</span>
                                </div>
                              }
                              @if (getChartStats(chart)?.count !== undefined) {
                                <div class="bg-green-50 p-2 rounded text-center">
                                  <span class="block text-xs text-gray-500">Total</span>
                                  <span class="font-bold text-green-600">{{ getChartStats(chart)?.count | number }}</span>
                                </div>
                              }
                              @if (getChartStats(chart)?.correlation !== undefined) {
                                <div class="bg-purple-50 p-2 rounded text-center">
                                  <span class="block text-xs text-gray-500">Correlación</span>
                                  <span class="font-bold" [class]="getCorrelationClass(getChartStats(chart)?.correlation)">
                                    {{ getChartStats(chart)?.correlation }}
                                  </span>
                                </div>
                              }
                            </div>
                          }
                          <div echarts [options]="getChartOptions(chart)" class="h-64"></div>
                        } @else {
                          <div class="h-64 flex items-center justify-center text-gray-400">
                            <p>No hay datos disponibles</p>
                          </div>
                        }
                      </mat-card-content>
                    </mat-card>
                  }
                </div>
              } @else {
                <mat-card>
                  <mat-card-content class="text-center py-12">
                    <mat-icon class="text-6xl text-gray-300">insert_chart</mat-icon>
                    <h3 class="text-xl text-gray-600 mt-4">Sin gráficos</h3>
                    <p class="text-gray-500">Selecciona un tipo de gráfico y una variable para comenzar</p>
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
  `]
})
export class DatasetViewComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly datasetService = inject(DatasetService);
  private readonly dashboardService = inject(DashboardService);
  private readonly snackBar = inject(MatSnackBar);

  // Tipos de gráficos disponibles - organizados por complejidad
  readonly chartTypes: ChartType[] = [
    // === UNIVARIABLES ===
    { id: 'bar', name: 'Barras Verticales', icon: 'bar_chart', description: 'Comparar frecuencias por categoría', forTypes: ['CATEGORICO', 'TEXTO'] },
    { id: 'pie', name: 'Pastel (Torta)', icon: 'pie_chart', description: 'Mostrar proporciones del total', forTypes: ['CATEGORICO'] },
    { id: 'donut', name: 'Anillo (Donut)', icon: 'donut_large', description: 'Proporciones con total central', forTypes: ['CATEGORICO'] },
    { id: 'histogram', name: 'Histograma', icon: 'equalizer', description: 'Distribución de valores numéricos', forTypes: ['NUMERICO'] },
    { id: 'line', name: 'Líneas', icon: 'show_chart', description: 'Tendencias y evolución temporal', forTypes: ['FECHA', 'NUMERICO', 'CATEGORICO'] },
    { id: 'area', name: 'Área', icon: 'area_chart', description: 'Tendencias con área sombreada', forTypes: ['FECHA', 'NUMERICO', 'CATEGORICO'] },
    // === BIVARIABLES ===
    { id: 'scatter', name: 'Dispersión (Scatter)', icon: 'scatter_plot', description: 'Correlación entre 2 numéricas', forTypes: ['NUMERICO'], bivariable: true },
    { id: 'grouped_bar', name: 'Barras Agrupadas', icon: 'stacked_bar_chart', description: 'Comparar grupos por categoría', forTypes: ['CATEGORICO'], bivariable: true },
    { id: 'heatmap', name: 'Mapa de Calor', icon: 'grid_on', description: 'Matriz de frecuencias cruzadas', forTypes: ['CATEGORICO'], bivariable: true },
    { id: 'box_compare', name: 'Comparar Promedios', icon: 'leaderboard', description: 'Promedio numérico por categoría', forTypes: ['CATEGORICO', 'NUMERICO'], bivariable: true },
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
  analysableVariables = computed(() => this.variables().filter(v => v.tipo_dato !== 'TEXTO'));

  // Paleta de colores moderna y vibrante
  private readonly colors = [
    '#6366F1', '#EC4899', '#14B8A6', '#F59E0B', '#EF4444',
    '#8B5CF6', '#06B6D4', '#84CC16', '#F97316', '#3B82F6',
    '#10B981', '#E11D48', '#7C3AED', '#0EA5E9', '#22C55E'
  ];
  
  // Gradientes para gráficos
  private readonly gradients = [
    { start: '#6366F1', end: '#4F46E5' },
    { start: '#EC4899', end: '#DB2777' },
    { start: '#14B8A6', end: '#0D9488' },
    { start: '#F59E0B', end: '#D97706' },
    { start: '#EF4444', end: '#DC2626' },
  ];

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
        this.updateChartData(chart.id, chartData);
      },
      error: () => this.updateChartData(chart.id, null)
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

    // Estilos comunes mejorados
    const titleStyle = { 
      text: variableName, 
      left: 'center', 
      top: 10, 
      textStyle: { 
        fontSize: 16, 
        fontWeight: 'bold' as const,
        color: '#1F2937'
      },
      subtextStyle: { fontSize: 12, color: '#6B7280' }
    };

    const tooltipStyle = {
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderColor: '#E5E7EB',
      borderWidth: 1,
      textStyle: { color: '#1F2937' },
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
              return `<div style="font-weight:600;margin-bottom:8px;color:#6366F1">${variableName}</div>` +
                     `<div style="display:flex;align-items:center;gap:8px;">` +
                     `<span style="width:12px;height:12px;background:${p.color};border-radius:3px;"></span>` +
                     `<span>${p.name}</span></div>` +
                     `<div style="font-size:18px;font-weight:700;margin-top:4px;">${p.value.toLocaleString()}</div>` +
                     `<div style="color:#6B7280;font-size:12px;">${percent}% del total</div>`;
            }
          },
          legend: { show: false },
          xAxis: { 
            type: 'category' as const, 
            data: labels, 
            axisLabel: { rotate: labels.length > 6 ? 45 : 0, interval: 0, color: '#4B5563', fontSize: 11 },
            axisLine: { lineStyle: { color: '#E5E7EB' } },
            axisTick: { show: false }
          },
          yAxis: { 
            type: 'value' as const, 
            name: 'Cantidad',
            nameTextStyle: { color: '#6B7280', padding: [0, 0, 0, 40] },
            axisLine: { show: false },
            axisTick: { show: false },
            splitLine: { lineStyle: { color: '#F3F4F6', type: 'dashed' as const } }
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
                    { offset: 0, color: this.colors[i % this.colors.length] },
                    { offset: 1, color: this.adjustColor(this.colors[i % this.colors.length], -30) }
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
              color: '#374151',
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
              return `<div style="font-weight:600;margin-bottom:8px;color:#6366F1">${variableName}</div>` +
                     `<div style="display:flex;align-items:center;gap:8px;">` +
                     `<span style="width:14px;height:14px;background:${params.color};border-radius:50%;"></span>` +
                     `<span style="font-weight:500">${params.name}</span></div>` +
                     `<div style="font-size:22px;font-weight:700;margin:8px 0;">${params.value.toLocaleString()}</div>` +
                     `<div style="background:#F3F4F6;padding:4px 8px;border-radius:4px;font-weight:600;color:#6366F1;">` +
                     `${params.percent}% del total</div>`;
            }
          },
          legend: { 
            orient: 'vertical' as const, 
            right: 20, 
            top: 'middle' as const,
            type: 'scroll' as const,
            textStyle: { color: '#4B5563' },
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
                color: this.colors[i % this.colors.length],
                borderColor: '#fff',
                borderWidth: 2
              }
            })),
            label: { 
              show: labels.length <= 8, 
              formatter: '{b}\n{d}%',
              fontSize: 11,
              color: '#374151'
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
      case 'NUMERICO': return 'bg-blue-100 text-blue-800';
      case 'CATEGORICO': return 'bg-green-100 text-green-800';
      case 'FECHA': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  }

  getCorrelationClass(correlation: number | undefined): string {
    if (correlation === undefined) return '';
    const abs = Math.abs(correlation);
    if (abs >= 0.7) return 'text-green-600';
    if (abs >= 0.4) return 'text-yellow-600';
    return 'text-red-600';
  }

  formatNumber(value: number | undefined): string {
    if (value === undefined || value === null) return '-';
    if (Math.abs(value) >= 1000000) return (value / 1000000).toFixed(1) + 'M';
    if (Math.abs(value) >= 1000) return (value / 1000).toFixed(1) + 'K';
    return value.toFixed(2);
  }
}
