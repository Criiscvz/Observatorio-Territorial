import { CommonModule, isPlatformBrowser } from '@angular/common';
import {
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  OnInit,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { ChartData, GraficoPredeterminado, VariableMetadato } from '@core/models';
import { CategoriaService } from '@core/services/categoria.service';
import { DashboardService } from '@core/services/dashboard.service';
import { BivariableResponse } from '@core/services/interfaces';
import { ChartFilter } from '@core/services/interfaces/stats/univariable-request.interface';
import { ChartCardComponent } from '@shared/components/charts';
import { FrequencyTableComponent } from '@shared/components/frequency-table/frequency-table.component';
import { TextInsightsPanelComponent } from '@shared/components/text-insights-panel/text-insights-panel.component';
import {
  ActiveChart,
  CHART_TYPES,
  ChartType,
  getDefaultBivariableChartType,
  getDefaultUnivariableChartType,
  getUnivariableChartTypes,
} from '@shared/models';

@Component({
  selector: 'app-variable-analysis',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatDividerModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatAutocompleteModule,
    MatTooltipModule,
    MatSnackBarModule,
    TranslateModule,
    ChartCardComponent,
    FrequencyTableComponent,
    TextInsightsPanelComponent,
  ],
  templateUrl: './variable-analysis.component.html',
  styleUrl: './variable-analysis.component.scss',
})
export class VariableAnalysisComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private dashboardService = inject(DashboardService);
  private categoriaService = inject(CategoriaService);
  private snackBar = inject(MatSnackBar);
  private translate = inject(TranslateService);
  private platformId = inject(PLATFORM_ID);
  private destroyRef = inject(DestroyRef);

  /** Whether admin features (save predefined, etc.) are enabled */
  isAdmin = input<boolean>(false);

  /** Route prefix for back navigation */
  routePrefix = input<string>('/publico');

  // State
  loading = signal(true);
  datasetId = signal('');
  variableId = signal('');
  datasetName = signal('');
  departamentoId = signal('');
  totalRecords = signal(0);

  variable = signal<VariableMetadato | null>(null);
  allVariables = signal<VariableMetadato[]>([]);

  // Chart state
  activeCharts = signal<ActiveChart[]>([]);
  predefinedCharts = signal<GraficoPredeterminado[]>([]);

  // Frequency data
  frequencyLabels = signal<string[]>([]);
  frequencyValues = signal<number[]>([]);
  numericStats = signal<Record<string, number> | null>(null);

  // Filter by value
  selectedValue = signal<string | null>(null);
  activeFilters = signal<ChartFilter[]>([]);

  // Cross-variable
  crossVariable = signal<VariableMetadato | null>(null);
  crossSearchTerm = signal('');
  crossCharts = signal<ActiveChart[]>([]);

  // Compact chart selector
  showChartSelector = signal(false);
  selectedAdditionalType = signal<ChartType | null>(null);

  readonly chartTypes = CHART_TYPES;

  // Options for the selected variable (for filter chips)
  valueOptions = computed(() => {
    const v = this.variable();
    if (v?.tipo_dato === 'CATEGORICO' || v?.tipo_dato === 'TEXTO') {
      // Use labels from frequency data, or fallback to opciones
      const labels = this.frequencyLabels();
      if (labels.length > 0) return labels;
      return v.opciones || [];
    }
    return [];
  });

  // Compatible chart types for adding more charts
  compatibleChartTypes = computed(() => {
    const v = this.variable();
    if (!v) return [];
    return getUnivariableChartTypes(v.tipo_dato);
  });

  // Whether this is a TEXT variable (shows NLP insights panel)
  isTextVariable = computed(() => this.variable()?.tipo_dato === 'TEXTO');

  // Other variables for cross-analysis
  crossableVariables = computed(() => {
    const current = this.variable();
    if (!current) return [];
    return this.allVariables().filter((v) => v.id !== current.id && v.es_visible);
  });

  filteredCrossVariables = computed(() => {
    const search = this.crossSearchTerm().toLowerCase().trim();
    const vars = this.crossableVariables();
    if (!search) return vars;
    return vars.filter(
      (v) =>
        v.nombre_columna.toLowerCase().includes(search) ||
        v.nombre_original.toLowerCase().includes(search),
    );
  });

  // Back route
  backRoute = computed(() => {
    const prefix = this.routePrefix();
    const isAdm = this.isAdmin();
    if (isAdm) {
      return ['/admin/datasets', this.datasetId()];
    }
    return [prefix + '/datasets', this.datasetId()];
  });

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) {
      this.loading.set(false);
      return;
    }

    this.route.params.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const datasetId = params['id'];
      const variableId = params['variableId'];

      if (datasetId && variableId) {
        this.datasetId.set(datasetId);
        this.variableId.set(variableId);
        this.loadData();
      }
    });
  }

  private loadData(): void {
    this.loading.set(true);

    const fetchFn = this.isAdmin()
      ? this.dashboardService.getDatasetData(this.datasetId(), 1, 1)
      : this.dashboardService.getPublicDatasetData(this.datasetId(), 1, 1);

    fetchFn.subscribe({
      next: (res) => {
        this.datasetName.set(res.dataset?.nombre || '');
        this.totalRecords.set(res.dataset?.total_registros || 0);
        if (res.dataset?.departamento_id) {
          this.departamentoId.set(res.dataset.departamento_id);
        }
        this.allVariables.set(res.variables || []);

        const variable = (res.variables || []).find((v) => v.id === this.variableId());
        if (variable) {
          this.variable.set(variable);
          this.loading.set(false);
          this.generateAutoCharts();
          this.loadPredefinedCharts();
        } else {
          this.loading.set(false);
        }
      },
      error: () => this.loading.set(false),
    });
  }

  /** Generate default charts automatically based on variable type */
  private generateAutoCharts(): void {
    const v = this.variable();
    if (!v) return;

    const defaultType = getDefaultUnivariableChartType(v.tipo_dato);
    if (!defaultType) return;

    // First chart: default type (bar for CATEGORICO, histogram for NUMERICO, etc.)
    this.addAutoChart(v, defaultType);

    // Second chart: complementary type
    let secondType: ChartType | undefined;
    switch (v.tipo_dato) {
      case 'CATEGORICO':
        secondType = CHART_TYPES.find((t) => t.id === 'pie');
        break;
      case 'NUMERICO':
        secondType = CHART_TYPES.find((t) => t.id === 'line');
        break;
      case 'FECHA':
        secondType = CHART_TYPES.find((t) => t.id === 'area');
        break;
      case 'TEXTO':
        secondType = CHART_TYPES.find((t) => t.id === 'bar');
        break;
    }
    if (secondType && secondType.id !== defaultType.id) {
      this.addAutoChart(v, secondType);
    }
  }

  private addAutoChart(variable: VariableMetadato, chartType: ChartType): void {
    const chart: ActiveChart = {
      id: `auto-${chartType.id}-${Date.now()}`,
      title: variable.nombre_original || variable.nombre_columna,
      chartType,
      variableX: variable,
      data: null,
      loading: true,
    };
    this.activeCharts.update((charts) => [...charts, chart]);
    this.loadUnivariableData(chart);
  }

  private loadUnivariableData(chart: ActiveChart): void {
    const statsFn = this.isAdmin()
      ? this.dashboardService.getUnivariableStats.bind(this.dashboardService)
      : this.dashboardService.getPublicUnivariableStats.bind(this.dashboardService);

    statsFn({
      dataset_id: this.datasetId(),
      variable_id: chart.variableX.id,
      chart_type: chart.chartType.id,
      filters: this.activeFilters().length > 0 ? this.activeFilters() : undefined,
    }).subscribe({
      next: (res) => {
        const chartData: ChartData = {
          variable: res.nombre_variable,
          tipo:
            chart.variableX.tipo_dato === 'NUMERICO'
              ? 'numeric'
              : chart.variableX.tipo_dato === 'FECHA'
                ? 'date'
                : 'categorical',
          chart_type: res.chart_type as ChartData['chart_type'],
          data: { labels: res.data?.labels || [], values: res.data?.values || [] },
          stats: res.stats,
        };
        this.updateChartData(chart.id, chartData);

        // Update frequency table data from the first chart response (use the default/bar chart)
        if (this.frequencyLabels().length === 0 && res.data?.labels?.length) {
          this.frequencyLabels.set(res.data.labels);
          this.frequencyValues.set(res.data.values || []);
        }

        // Store numeric stats
        if (res.stats && chart.variableX.tipo_dato === 'NUMERICO') {
          this.numericStats.set(res.stats);
        }
      },
      error: () => this.updateChartData(chart.id, null),
    });
  }

  private loadBivariableData(chart: ActiveChart): void {
    if (!chart.variableY) return;

    const statsFn = this.isAdmin()
      ? this.dashboardService.getBivariableStats.bind(this.dashboardService)
      : this.dashboardService.getPublicBivariableStats.bind(this.dashboardService);

    statsFn({
      dataset_id: this.datasetId(),
      variable_x_id: chart.variableX.id,
      variable_y_id: chart.variableY.id,
      chart_type: chart.chartType.id,
      filters: this.activeFilters().length > 0 ? this.activeFilters() : undefined,
    }).subscribe({
      next: (res) => this.updateCrossChartData(chart.id, res),
      error: () => this.updateCrossChartData(chart.id, null),
    });
  }

  private updateChartData(chartId: string, data: ChartData | null): void {
    this.activeCharts.update((charts) =>
      charts.map((c) => (c.id === chartId ? { ...c, data, loading: false } : c)),
    );
  }

  private updateCrossChartData(chartId: string, data: BivariableResponse | null): void {
    this.crossCharts.update((charts) =>
      charts.map((c) => (c.id === chartId ? { ...c, data, loading: false } : c)),
    );
  }

  /** Called when user clicks a value chip to filter */
  selectValueFilter(value: string | null): void {
    this.selectedValue.set(value);

    if (value) {
      const v = this.variable();
      this.activeFilters.set([
        {
          column: v?.nombre_columna || '',
          operator: 'eq',
          value: value,
          type: v?.tipo_dato,
        },
      ]);
    } else {
      this.activeFilters.set([]);
    }

    // Reload all charts with new filter
    this.reloadAllCharts();
  }

  private reloadAllCharts(): void {
    // Reload univariable charts
    const charts = this.activeCharts();
    charts.forEach((chart) => {
      this.activeCharts.update((all) =>
        all.map((c) => (c.id === chart.id ? { ...c, loading: true } : c)),
      );
      this.loadUnivariableData(chart);
    });

    // Reload frequency table
    this.frequencyLabels.set([]);
    this.frequencyValues.set([]);

    // Reload cross charts
    const cross = this.crossCharts();
    cross.forEach((chart) => {
      this.crossCharts.update((all) =>
        all.map((c) => (c.id === chart.id ? { ...c, loading: true } : c)),
      );
      this.loadBivariableData(chart);
    });
  }

  /** Select a cross-variable for bivariable analysis */
  selectCrossVariable(variable: VariableMetadato): void {
    this.crossVariable.set(variable);
    this.crossCharts.set([]);

    const v = this.variable();
    if (!v) return;

    const defaultType = getDefaultBivariableChartType(v.tipo_dato, variable.tipo_dato);
    if (!defaultType) return;

    const chart: ActiveChart = {
      id: `cross-${defaultType.id}-${Date.now()}`,
      title: `${v.nombre_original} vs ${variable.nombre_original}`,
      chartType: defaultType,
      variableX: v,
      variableY: variable,
      data: null,
      loading: true,
    };

    this.crossCharts.set([chart]);
    this.loadBivariableData(chart);
  }

  clearCrossVariable(): void {
    this.crossVariable.set(null);
    this.crossCharts.set([]);
    this.crossSearchTerm.set('');
  }

  /** Add an additional chart with a specific type */
  addAdditionalChart(chartType: ChartType): void {
    const v = this.variable();
    if (!v) return;

    const chart: ActiveChart = {
      id: `extra-${chartType.id}-${Date.now()}`,
      title: v.nombre_original || v.nombre_columna,
      chartType,
      variableX: v,
      data: null,
      loading: true,
    };
    this.activeCharts.update((charts) => [...charts, chart]);
    this.loadUnivariableData(chart);
    this.showChartSelector.set(false);
  }

  removeChart(chartId: string): void {
    this.activeCharts.update((charts) => charts.filter((c) => c.id !== chartId));
  }

  removeCrossChart(chartId: string): void {
    this.crossCharts.update((charts) => charts.filter((c) => c.id !== chartId));
  }

  onChartFiltersChange(event: { chartId: string; filters: ChartFilter[] }): void {
    this.activeCharts.update((charts) =>
      charts.map((c) =>
        c.id === event.chartId ? { ...c, filters: event.filters, loading: true } : c,
      ),
    );
    const chart = this.activeCharts().find((c) => c.id === event.chartId);
    if (chart) this.loadUnivariableData(chart);
  }

  /** Load predefined charts matching this variable */
  private loadPredefinedCharts(): void {
    this.categoriaService.getGraficosPredeterminados(this.datasetId()).subscribe({
      next: (charts) => {
        const matching = (charts || []).filter((c) => c.variable_x_id === this.variableId());
        this.predefinedCharts.set(matching);
      },
      error: () => {},
    });
  }

  loadPredefinedChart(pre: GraficoPredeterminado): void {
    const varX = this.variable();
    if (!varX) return;

    const chartType = this.chartTypes.find((t) => t.id === pre.tipo_grafico);
    if (!chartType) return;

    if (pre.tipo_analisis === 'bivariable' && pre.variable_y_id) {
      const varY = this.allVariables().find((v) => v.id === pre.variable_y_id);
      if (!varY) return;

      const chart: ActiveChart = {
        id: `pre-${pre.id}`,
        title: pre.titulo,
        description: pre.descripcion,
        analisis: pre.analisis,
        chartType,
        variableX: varX,
        variableY: varY,
        data: null,
        loading: true,
      };
      this.crossCharts.update((charts) => [...charts, chart]);
      this.loadBivariableData(chart);
    } else {
      const chart: ActiveChart = {
        id: `pre-${pre.id}`,
        title: pre.titulo,
        description: pre.descripcion,
        analisis: pre.analisis,
        chartType,
        variableX: varX,
        data: null,
        loading: true,
      };
      this.activeCharts.update((charts) => [...charts, chart]);
      this.loadUnivariableData(chart);
    }
  }

  /** Save current chart as predefined (admin only) */
  saveChartAsPredefined(chart: ActiveChart): void {
    this.categoriaService
      .createGraficoPredeterminado(this.datasetId(), {
        titulo: chart.title,
        tipo_grafico: chart.chartType.id,
        tipo_analisis: chart.variableY ? 'bivariable' : 'univariable',
        variable_x_id: chart.variableX.id,
        variable_y_id: chart.variableY?.id,
        orden: this.predefinedCharts().length,
        activo: true,
      })
      .subscribe({
        next: () => {
          this.snackBar.open(
            this.translate.instant('variableAnalysis.chartSaved'),
            this.translate.instant('common.buttons.close'),
            { duration: 3000 },
          );
          this.loadPredefinedCharts();
        },
        error: () => {
          this.snackBar.open(
            this.translate.instant('common.messages.error'),
            this.translate.instant('common.buttons.close'),
            { duration: 3000 },
          );
        },
      });
  }

  getTypeIcon(tipo: string): string {
    switch (tipo) {
      case 'NUMERICO':
        return 'tag';
      case 'CATEGORICO':
        return 'category';
      case 'FECHA':
        return 'calendar_today';
      case 'TEXTO':
        return 'text_fields';
      default:
        return 'help_outline';
    }
  }
}
