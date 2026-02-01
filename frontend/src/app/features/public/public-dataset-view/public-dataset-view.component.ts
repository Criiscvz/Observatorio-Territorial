import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Component, computed, inject, OnInit, PLATFORM_ID, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { EChartsOption } from 'echarts';
import { NgxEchartsDirective } from 'ngx-echarts';

import { ChartData, VariableMetadato } from '@core/models';
import { ChartThemeService } from '@core/services/chart-theme.service';
import { BivariableResponse, DashboardService } from '@core/services/dashboard.service';

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

interface ColumnWithUniqueId extends VariableMetadato {
  _uniqueId: string;
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
    TranslateModule,
  ],
  templateUrl: './public-dataset-view.component.html',
  styleUrl: './public-dataset-view.component.scss',
})
export class PublicDatasetViewComponent implements OnInit {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly route = inject(ActivatedRoute);
  private readonly dashboardService = inject(DashboardService);
  private readonly chartTheme = inject(ChartThemeService);

  readonly chartTypes: ChartType[] = [
    // Univariables
    {
      id: 'bar',
      name: 'Barras',
      icon: 'bar_chart',
      description: 'Comparar categorías',
      forTypes: ['CATEGORICO', 'TEXTO'],
    },
    {
      id: 'pie',
      name: 'Pastel',
      icon: 'pie_chart',
      description: 'Proporciones',
      forTypes: ['CATEGORICO'],
    },
    {
      id: 'donut',
      name: 'Anillo',
      icon: 'donut_large',
      description: 'Con total',
      forTypes: ['CATEGORICO'],
    },
    {
      id: 'histogram',
      name: 'Histograma',
      icon: 'equalizer',
      description: 'Distribución',
      forTypes: ['NUMERICO'],
    },
    {
      id: 'line',
      name: 'Líneas',
      icon: 'show_chart',
      description: 'Tendencias',
      forTypes: ['FECHA', 'NUMERICO', 'CATEGORICO'],
    },
    {
      id: 'area',
      name: 'Área',
      icon: 'area_chart',
      description: 'Tendencias con área',
      forTypes: ['FECHA', 'NUMERICO', 'CATEGORICO'],
    },
    {
      id: 'funnel',
      name: 'Embudo',
      icon: 'filter_list',
      description: 'Procesos',
      forTypes: ['CATEGORICO'],
    },
    {
      id: 'treemap',
      name: 'Treemap',
      icon: 'grid_view',
      description: 'Jerarquía',
      forTypes: ['CATEGORICO'],
    },
    {
      id: 'gauge',
      name: 'Indicador',
      icon: 'speed',
      description: 'Medidor',
      forTypes: ['NUMERICO'],
    },
    {
      id: 'radar',
      name: 'Radar',
      icon: 'radar',
      description: 'Múltiples ejes',
      forTypes: ['CATEGORICO'],
    },
    // Bivariables
    {
      id: 'scatter',
      name: 'Dispersión',
      icon: 'scatter_plot',
      description: 'Correlación 2 numéricas',
      forTypes: ['NUMERICO'],
      bivariable: true,
    },
    {
      id: 'grouped_bar',
      name: 'Barras Agrupadas',
      icon: 'stacked_bar_chart',
      description: 'Promedio por categoría',
      forTypes: ['CATEGORICO', 'NUMERICO', 'TEXTO'],
      bivariable: true,
    },
    {
      id: 'heatmap',
      name: 'Mapa de Calor',
      icon: 'grid_on',
      description: 'Matriz de frecuencias',
      forTypes: ['CATEGORICO', 'TEXTO'],
      bivariable: true,
    },
    {
      id: 'box_compare',
      name: 'Comparar Promedios',
      icon: 'leaderboard',
      description: 'Promedio por categoría',
      forTypes: ['CATEGORICO', 'NUMERICO', 'TEXTO'],
      bivariable: true,
    },
    {
      id: 'line_time',
      name: 'Serie Temporal',
      icon: 'timeline',
      description: 'Evolución en el tiempo',
      forTypes: ['FECHA', 'NUMERICO'],
      bivariable: true,
    },
    {
      id: 'stacked_bar',
      name: 'Barras Apiladas',
      icon: 'stacked_bar_chart',
      description: 'Categorías por tiempo',
      forTypes: ['FECHA', 'CATEGORICO'],
      bivariable: true,
    },
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

  // Agregar _uniqueId a cada columna para evitar duplicados en mat-table
  visibleColumns = computed<ColumnWithUniqueId[]>(() => {
    const cols = this.variables().filter((v) => v.es_visible);
    // Asignar un identificador único basado en id o índice
    return cols.map((v, index) => ({
      ...v,
      _uniqueId: v.id || `col_${index}_${v.nombre_columna}`,
    }));
  });
  columnNames = computed(() => this.visibleColumns().map((v) => v._uniqueId));

  // Todas las variables visibles son analizables (TEXTO se trata como CATEGORICO)
  analysableVariables = computed(() => this.variables().filter((v) => v.es_visible));

  // Variables compatibles con el tipo de gráfico seleccionado (Variable X)
  compatibleVariablesX = computed(() => {
    const chartType = this.selectedChartType();
    const vars = this.analysableVariables();
    if (!chartType) return vars;

    return vars.filter((v) => {
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
          return (
            v.tipo_dato === 'CATEGORICO' || v.tipo_dato === 'NUMERICO' || v.tipo_dato === 'TEXTO'
          );
        case 'line_time':
          return v.tipo_dato === 'FECHA' || v.tipo_dato === 'NUMERICO';
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

  // Variables compatibles para Y (solo bivariables)
  compatibleVariablesY = computed(() => {
    const chartType = this.selectedChartType();
    const vars = this.analysableVariables();
    if (!chartType?.bivariable) return [];

    const selectedX = this.selectedVariableX;
    const tipoX = selectedX?.tipo_dato === 'TEXTO' ? 'CATEGORICO' : selectedX?.tipo_dato;

    return vars.filter((v) => {
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

    if (
      chartType.bivariable &&
      this.selectedVariableX &&
      this.compatibleVariablesY().length === 0
    ) {
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

  get colors() {
    return this.chartTheme.getColors();
  }
  get chartConfig() {
    return this.chartTheme.config();
  }

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.datasetId.set(this.route.snapshot.params['id']);
      this.loadData();
    } else {
      this.loading.set(false);
    }
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
      error: () => this.loading.set(false),
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
      .getPublicUnivariableStats({
        dataset_id: this.datasetId(),
        variable_id: chart.variableX.id,
        chart_type: chart.chartType.id,
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
            data: { labels: res.data?.labels || [], values: res.data?.values || [] },
            stats: res.stats,
          };
          this.updateChartData(chart.id, chartData);
        },
        error: () => this.updateChartData(chart.id, null),
      });
  }

  private loadBivariableData(chart: ActiveChart): void {
    if (!chart.variableY) return;

    this.dashboardService
      .getPublicBivariableStats({
        dataset_id: this.datasetId(),
        variable_x_id: chart.variableX.id,
        variable_y_id: chart.variableY.id,
        chart_type: chart.chartType.id,
      })
      .subscribe({
        next: (res) => this.updateChartData(chart.id, res),
        error: () => this.updateChartData(chart.id, null),
      });
  }

  private updateChartData(chartId: string, data: ChartData | BivariableResponse | null): void {
    this.activeCharts.update((charts) =>
      charts.map((c) => (c.id === chartId ? { ...c, data, loading: false } : c)),
    );
    this.addingChart.set(false);
  }

  removeChart(chartId: string): void {
    this.activeCharts.update((charts) => charts.filter((c) => c.id !== chartId));
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
          loading: true,
        };

        this.activeCharts.update((charts) => [...charts, chart]);
        this.loadUnivariableData(chart);
      }, i * 100);
    });
  }

  private getDefaultChartType(tipo: string): ChartType | undefined {
    switch (tipo) {
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

  getChartOptions(chart: ActiveChart): EChartsOption {
    if (!chart.data) return {};
    const cfg = this.chartConfig;
    const colors = this.colors;

    // Basic chart options with theme
    if ('variable_x_id' in chart.data || 'nombre_variable_x' in chart.data) {
      // Bivariable
      return this.getBivariableOptions(
        chart.data as BivariableResponse,
        chart.chartType.id,
        cfg,
        colors,
      );
    }

    // Univariable
    const data = chart.data as ChartData;
    return this.getUnivariableOptions(data, chart.chartType.id, cfg, colors);
  }

  private getUnivariableOptions(
    data: ChartData,
    type: string,
    cfg: any,
    colors: string[],
  ): EChartsOption {
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
        extraCssText: 'border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);',
      },
    };

    switch (type) {
      case 'bar':
        return {
          ...baseOptions,
          title: { text: title, left: 'center', textStyle: { color: cfg.textColor } },
          xAxis: {
            type: 'category',
            data: labels,
            axisLabel: { color: cfg.textColorSecondary, rotate: labels.length > 6 ? 45 : 0 },
          },
          yAxis: {
            type: 'value',
            axisLabel: { color: cfg.textColorSecondary },
            splitLine: { lineStyle: { color: cfg.splitLineColor } },
          },
          series: [
            {
              type: 'bar',
              data: values.map((v, i) => ({
                value: v,
                itemStyle: { color: colors[i % colors.length], borderRadius: [4, 4, 0, 0] },
              })),
            },
          ],
          grid: { bottom: labels.length > 6 ? 80 : 40, left: 60, right: 20, top: 60 },
        };
      case 'pie':
      case 'donut':
        return {
          ...baseOptions,
          title: { text: title, left: 'center', textStyle: { color: cfg.textColor } },
          legend: { bottom: 10, textStyle: { color: cfg.textColorSecondary }, type: 'scroll' },
          series: [
            {
              type: 'pie',
              radius: type === 'donut' ? ['40%', '70%'] : '70%',
              center: ['50%', '50%'],
              data: labels.map((l, i) => ({
                name: l,
                value: values[i],
                itemStyle: { color: colors[i % colors.length] },
              })),
              label: { show: true, color: cfg.textColorSecondary },
              emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.2)' } },
            },
          ],
        };
      case 'histogram':
        return {
          ...baseOptions,
          title: {
            text: `Distribución: ${title}`,
            left: 'center',
            textStyle: { color: cfg.textColor },
          },
          xAxis: {
            type: 'category',
            data: labels,
            axisLabel: { color: cfg.textColorSecondary, rotate: 45 },
          },
          yAxis: {
            type: 'value',
            axisLabel: { color: cfg.textColorSecondary },
            splitLine: { lineStyle: { color: cfg.splitLineColor } },
          },
          series: [
            {
              type: 'bar',
              data: values,
              itemStyle: { color: colors[2], borderRadius: [4, 4, 0, 0] },
            },
          ],
          grid: { bottom: 80, left: 60, right: 20, top: 60 },
        };
      case 'line':
        return {
          ...baseOptions,
          title: { text: title, left: 'center', textStyle: { color: cfg.textColor } },
          xAxis: {
            type: 'category',
            data: labels,
            boundaryGap: false,
            axisLabel: { color: cfg.textColorSecondary },
          },
          yAxis: {
            type: 'value',
            axisLabel: { color: cfg.textColorSecondary },
            splitLine: { lineStyle: { color: cfg.splitLineColor } },
          },
          series: [
            {
              type: 'line',
              data: values,
              smooth: true,
              itemStyle: { color: colors[3] },
              areaStyle: { color: `${colors[3]}20` },
            },
          ],
          grid: { bottom: 40, left: 60, right: 20, top: 60 },
        };
      case 'area':
        return {
          ...baseOptions,
          title: { text: title, left: 'center', textStyle: { color: cfg.textColor } },
          xAxis: {
            type: 'category',
            data: labels,
            boundaryGap: false,
            axisLabel: { color: cfg.textColorSecondary },
          },
          yAxis: {
            type: 'value',
            axisLabel: { color: cfg.textColorSecondary },
            splitLine: { lineStyle: { color: cfg.splitLineColor } },
          },
          series: [
            {
              type: 'line',
              data: values,
              smooth: true,
              itemStyle: { color: colors[4] },
              areaStyle: {
                color: {
                  type: 'linear',
                  x: 0,
                  y: 0,
                  x2: 0,
                  y2: 1,
                  colorStops: [
                    { offset: 0, color: `${colors[4]}60` },
                    { offset: 1, color: `${colors[4]}05` },
                  ],
                },
              },
            },
          ],
          grid: { bottom: 40, left: 60, right: 20, top: 60 },
        };
      case 'funnel':
        return {
          ...baseOptions,
          title: { text: title, left: 'center', textStyle: { color: cfg.textColor } },
          legend: { bottom: 10, textStyle: { color: cfg.textColorSecondary } },
          series: [
            {
              type: 'funnel',
              left: '10%',
              right: '10%',
              top: 60,
              bottom: 60,
              minSize: '20%',
              maxSize: '100%',
              sort: 'descending',
              gap: 2,
              label: { show: true, position: 'inside', color: '#fff' },
              data: labels.map((l, i) => ({
                name: l,
                value: values[i],
                itemStyle: { color: colors[i % colors.length] },
              })),
            },
          ],
        };
      case 'treemap':
        return {
          ...baseOptions,
          title: { text: title, left: 'center', textStyle: { color: cfg.textColor } },
          series: [
            {
              type: 'treemap',
              roam: false,
              breadcrumb: { show: false },
              label: { show: true, formatter: '{b}', color: '#fff' },
              data: labels.map((l, i) => ({
                name: l,
                value: values[i],
                itemStyle: { color: colors[i % colors.length] },
              })),
            },
          ],
        };
      case 'gauge': {
        const gaugeAvg = total / Math.max(values.length, 1);
        return {
          ...baseOptions,
          title: { text: title, left: 'center', textStyle: { color: cfg.textColor } },
          series: [
            {
              type: 'gauge',
              min: data.stats?.min ?? 0,
              max: data.stats?.max ?? 100,
              progress: { show: true, width: 18 },
              axisLine: {
                lineStyle: {
                  width: 18,
                  color: [
                    [0.3, '#EF4444'],
                    [0.7, '#F59E0B'],
                    [1, '#10B981'],
                  ],
                },
              },
              axisTick: { show: false },
              splitLine: { length: 12, lineStyle: { width: 2, color: cfg.splitLineColor } },
              axisLabel: { distance: 25, color: cfg.textColorSecondary },
              pointer: { itemStyle: { color: colors[0] } },
              title: { show: true, offsetCenter: [0, '70%'], color: cfg.textColorSecondary },
              detail: {
                valueAnimation: true,
                formatter: '{value}',
                color: cfg.textColor,
                fontSize: 24,
              },
              data: [{ value: Number(gaugeAvg.toFixed(1)), name: 'Promedio' }],
            },
          ],
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
            splitArea: { areaStyle: { color: ['transparent', `${cfg.splitLineColor}30`] } },
          },
          series: [
            {
              type: 'radar',
              data: [
                {
                  value: values,
                  name: title,
                  itemStyle: { color: colors[0] },
                  areaStyle: { color: `${colors[0]}40` },
                },
              ],
            },
          ],
        };
      default:
        return {};
    }
  }

