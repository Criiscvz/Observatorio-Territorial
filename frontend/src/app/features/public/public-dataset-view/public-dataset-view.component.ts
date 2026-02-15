import { CommonModule, isPlatformBrowser } from '@angular/common';
import {
  Component,
  computed,
  DestroyRef,
  inject,
  OnInit,
  PLATFORM_ID,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { ChartData, DatasetFuente, GraficoPredeterminado, VariableMetadato } from '@core/models';
import { CategoriaService } from '@core/services/categoria.service';
import { DashboardService } from '@core/services/dashboard.service';
import { BivariableResponse } from '@core/services/interfaces';
import { ChartFilter } from '@core/services/interfaces/stats/univariable-request.interface';
import {
  ChartFiltersComponent,
  ChartsGridComponent,
  ChartTypeSelectorComponent,
  DataTableComponent,
  VariableSelectorComponent,
} from '@shared/components/charts';
import { ActiveChart, CHART_TYPES, ChartType, ColumnWithUniqueId } from '@shared/models';

@Component({
  selector: 'app-public-dataset-view',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatTabsModule,
    MatProgressSpinnerModule,
    MatDividerModule,
    MatTooltipModule,
    TranslateModule,
    ChartTypeSelectorComponent,
    VariableSelectorComponent,
    ChartFiltersComponent,
    ChartsGridComponent,
    DataTableComponent,
  ],
  templateUrl: './public-dataset-view.component.html',
  styleUrl: './public-dataset-view.component.scss',
})
export class PublicDatasetViewComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private dashboardService = inject(DashboardService);
  private categoriaService = inject(CategoriaService);
  private platformId = inject(PLATFORM_ID);
  private destroyRef = inject(DestroyRef);

  variableSelector = viewChild<VariableSelectorComponent>('variableSelector');

  readonly chartTypes = CHART_TYPES;

  loading = signal(true);
  datasetId = signal('');
  departamentoId = signal('');
  datasetInfo = signal<{ id: string; nombre: string; total_registros: number } | null>(null);
  variables = signal<VariableMetadato[]>([]);
  tableData = signal<{ id: number; data: Record<string, any> }[]>([]);
  pagination = signal({ current_page: 1, last_page: 1, per_page: 50, total: 0 });

  selectedChartType = signal<ChartType | null>(null);
  activeCharts = signal<ActiveChart[]>([]);
  addingChart = signal(false);

  // Filters
  activeFilters = signal<ChartFilter[]>([]);

  // Predefined charts & sources
  predefinedCharts = signal<GraficoPredeterminado[]>([]);
  fuentes = signal<DatasetFuente[]>([]);
  showPercentages = signal(false);

  // Columns with unique IDs for mat-table
  visibleColumns = computed<ColumnWithUniqueId[]>(() => {
    const cols = this.variables().filter((v) => v.es_visible);
    return cols.map((v, index) => ({
      ...v,
      _uniqueId: v.id || `col_${index}_${v.nombre_columna}`,
    }));
  });

  // All visible variables are analysable
  analysableVariables = computed(() => this.variables().filter((v) => v.es_visible));

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.route.params.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
        const id = params['id'];
        if (id && id !== this.datasetId()) {
          this.datasetId.set(id);
          this.activeCharts.set([]);
          this.predefinedCharts.set([]);
          this.fuentes.set([]);
          this.loadData();
        }
      });
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

        // Load predefined charts & sources
        this.loadPredefinedCharts();
        this.loadFuentes();
      },
      error: () => this.loading.set(false),
    });
  }

  private loadPredefinedCharts(): void {
    this.categoriaService.getGraficosPredeterminados(this.datasetId()).subscribe({
      next: (charts) => this.predefinedCharts.set(charts || []),
      error: () => {},
    });
  }

  private loadFuentes(): void {
    this.categoriaService.getFuentes(this.datasetId()).subscribe({
      next: (fuentes) => this.fuentes.set(fuentes || []),
      error: () => {},
    });
  }

  onFiltersChange(filters: ChartFilter[]): void {
    this.activeFilters.set(filters);
  }

  togglePercentages(): void {
    this.showPercentages.update((v) => !v);
  }

  onPageChange(event: PageEvent): void {
    this.loadData(event.pageIndex + 1);
  }

  addChart(event: { variableX: VariableMetadato; variableY?: VariableMetadato }): void {
    const type = this.selectedChartType();
    if (!type) return;

    const chartId = `chart-${Date.now()}`;
    const title = event.variableY
      ? `${event.variableX.nombre_original} vs ${event.variableY.nombre_original}`
      : event.variableX.nombre_original;

    const newChart: ActiveChart = {
      id: chartId,
      title,
      chartType: type,
      variableX: event.variableX,
      variableY: event.variableY,
      data: null,
      loading: true,
    };

    this.activeCharts.update((charts) => [...charts, newChart]);
    this.addingChart.set(true);

    if (type.bivariable && event.variableY) {
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
        filters: this.activeFilters().length > 0 ? this.activeFilters() : undefined,
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
        filters: this.activeFilters().length > 0 ? this.activeFilters() : undefined,
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
      case 'TEXTO':
        return this.chartTypes.find((t) => t.id === 'bar');
      default:
        return undefined;
    }
  }

  loadPredefinedChart(pre: GraficoPredeterminado): void {
    const varX = this.variables().find((v) => v.id === pre.variable_x_id);
    if (!varX) return;

    const chartType = this.chartTypes.find((t) => t.id === pre.tipo_grafico);
    if (!chartType) return;

    const varY = pre.variable_y_id
      ? this.variables().find((v) => v.id === pre.variable_y_id)
      : undefined;

    const chart: ActiveChart = {
      id: `pre-${pre.id}`,
      title: pre.titulo,
      chartType,
      variableX: varX,
      variableY: varY,
      data: null,
      loading: true,
    };

    this.activeCharts.update((charts) => [...charts, chart]);
    this.addingChart.set(true);

    if (chartType.bivariable && varY) {
      this.loadBivariableData(chart);
    } else {
      this.loadUnivariableData(chart);
    }
  }
}
