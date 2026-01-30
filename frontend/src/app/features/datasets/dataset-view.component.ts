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

  // Tipos de gráficos disponibles
  readonly chartTypes: ChartType[] = [
    { id: 'bar', name: 'Barras', icon: 'bar_chart', description: 'Comparar categorías', forTypes: ['CATEGORICO', 'TEXTO'] },
    { id: 'pie', name: 'Pastel', icon: 'pie_chart', description: 'Proporciones', forTypes: ['CATEGORICO'] },
    { id: 'donut', name: 'Donut', icon: 'donut_large', description: 'Proporciones con total', forTypes: ['CATEGORICO'] },
    { id: 'histogram', name: 'Histograma', icon: 'equalizer', description: 'Distribución numérica', forTypes: ['NUMERICO'] },
    { id: 'line', name: 'Líneas', icon: 'show_chart', description: 'Tendencias', forTypes: ['FECHA', 'NUMERICO'] },
    { id: 'area', name: 'Área', icon: 'area_chart', description: 'Tendencias con área', forTypes: ['FECHA', 'NUMERICO'] },
    { id: 'scatter', name: 'Dispersión', icon: 'scatter_plot', description: 'Correlación 2 numéricas', forTypes: ['NUMERICO'], bivariable: true },
    { id: 'grouped_bar', name: 'Barras Agrupadas', icon: 'stacked_bar_chart', description: '2 categóricas', forTypes: ['CATEGORICO'], bivariable: true },
    { id: 'heatmap', name: 'Mapa de Calor', icon: 'grid_on', description: 'Matriz de frecuencias', forTypes: ['CATEGORICO'], bivariable: true },
    { id: 'box_compare', name: 'Comparar Promedios', icon: 'leaderboard', description: 'Categórica vs Numérica', forTypes: ['CATEGORICO'], bivariable: true },
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

  // Colores
  private readonly colors = [
    '#C8102E', '#1E3A5F', '#3B82F6', '#10B981', '#F59E0B', 
    '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16', '#F97316'
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

    switch (type) {
      case 'bar':
        return {
          tooltip: { trigger: 'axis' },
          xAxis: { type: 'category', data: labels, axisLabel: { rotate: 45, interval: 0 } },
          yAxis: { type: 'value' },
          series: [{ type: 'bar', data: values.map((v, i) => ({ value: v, itemStyle: { color: this.colors[i % this.colors.length] } })) }],
          grid: { bottom: 80, left: 50, right: 20 }
        };

      case 'pie':
        return {
          tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
          series: [{
            type: 'pie',
            radius: '70%',
            data: labels.map((l, i) => ({ name: l, value: values[i], itemStyle: { color: this.colors[i % this.colors.length] } }))
          }]
        };

      case 'donut':
        const total = values.reduce((a, b) => a + b, 0);
        return {
          tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
          graphic: [
            { type: 'text', left: 'center', top: '40%', style: { text: total.toLocaleString(), fontSize: 20, fontWeight: 'bold' } },
            { type: 'text', left: 'center', top: '50%', style: { text: 'Total', fontSize: 12, fill: '#666' } }
          ],
          series: [{
            type: 'pie',
            radius: ['45%', '70%'],
            data: labels.map((l, i) => ({ name: l, value: values[i], itemStyle: { color: this.colors[i % this.colors.length] } }))
          }]
        };

      case 'histogram':
        return {
          tooltip: { trigger: 'axis' },
          xAxis: { type: 'category', data: labels, axisLabel: { rotate: 45 } },
          yAxis: { type: 'value', name: 'Frecuencia' },
          series: [{ type: 'bar', data: values, itemStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: '#3B82F6' }, { offset: 1, color: '#1E40AF' }] } } }],
          grid: { bottom: 80, left: 60, right: 20 }
        };

      case 'line':
      case 'area':
        return {
          tooltip: { trigger: 'axis' },
          xAxis: { type: 'category', data: labels, axisLabel: { rotate: 45 } },
          yAxis: { type: 'value' },
          series: [{
            type: 'line',
            data: values,
            smooth: true,
            lineStyle: { color: '#C8102E', width: 2 },
            areaStyle: type === 'area' ? { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(200,16,46,0.5)' }, { offset: 1, color: 'rgba(200,16,46,0.05)' }] } } : undefined
          }],
          grid: { bottom: 80, left: 50, right: 20 },
          dataZoom: [{ type: 'inside' }]
        };

      default:
        return {};
    }
  }

  private getBivariableChartOptions(data: BivariableResponse, type: string): EChartsOption {
    const d = data.data;
    const varX = data.nombre_variable_x || data.variable_x || '';
    const varY = data.nombre_variable_y || data.variable_y || '';

    // Scatter
    if (d.points && d.points.length > 0) {
      return {
        tooltip: { trigger: 'item', formatter: (p: any) => `X: ${p.value[0]}<br>Y: ${p.value[1]}` },
        xAxis: { type: 'value', name: varX, scale: true },
        yAxis: { type: 'value', name: varY, scale: true },
        series: [{ type: 'scatter', data: d.points, symbolSize: 8, itemStyle: { color: '#C8102E', opacity: 0.7 } }],
        dataZoom: [{ type: 'inside', xAxisIndex: 0 }, { type: 'inside', yAxisIndex: 0 }]
      };
    }

    // Heatmap
    if (d.heatmap && d.labels_x && d.labels_y) {
      const maxVal = Math.max(...d.heatmap.map((h: [number, number, number]) => h[2]));
      return {
        tooltip: { position: 'top' },
        xAxis: { type: 'category', data: d.labels_x, splitArea: { show: true }, axisLabel: { rotate: 45 } },
        yAxis: { type: 'category', data: d.labels_y, splitArea: { show: true } },
        visualMap: { min: 0, max: maxVal, calculable: true, orient: 'horizontal', left: 'center', bottom: 0, inRange: { color: ['#f5f5f5', '#C8102E'] } },
        series: [{ type: 'heatmap', data: d.heatmap, label: { show: true } }],
        grid: { bottom: 80, top: 20 }
      };
    }

    // Grouped bar / stacked
    if (d.series && Array.isArray(d.series) && d.labels_x) {
      return {
        tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
        legend: { bottom: 0, type: 'scroll' },
        xAxis: { type: 'category', data: d.labels_x, axisLabel: { rotate: 45 } },
        yAxis: { type: 'value' },
        series: d.series.map((s: { name: string; data: number[] }, i: number) => ({ 
          name: s.name, 
          type: 'bar' as const, 
          data: s.data, 
          itemStyle: { color: this.colors[i % this.colors.length] } 
        })),
        grid: { bottom: 100, left: 50, right: 20 }
      };
    }

    // Bar simple (categórica vs numérica)
    if (d.labels && d.values) {
      return {
        tooltip: { trigger: 'axis' },
        xAxis: { type: 'category', data: d.labels, axisLabel: { rotate: 45, interval: 0 } },
        yAxis: { type: 'value', name: varY },
        series: [{ type: 'bar', data: d.values.map((v: number, i: number) => ({ value: v, itemStyle: { color: this.colors[i % this.colors.length] } })) }],
        grid: { bottom: 80, left: 60, right: 20 }
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
