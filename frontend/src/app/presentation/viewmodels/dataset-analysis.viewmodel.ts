import { Injectable, inject, signal, computed } from '@angular/core';
import { 
  GetUnivariableStatsUseCase, 
  GetBivariableStatsUseCase 
} from '../../core/domain/usecases/chart';
import { GetDatasetDataUseCase } from '../../core/domain/usecases/dataset';
import { DatasetRepository } from '../../core/domain/repositories';
import { 
  ChartEntity, 
  ChartType, 
  DatasetEntity, 
  VariableMetadatoEntity,
  DatasetDataResponse,
  BivariableResponse
} from '../../core/domain/entities';

export interface ActiveChart {
  id: string;
  type: 'univariable' | 'bivariable';
  chartType: ChartType;
  variableX: VariableMetadatoEntity;
  variableY?: VariableMetadatoEntity;
  data: ChartEntity | BivariableResponse;
  isLoading: boolean;
}

export interface ChartTypeOption {
  id: ChartType;
  name: string;
  icon: string;
  description: string;
  forTypes: string[];
  bivariable: boolean;
}

@Injectable({ providedIn: 'root' })
export class DatasetAnalysisViewModel {
  private readonly getUnivariableStats = inject(GetUnivariableStatsUseCase);
  private readonly getBivariableStats = inject(GetBivariableStatsUseCase);
  private readonly getDatasetData = inject(GetDatasetDataUseCase);
  private readonly datasetRepository = inject(DatasetRepository);

  // State
  readonly dataset = signal<DatasetEntity | null>(null);
  readonly dataRecords = signal<DatasetDataResponse | null>(null);
  readonly activeCharts = signal<ActiveChart[]>([]);
  readonly selectedChartType = signal<ChartTypeOption | null>(null);
  readonly selectedVariableX = signal<VariableMetadatoEntity | null>(null);
  readonly selectedVariableY = signal<VariableMetadatoEntity | null>(null);
  readonly isLoading = signal(false);
  readonly error = signal<string | null>(null);

  // Chart type options
  readonly chartTypes: ChartTypeOption[] = [
    { id: 'bar', name: 'Barras', icon: 'bar_chart', description: 'Comparación de categorías', forTypes: ['CATEGORICO', 'TEXTO'], bivariable: false },
    { id: 'pie', name: 'Pastel', icon: 'pie_chart', description: 'Distribución porcentual', forTypes: ['CATEGORICO'], bivariable: false },
    { id: 'donut', name: 'Dona', icon: 'donut_large', description: 'Distribución circular', forTypes: ['CATEGORICO'], bivariable: false },
    { id: 'line', name: 'Líneas', icon: 'show_chart', description: 'Tendencias temporales', forTypes: ['FECHA', 'NUMERICO'], bivariable: false },
    { id: 'histogram', name: 'Histograma', icon: 'equalizer', description: 'Distribución numérica', forTypes: ['NUMERICO'], bivariable: false },
    { id: 'scatter', name: 'Dispersión', icon: 'scatter_plot', description: 'Correlación entre variables', forTypes: ['NUMERICO'], bivariable: true },
    { id: 'grouped_bar', name: 'Barras Agrupadas', icon: 'stacked_bar_chart', description: 'Comparación por grupos', forTypes: ['CATEGORICO', 'NUMERICO'], bivariable: true },
    { id: 'heatmap', name: 'Mapa de Calor', icon: 'grid_on', description: 'Tabla de contingencia', forTypes: ['CATEGORICO'], bivariable: true },
  ];

  // Computed
  readonly variables = computed(() => this.dataset()?.variables_metadatos || []);
  
  readonly numericVariables = computed(() => 
    this.variables().filter(v => v.tipo_dato === 'NUMERICO')
  );
  
  readonly categoricVariables = computed(() => 
    this.variables().filter(v => v.tipo_dato === 'CATEGORICO' || v.tipo_dato === 'TEXTO')
  );

  readonly availableChartTypes = computed(() => {
    const varX = this.selectedVariableX();
    const chartType = this.selectedChartType();
    
    if (!varX) return this.chartTypes.filter(ct => !ct.bivariable);
    
    return this.chartTypes.filter(ct => {
      if (chartType?.bivariable && !ct.bivariable) return false;
      return ct.forTypes.includes(varX.tipo_dato);
    });
  });