  private getBivariableOptions(
    data: BivariableResponse,
    type: string,
    cfg: any,
    colors: string[],
  ): EChartsOption {
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
        extraCssText: 'border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);',
      },
    };

    // LINE_TIME (serie temporal)
    if (type === 'line_time' || (d.labels && d.values && !d.points && !d.heatmap && !d.series)) {
      const labels = d.labels || [];
      const vals = d.values || [];
      const total = vals.reduce((a: number, b: number) => a + b, 0);
      const avg = vals.length > 0 ? total / vals.length : 0;

      return {
        ...baseOptions,
        title: {
          text: `${varY} en el tiempo`,
          left: 'center',
          textStyle: { color: cfg.textColor },
        },
        xAxis: {
          type: 'category',
          data: labels,
          boundaryGap: false,
          axisLabel: { color: cfg.textColorSecondary, rotate: labels.length > 10 ? 45 : 0 },
        },
        yAxis: {
          type: 'value',
          name: varY,
          axisLabel: { color: cfg.textColorSecondary },
          splitLine: { lineStyle: { color: cfg.splitLineColor } },
        },
        series: [
          {
            type: 'line',
            data: vals,
            smooth: true,
            symbol: 'circle',
            symbolSize: 6,
            lineStyle: { color: colors[0], width: 3 },
            itemStyle: { color: colors[0] },
            areaStyle: {
              color: {
                type: 'linear',
                x: 0,
                y: 0,
                x2: 0,
                y2: 1,
                colorStops: [
                  { offset: 0, color: `${colors[0]}40` },
                  { offset: 1, color: `${colors[0]}05` },
                ],
              },
            },
          },
        ],
        grid: { bottom: labels.length > 10 ? 80 : 40, left: 60, right: 20, top: 60 },
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
          subtextStyle: { color: cfg.textColorSecondary },
        },
        xAxis: {
          type: 'value',
          name: varX,
          scale: true,
          axisLabel: { color: cfg.textColorSecondary },
          splitLine: { lineStyle: { color: cfg.splitLineColor } },
        },
        yAxis: {
          type: 'value',
          name: varY,
          scale: true,
          axisLabel: { color: cfg.textColorSecondary },
          splitLine: { lineStyle: { color: cfg.splitLineColor } },
        },
        series: [
          {
            type: 'scatter',
            data: d.points,
            symbolSize: 8,
            itemStyle: { color: colors[5], opacity: 0.7 },
            emphasis: { itemStyle: { opacity: 1, borderColor: '#fff', borderWidth: 2 } },
          },
        ],
        grid: { bottom: 50, left: 60, right: 30, top: 70 },
      };
    }

    // HEATMAP (2 categóricas)
    if (d.heatmap && d.labels_x && d.labels_y) {
      const maxVal = Math.max(...d.heatmap.map((h: [number, number, number]) => h[2]), 1);
      return {
        ...baseOptions,
        title: { text: `${varX} × ${varY}`, left: 'center', textStyle: { color: cfg.textColor } },
        xAxis: {
          type: 'category',
          data: d.labels_x,
          axisLabel: { color: cfg.textColorSecondary, rotate: 45 },
          splitArea: { show: true },
        },
        yAxis: {
          type: 'category',
          data: d.labels_y,
          axisLabel: { color: cfg.textColorSecondary },
          splitArea: { show: true },
        },
        visualMap: {
          min: 0,
          max: maxVal,
          calculable: true,
          orient: 'horizontal',
          left: 'center',
          bottom: 10,
          inRange: { color: ['#FDF2F8', '#FBCFE8', '#F9A8D4', '#EC4899', '#BE185D'] },
        },
        series: [
          {
            type: 'heatmap',
            data: d.heatmap,
            label: {
              show: d.labels_x.length <= 8 && d.labels_y.length <= 8,
              formatter: (p: any) => (p.value[2] > 0 ? p.value[2] : ''),
            },
            emphasis: { itemStyle: { shadowBlur: 10 } },
          },
        ],
        grid: { bottom: 70, top: 60, left: 80, right: 20 },
      };
    }

    // STACKED/GROUPED BAR (con series)
    if (d.series && Array.isArray(d.series) && d.labels_x) {
      return {
        ...baseOptions,
        title: { text: `${varY} por ${varX}`, left: 'center', textStyle: { color: cfg.textColor } },
        legend: { bottom: 10, textStyle: { color: cfg.textColorSecondary }, type: 'scroll' },
        xAxis: {
          type: 'category',
          data: d.labels_x,
          axisLabel: { color: cfg.textColorSecondary, rotate: d.labels_x.length > 6 ? 45 : 0 },
        },
        yAxis: {
          type: 'value',
          axisLabel: { color: cfg.textColorSecondary },
          splitLine: { lineStyle: { color: cfg.splitLineColor } },
        },
        series: d.series.map((s: any, i: number) => ({
          name: s.name,
          type: 'bar',
          stack: type === 'stacked_bar' ? 'total' : undefined,
          data: s.data,
          itemStyle: {
            color: colors[i % colors.length],
            borderRadius: type !== 'stacked_bar' ? [4, 4, 0, 0] : 0,
          },
        })),
        grid: { bottom: 70, left: 60, right: 20, top: 60 },
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
          subtextStyle: { color: cfg.textColorSecondary },
        },
        xAxis: {
          type: 'category',
          data: categories,
          axisLabel: { color: cfg.textColorSecondary, rotate: categories.length > 5 ? 45 : 0 },
        },
        yAxis: {
          type: 'value',
          name: `Promedio de ${varY}`,
          axisLabel: { color: cfg.textColorSecondary },
          splitLine: { lineStyle: { color: cfg.splitLineColor } },
        },
        series: [
          {
            type: 'bar',
            data: values.map((v: number, i: number) => ({
              value: v,
              name: categories[i],
              itemStyle: {
                color: {
                  type: 'linear',
                  x: 0,
                  y: 0,
                  x2: 0,
                  y2: 1,
                  colorStops: [
                    { offset: 0, color: colors[i % colors.length] },
                    { offset: 1, color: this.adjustColor(colors[i % colors.length], -40) },
                  ],
                },
                borderRadius: [6, 6, 0, 0],
              },
            })),
            barWidth: '60%',
            markLine: {
              silent: true,
              symbol: 'none',
              lineStyle: { color: '#EF4444', type: 'dashed', width: 2 },
              data: [
                {
                  yAxis: avg,
                  label: {
                    formatter: `Prom: ${avg.toFixed(1)}`,
                    position: 'end',
                    color: '#EF4444',
                  },
                },
              ],
            },
          },
        ],
        grid: { bottom: categories.length > 5 ? 90 : 50, left: 70, right: 20, top: 70 },
      };
    }

    return {};
  }

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

  getTypeClass(tipo: string): string {
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

  getTypeShort(tipo: string): string {
    switch (tipo) {
      case 'NUMERICO':
        return 'NUM';
      case 'CATEGORICO':
        return 'CAT';
      case 'FECHA':
        return 'DATE';
      default:
        return 'TXT';
    }
  }
}
