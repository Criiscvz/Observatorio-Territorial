import { ChartData, VariableMetadato } from '@core/models';
import { BivariableResponse } from '@core/services/interfaces';

export type DataType = 'NUMERICO' | 'CATEGORICO' | 'FECHA' | 'TEXTO';

export interface ChartType {
  id: string;
  name: string;
  icon: string;
  description: string;
  forTypes: DataType[];
  bivariable?: boolean;
}

export interface ActiveChart {
  id: string;
  title: string;
  chartType: ChartType;
  variableX: VariableMetadato;
  variableY?: VariableMetadato;
  data: ChartData | BivariableResponse | null;
  loading: boolean;
}

export interface ColumnWithUniqueId extends VariableMetadato {
  _uniqueId: string;
}

export const CHART_TYPES: ChartType[] = [
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