  loadDataset(id: string): void {
    this.isLoading.set(true);
    this.datasetRepository.getById(id).subscribe({
      next: (dataset) => {
        this.dataset.set(dataset);
        this.isLoading.set(false);
      },
      error: (err) => {
        this.error.set(err.error?.message || 'Error al cargar dataset');
        this.isLoading.set(false);
      },
    });
  }

  loadDataRecords(page = 1, perPage = 50): void {
    const dataset = this.dataset();
    if (!dataset) return;

    this.getDatasetData.execute(dataset.id, page, perPage).subscribe({
      next: (data) => this.dataRecords.set(data),
      error: (err) => this.error.set(err.error?.message || 'Error al cargar datos'),
    });
  }

  selectChartType(type: ChartTypeOption): void {
    this.selectedChartType.set(type);
    if (!type.bivariable) {
      this.selectedVariableY.set(null);
    }
  }

  addChart(): void {
    const chartType = this.selectedChartType();
    const varX = this.selectedVariableX();
    const dataset = this.dataset();

    if (!chartType || !varX || !dataset) return;

    const chartId = `chart-${Date.now()}`;
    const newChart: ActiveChart = {
      id: chartId,
      type: chartType.bivariable ? 'bivariable' : 'univariable',
      chartType: chartType.id,
      variableX: varX,
      variableY: this.selectedVariableY() || undefined,
      data: {} as ChartEntity,
      isLoading: true,
    };

    this.activeCharts.update(charts => [...charts, newChart]);

    if (chartType.bivariable && this.selectedVariableY()) {
      this.loadBivariableChart(chartId, dataset.id, varX.id, this.selectedVariableY()!.id, chartType.id);
    } else {
      this.loadUnivariableChart(chartId, dataset.id, varX.id, chartType.id);
    }

    // Reset selection
    this.selectedChartType.set(null);
    this.selectedVariableX.set(null);
    this.selectedVariableY.set(null);
  }

  private loadUnivariableChart(chartId: string, datasetId: string, variableId: string, chartType: ChartType): void {
    this.getUnivariableStats.execute({
      dataset_id: datasetId,
      variable_id: variableId,
      chart_type: chartType,
    }).subscribe({
      next: (data) => {
        this.activeCharts.update(charts => 
          charts.map(c => c.id === chartId ? { ...c, data, isLoading: false } : c)
        );
      },
      error: () => {
        this.activeCharts.update(charts => charts.filter(c => c.id !== chartId));
      },
    });
  }

  private loadBivariableChart(chartId: string, datasetId: string, varXId: string, varYId: string, chartType: ChartType): void {
    this.getBivariableStats.execute({
      dataset_id: datasetId,
      variable_x_id: varXId,
      variable_y_id: varYId,
      chart_type: chartType,
    }).subscribe({
      next: (data) => {
        this.activeCharts.update(charts => 
          charts.map(c => c.id === chartId ? { ...c, data, isLoading: false } : c)
        );
      },
      error: () => {
        this.activeCharts.update(charts => charts.filter(c => c.id !== chartId));
      },
    });
  }

  removeChart(chartId: string): void {
    this.activeCharts.update(charts => charts.filter(c => c.id !== chartId));
  }

  clearAllCharts(): void {
    this.activeCharts.set([]);
  }

  addAllUnivariateCharts(): void {
    const dataset = this.dataset();
    if (!dataset) return;

    this.variables().forEach(variable => {
      const defaultType = this.getDefaultChartType(variable.tipo_dato);
      const chartId = `chart-${Date.now()}-${variable.id}`;
      
      const newChart: ActiveChart = {
        id: chartId,
        type: 'univariable',
        chartType: defaultType,
        variableX: variable,
        data: {} as ChartEntity,
        isLoading: true,
      };

      this.activeCharts.update(charts => [...charts, newChart]);
      this.loadUnivariableChart(chartId, dataset.id, variable.id, defaultType);
    });
  }

  private getDefaultChartType(tipoDato: string): ChartType {
    switch (tipoDato) {
      case 'NUMERICO': return 'histogram';
      case 'CATEGORICO': return 'pie';
      case 'FECHA': return 'line';
      default: return 'bar';
    }
  }
}
