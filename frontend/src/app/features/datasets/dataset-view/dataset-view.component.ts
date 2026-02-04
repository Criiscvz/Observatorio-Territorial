import { CommonModule } from '@angular/common';
import { Component, computed, ElementRef, inject, OnInit, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSliderModule } from '@angular/material/slider';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { EChartsOption } from 'echarts';
import { NgxEchartsDirective } from 'ngx-echarts';

import { ChartData, VariableMetadato } from '@core/models';
import { ChartThemeService } from '@core/services/chart-theme.service';
import { DashboardService } from '@core/services/dashboard.service';
import { DatasetService } from '@core/services/dataset.service';
import { BivariableResponse } from '@core/services/interfaces';
import { ThemeService } from '@core/services/theme.service';
import { CHART_TYPES, ChartType, ColumnWithUniqueId } from '@shared/models';
import { ChartOptionsService } from '@shared/services/chart-options.service';

// Extender ActiveChart con propiedades adicionales para el admin
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
    TranslateModule,
  ],
  templateUrl: './dataset-view.component.html',
  styleUrl: './dataset-view.component.scss',
})
export class DatasetViewComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly datasetService = inject(DatasetService);
  private readonly dashboardService = inject(DashboardService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly chartTheme = inject(ChartThemeService);
  private readonly translate = inject(TranslateService);
  private readonly chartOptionsService = inject(ChartOptionsService);
  readonly themeService = inject(ThemeService);

  // Usar tipos de gráficos compartidos desde @shared/models
  readonly chartTypes = CHART_TYPES;

  // Estado
  loading = signal(true);
  datasetId = signal<string>('');
  departamentoId = signal<string>('');
  datasetInfo = signal<{
    id: string;
    nombre: string;
    total_registros: number;
    estado?: 'PENDIENTE' | 'PROCESANDO' | 'COMPLETADO' | 'ERROR';
  } | null>(null);
  variables = signal<VariableMetadato[]>([]);
  tableData = signal<{ id: number; data: Record<string, any> }[]>([]);
  pagination = signal({ current_page: 1, last_page: 1, per_page: 50, total: 0 });

  // Scroll horizontal de la tabla
  tableScrollContainer = viewChild<ElementRef<HTMLDivElement>>('tableScrollContainer');
  canScrollLeft = false;
  canScrollRight = true;

  // Computed para verificar si el dataset está pendiente
  isDatasetPending = computed(() => {
    const info = this.datasetInfo();
    return (
      info?.estado === 'PENDIENTE' || (info?.total_registros === 0 && this.variables().length === 0)
    );
  });

  // Gráficos
  selectedChartType = signal<ChartType | null>(null);
  selectedVariableX: VariableMetadato | null = null;
  selectedVariableY: VariableMetadato | null = null;
  chartLimit: number | null = 20;
  activeCharts = signal<ActiveChart[]>([]);
  addingChart = signal(false);

  // Alias para variables filtradas (usan los computed de compatibilidad)
  filteredVariablesX = computed(() => this.compatibleVariablesX());
  filteredVariablesY = computed(() => this.compatibleVariablesY());

  // Computed - generamos identificadores únicos para evitar duplicados en mat-table
  visibleColumns = computed<ColumnWithUniqueId[]>(() => {
    const vars = this.variables();
    // Si no hay variables visibles, mostrar todas
    const visible = vars.filter((v) => v.es_visible);
    const columns = visible.length > 0 ? visible : vars;

    // Generar nombres únicos para columnas duplicadas usando índice
    return columns.map((col, index) => ({
      ...col,
      _uniqueId: `col_${index}_${col.nombre_columna}`,
    }));
  });
  columnNames = computed(() => this.visibleColumns().map((v) => v._uniqueId));
  // Todas las variables visibles son analizables (TEXTO se trata como CATEGORICO en el backend)
  analysableVariables = computed(() => this.variables().filter((v) => v.es_visible));

  // Computed: Variables compatibles con el tipo de gráfico seleccionado (Variable X)
  compatibleVariablesX = computed(() => {
    const chartType = this.selectedChartType();
    const vars = this.analysableVariables();

    if (!chartType) return vars;

    // Filtrar según el tipo de gráfico
    return vars.filter((v) => {
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
          return (
            v.tipo_dato === 'CATEGORICO' || v.tipo_dato === 'NUMERICO' || v.tipo_dato === 'TEXTO'
          );
        // Fechas y numéricas
        case 'line_time':
          return v.tipo_dato === 'FECHA' || v.tipo_dato === 'NUMERICO';
        // Líneas y áreas aceptan varios tipos
        case 'line':
        case 'area':
          return (
            v.tipo_dato === 'FECHA' || v.tipo_dato === 'NUMERICO' || v.tipo_dato === 'CATEGORICO'
          );
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

    return vars.filter((v) => {
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

    if (
      chartType.bivariable &&
      this.selectedVariableX &&
      this.compatibleVariablesY().length === 0
    ) {
      const tipoX = this.selectedVariableX.tipo_dato;
      switch (chartType.id) {
        case 'scatter':
          return 'Dispersión requiere dos variables numéricas. Selecciona otra variable numérica.';
        case 'heatmap':
          return 'Mapa de calor requiere dos variables categóricas o de texto.';
        case 'grouped_bar':
        case 'box_compare':
          if (tipoX === 'NUMERICO')
            return 'Selecciona una variable categórica o de texto para comparar.';
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
        this.variables.set(res.variables || []);
        this.tableData.set(res.data || []);
        this.pagination.set(res.pagination);

        // Obtener información completa del dataset incluyendo estado
        this.datasetService.getById(this.datasetId()).subscribe({
          next: (dsRes) => {
            this.datasetInfo.set({
              id: dsRes.id,
              nombre: dsRes.nombre,
              total_registros: dsRes.total_registros,
              estado: dsRes.estado,
            });
            if (dsRes.departamento_id) {
              this.departamentoId.set(dsRes.departamento_id);
            }
            this.loading.set(false);
          },
          error: () => {
            // Fallback: usar los datos de la respuesta original
            this.datasetInfo.set(res.dataset);
            if (res.dataset.departamento_id) {
              this.departamentoId.set(res.dataset.departamento_id);
            }
            this.loading.set(false);
          },
        });
      },
      error: () => this.loading.set(false),
    });
  }

  onPageChange(event: PageEvent): void {
    this.loadData(event.pageIndex + 1);
  }

  /**
   * Desplaza la tabla hacia la izquierda
   */
  scrollTableLeft(): void {
    const container = this.tableScrollContainer()?.nativeElement;
    if (container) {
      container.scrollBy({ left: -300, behavior: 'smooth' });
    }
  }

  /**
   * Desplaza la tabla hacia la derecha
   */
  scrollTableRight(): void {
    const container = this.tableScrollContainer()?.nativeElement;
    if (container) {
      container.scrollBy({ left: 300, behavior: 'smooth' });
    }
  }

  /**
   * Actualiza el estado de los botones de scroll según la posición
   */
  onTableScroll(): void {
    const container = this.tableScrollContainer()?.nativeElement;
    if (container) {
      this.canScrollLeft = container.scrollLeft > 0;
      this.canScrollRight =
        container.scrollLeft < container.scrollWidth - container.clientWidth - 5;
    }
  }

  /**
   * Elimina un dataset incompleto/pendiente
   */
  deleteIncompleteDataset(): void {
    const message = this.translate.instant('datasets.view.pendingWarning.confirmDelete', {
      name: this.datasetInfo()?.nombre,
    });

    if (confirm(message)) {
      this.datasetService.delete(this.datasetId()).subscribe({
        next: () => {
          this.snackBar.open(
            this.translate.instant('datasets.view.pendingWarning.deleteSuccess'),
            this.translate.instant('common.buttons.close'),
            { duration: 3000 },
          );
          // Navegar a la lista de datasets o al departamento
          if (this.departamentoId()) {
            this.router.navigate(['/admin/departamentos', this.departamentoId()]);
          } else {
            this.router.navigate(['/admin/datasets']);
          }
        },
        error: (err) => {
          this.snackBar.open(
            err.error?.message ||
              this.translate.instant('datasets.view.pendingWarning.deleteError'),
            this.translate.instant('common.buttons.close'),
            { duration: 5000 },
          );
        },
      });
    }
  }

  selectChartType(type: ChartType): void {
    this.selectedChartType.set(type);
    // Reset variables si cambia de bivariable a univariable
    if (!type.bivariable) {
      this.selectedVariableY = null;
    }
    // Reset variable X si no es compatible con el nuevo tipo
    if (this.selectedVariableX) {
      const compatible = this.compatibleVariablesX().find(
        (v) => v.id === this.selectedVariableX?.id,
      );
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

    const compatibleCount =
      axis === 'x' ? this.compatibleVariablesX().length : this.compatibleVariablesY().length;
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
    const title =
      type.bivariable && this.selectedVariableY
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
      filters: { limit: this.chartLimit || undefined },
    };

    this.activeCharts.update((charts) => [...charts, newChart]);
    this.addingChart.set(true);

    if (type.bivariable && this.selectedVariableY) {
      this.loadBivariableData(newChart);
    } else {
      this.loadUnivariableData(newChart);
    }
  }

  private loadUnivariableData(chart: ActiveChart): void {
    this.dashboardService
      .getUnivariableStats({
        dataset_id: this.datasetId(),
        variable_id: chart.variableX.id,
        chart_type: chart.chartType.id,
        limit: chart.filters?.limit,
      })
      .subscribe({
        next: (res) => {
          const chartData: ChartData = {
            variable: res.nombre_variable,
            tipo:
              chart.variableX.tipo_dato === 'NUMERICO'
                ? 'numeric'
                : chart.variableX.tipo_dato === 'FECHA'
                  ? 'date'
                  : 'categorical',
            chart_type: res.chart_type as any,
            data: {
              labels: res.data?.labels || [],
              values: res.data?.values || [],
            },
            stats: res.stats,
          };

          // Verificar que hay datos
          if (!chartData.data.labels?.length && !chartData.data.values?.length) {
            this.updateChartError(chart.id, 'No hay datos disponibles para esta variable');
          } else {
            this.updateChartData(chart.id, chartData);
          }
        },
        error: (err) => this.updateChartError(chart.id, this.getChartErrorMessage(err)),
      });
  }

  private loadBivariableData(chart: ActiveChart): void {
    if (!chart.variableY) return;

    this.dashboardService
      .getBivariableStats({
        dataset_id: this.datasetId(),
        variable_x_id: chart.variableX.id,
        variable_y_id: chart.variableY.id,
        chart_type: chart.chartType.id,
        limit: chart.filters?.limit,
      })
      .subscribe({
        next: (res) => {
          // Verificar que hay datos
          if (
            !res.data ||
            (!res.data.points?.length &&
              !res.data.series?.length &&
              !res.data.heatmap?.length &&
              !res.data.values?.length)
          ) {
            this.updateChartError(
              chart.id,
              'No hay datos suficientes para correlacionar estas variables',
            );
          } else {
            this.updateChartData(chart.id, res);
          }
        },
        error: (err) => this.updateChartError(chart.id, this.getChartErrorMessage(err)),
      });
  }

  private updateChartData(chartId: string, data: ChartData | BivariableResponse | null): void {
    this.activeCharts.update((charts) =>
      charts.map((c) => (c.id === chartId ? { ...c, data, loading: false, error: null } : c)),
    );
    this.addingChart.set(false);
  }

  private updateChartError(chartId: string, error: string): void {
    this.activeCharts.update((charts) =>
      charts.map((c) => (c.id === chartId ? { ...c, data: null, loading: false, error } : c)),
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
    this.activeCharts.update((charts) => charts.filter((c) => c.id !== chartId));
  }

  retryChart(chart: ActiveChart): void {
    // Marcar como cargando
    this.activeCharts.update((charts) =>
      charts.map((c) => (c.id === chart.id ? { ...c, loading: true, error: null } : c)),
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
          loading: true,
        };

        this.activeCharts.update((charts) => [...charts, newChart]);
        this.loadUnivariableData(newChart);
      }, index * 100); // Pequeño delay para no saturar
    });
  }

  private getDefaultChartType(tipoDato: string): ChartType | undefined {
    switch (tipoDato) {
      case 'CATEGORICO':
        return this.chartTypes.find((t) => t.id === 'bar');
      case 'NUMERICO':
        return this.chartTypes.find((t) => t.id === 'histogram');
      case 'FECHA':
        return this.chartTypes.find((t) => t.id === 'line');
      default:
        return undefined;
    }
  }

  updateVariable(variable: VariableMetadato): void {
    this.dashboardService
      .updateVariable(variable.id, {
        tipo_dato: variable.tipo_dato,
        es_visible: variable.es_visible,
      })
      .subscribe({
        next: () =>
          this.snackBar.open(this.translate.instant('common.messages.success'), 'OK', {
            duration: 2000,
          }),
        error: () =>
          this.snackBar.open(this.translate.instant('common.messages.error'), 'OK', {
            duration: 2000,
          }),
      });
  }

  getChartStats(chart: ActiveChart): any {
    if (!chart.data) return null;

    // Para datos bivariables
    if ('variable_x_id' in chart.data || 'nombre_variable_x' in chart.data) {
      const biData = chart.data as BivariableResponse;
      return {
        correlation: biData.data?.correlation || biData.stats?.correlation,
        count: biData.data?.stats?.count || biData.stats?.count,
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
      return this.chartOptionsService.getBivariableOptions(chart.data as BivariableResponse, type);
    }

    // Datos univariables - usar servicio compartido
    return this.chartOptionsService.getUnivariableOptions(chart.data as ChartData, type);
  }

  // =========== MÉTODOS DE UTILIDAD ===========

  private adjustColor(color: string, amount: number): string {
    const clamp = (val: number) => Math.min(255, Math.max(0, val));
    let hex = color.replace('#', '');
    if (hex.length === 3)
      hex = hex
        .split('')
        .map((c) => c + c)
        .join('');
    const r = clamp(parseInt(hex.substring(0, 2), 16) + amount);
    const g = clamp(parseInt(hex.substring(2, 4), 16) + amount);
    const b = clamp(parseInt(hex.substring(4, 6), 16) + amount);
    return `#${[r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
  }

  // =========== FIN MÉTODOS DE GRÁFICOS ===========

  getTipoClass(tipo: string): string {
    switch (tipo) {
      case 'NUMERICO':
        return 'type-numeric';
      case 'CATEGORICO':
        return 'type-categoric';
      case 'FECHA':
        return 'type-date';
      default:
        return 'type-text';
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
