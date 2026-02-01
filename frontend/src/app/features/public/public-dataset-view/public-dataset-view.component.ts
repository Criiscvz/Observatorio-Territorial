import { Component, computed, inject, OnInit, signal, viewChild, PLATFORM_ID} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTabsModule } from '@angular/material/tabs';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { ChartData, VariableMetadato } from '@core/models';
import { DashboardService } from '@core/services/dashboard.service';
import { BivariableResponse } from '@core/services/interfaces';
import {
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
    TranslateModule,
    ChartTypeSelectorComponent,
    VariableSelectorComponent,
    ChartsGridComponent,
    DataTableComponent,
  ],
  templateUrl: './public-dataset-view.component.html',
  styleUrl: './public-dataset-view.component.scss',
})
export class PublicDatasetViewComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private dashboardService = inject(DashboardService);

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
}
