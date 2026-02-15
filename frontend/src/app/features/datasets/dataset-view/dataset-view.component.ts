import { CommonModule } from '@angular/common';
import { Component, computed, ElementRef, inject, OnInit, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { ChartData, DatasetFuente, GraficoPredeterminado, VariableMetadato } from '@core/models';
import { CategoriaService } from '@core/services/categoria.service';
import { DashboardService } from '@core/services/dashboard.service';
import { DatasetService } from '@core/services/dataset.service';
import { BivariableResponse } from '@core/services/interfaces';
import { ChartFilter } from '@core/services/interfaces/stats/univariable-request.interface';
import {
  ChartFiltersComponent,
  ChartsGridComponent,
  ChartTypeSelectorComponent,
  VariableSelectorComponent,
} from '@shared/components/charts';
import { ActiveChart, CHART_TYPES, ChartType, ColumnWithUniqueId } from '@shared/models';

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
    MatDividerModule,
    TranslateModule,
    ChartTypeSelectorComponent,
    VariableSelectorComponent,
    ChartFiltersComponent,
    ChartsGridComponent,
  ],
  templateUrl: './dataset-view.component.html',
  styleUrl: './dataset-view.component.scss',
})
export class DatasetViewComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly datasetService = inject(DatasetService);
  private readonly dashboardService = inject(DashboardService);
  private readonly categoriaService = inject(CategoriaService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly translate = inject(TranslateService);

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

  // Gráficos - shared components
  selectedChartType = signal<ChartType | null>(null);
  activeCharts = signal<ActiveChart[]>([]);
  addingChart = signal(false);

  // Filtros
  activeFilters = signal<ChartFilter[]>([]);

  // Predefined charts & sources
  predefinedCharts = signal<GraficoPredeterminado[]>([]);
  fuentes = signal<DatasetFuente[]>([]);

  // Sources form
  showSourceForm = signal(false);
  editingSource = signal<DatasetFuente | null>(null);
  sourceForm = signal({ titulo: '', url: '', descripcion: '' });

  // Predefined chart form
  showPredefinedForm = signal(false);
  predefinedForm = signal({ titulo: '', descripcion: '' });

  // Computed
  visibleColumns = computed<ColumnWithUniqueId[]>(() => {
    const vars = this.variables();
    const visible = vars.filter((v) => v.es_visible);
    const columns = visible.length > 0 ? visible : vars;
    return columns.map((col, index) => ({
      ...col,
      _uniqueId: `col_${index}_${col.nombre_columna}`,
    }));
  });
  columnNames = computed(() => this.visibleColumns().map((v) => v._uniqueId));
  analysableVariables = computed(() => this.variables().filter((v) => v.es_visible));

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
            this.datasetInfo.set(res.dataset);
            if (res.dataset.departamento_id) {
              this.departamentoId.set(res.dataset.departamento_id);
            }
            this.loading.set(false);
          },
        });

        // Load predefined charts & fuentes
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

  onPageChange(event: PageEvent): void {
    this.loadData(event.pageIndex + 1);
  }

  scrollTableLeft(): void {
    const container = this.tableScrollContainer()?.nativeElement;
    if (container) {
      container.scrollBy({ left: -300, behavior: 'smooth' });
    }
  }

  scrollTableRight(): void {
    const container = this.tableScrollContainer()?.nativeElement;
    if (container) {
      container.scrollBy({ left: 300, behavior: 'smooth' });
    }
  }

  onTableScroll(): void {
    const container = this.tableScrollContainer()?.nativeElement;
    if (container) {
      this.canScrollLeft = container.scrollLeft > 0;
      this.canScrollRight =
        container.scrollLeft < container.scrollWidth - container.clientWidth - 5;
    }
  }

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

  // =========== CHART MANAGEMENT (shared components) ===========

  onFiltersChange(filters: ChartFilter[]): void {
    this.activeFilters.set(filters);
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
      .getUnivariableStats({
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
            data: {
              labels: res.data?.labels || [],
              values: res.data?.values || [],
            },
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
      .getBivariableStats({
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
    const variables = this.analysableVariables();
    this.addingChart.set(true);

    variables.forEach((variable, index) => {
      setTimeout(() => {
        const type = this.getDefaultChartType(variable.tipo_dato);
        if (!type) return;

        const chart: ActiveChart = {
          id: `chart-auto-${Date.now()}-${index}`,
          title: variable.nombre_original,
          chartType: type,
          variableX: variable,
          data: null,
          loading: true,
        };

        this.activeCharts.update((charts) => [...charts, chart]);
        this.loadUnivariableData(chart);
      }, index * 100);
    });
  }

  private getDefaultChartType(tipoDato: string): ChartType | undefined {
    switch (tipoDato) {
      case 'CATEGORICO':
      case 'TEXTO':
        return this.chartTypes.find((t) => t.id === 'bar');
      case 'NUMERICO':
        return this.chartTypes.find((t) => t.id === 'histogram');
      case 'FECHA':
        return this.chartTypes.find((t) => t.id === 'line');
      default:
        return undefined;
    }
  }

  // =========== PREDEFINED CHARTS ===========

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

  saveChartAsPredefined(chart: ActiveChart): void {
    this.predefinedForm.set({ titulo: chart.title, descripcion: '' });
    this.showPredefinedForm.set(true);

    // Store the chart reference temporarily
    (this as any)._savingChart = chart;
  }

  confirmSavePredefined(): void {
    const chart = (this as any)._savingChart as ActiveChart;
    if (!chart) return;

    const form = this.predefinedForm();

    this.categoriaService
      .createGraficoPredeterminado(this.datasetId(), {
        titulo: form.titulo,
        descripcion: form.descripcion || undefined,
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
            this.translate.instant('datasets.view.analysis.chartSaved'),
            this.translate.instant('common.buttons.close'),
            { duration: 3000 },
          );
          this.showPredefinedForm.set(false);
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

  deletePredefinedChart(pre: GraficoPredeterminado): void {
    if (confirm(this.translate.instant('charts.predefined.confirmDelete'))) {
      this.categoriaService.deleteGraficoPredeterminado(pre.id).subscribe({
        next: () => {
          this.snackBar.open(
            this.translate.instant('datasets.view.analysis.chartDeleted'),
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
  }

  cancelPredefinedForm(): void {
    this.showPredefinedForm.set(false);
    (this as any)._savingChart = null;
  }

  // =========== SOURCES MANAGEMENT ===========

  openSourceForm(source?: DatasetFuente): void {
    if (source) {
      this.editingSource.set(source);
      this.sourceForm.set({
        titulo: source.titulo,
        url: source.url,
        descripcion: source.descripcion || '',
      });
    } else {
      this.editingSource.set(null);
      this.sourceForm.set({ titulo: '', url: '', descripcion: '' });
    }
    this.showSourceForm.set(true);
  }

  closeSourceForm(): void {
    this.showSourceForm.set(false);
    this.editingSource.set(null);
  }

  saveSource(): void {
    const form = this.sourceForm();
    if (!form.titulo || !form.url) return;

    const editing = this.editingSource();

    const obs = editing
      ? this.categoriaService.updateFuente(editing.id, form)
      : this.categoriaService.createFuente(this.datasetId(), form);

    obs.subscribe({
      next: () => {
        this.snackBar.open(
          this.translate.instant('datasets.view.sources.sourceAdded'),
          this.translate.instant('common.buttons.close'),
          { duration: 3000 },
        );
        this.closeSourceForm();
        this.loadFuentes();
      },
      error: () => {
        this.snackBar.open(
          this.translate.instant('datasets.view.sources.sourceError'),
          this.translate.instant('common.buttons.close'),
          { duration: 3000 },
        );
      },
    });
  }

  deleteSource(source: DatasetFuente): void {
    if (confirm(this.translate.instant('common.messages.confirmDelete'))) {
      this.categoriaService.deleteFuente(source.id).subscribe({
        next: () => {
          this.snackBar.open(
            this.translate.instant('datasets.view.sources.sourceDeleted'),
            this.translate.instant('common.buttons.close'),
            { duration: 3000 },
          );
          this.loadFuentes();
        },
        error: () => {
          this.snackBar.open(
            this.translate.instant('datasets.view.sources.sourceError'),
            this.translate.instant('common.buttons.close'),
            { duration: 3000 },
          );
        },
      });
    }
  }

  // =========== VARIABLES ===========

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
}
