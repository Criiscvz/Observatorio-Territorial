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

/**
 * Filtra los tipos de gráficos univariables según el tipo de dato
 */
export function getUnivariableChartTypes(tipoDato: DataType): ChartType[] {
  // Normalizar TEXTO a CATEGORICO
  const normalizedType = tipoDato === 'TEXTO' ? 'CATEGORICO' : tipoDato;
  return CHART_TYPES.filter(
    (chart) => !chart.bivariable && chart.forTypes.includes(normalizedType)
  );
}

/**
 * Filtra los tipos de gráficos bivariables según los tipos de datos de ambas variables
 */
export function getBivariableChartTypes(tipoX: DataType, tipoY: DataType): ChartType[] {
  // Normalizar TEXTO a CATEGORICO
  const normX = tipoX === 'TEXTO' ? 'CATEGORICO' : tipoX;
  const normY = tipoY === 'TEXTO' ? 'CATEGORICO' : tipoY;

  return CHART_TYPES.filter((chart) => {
    if (!chart.bivariable) return false;

    // Scatter: ambas numéricas
    if (chart.id === 'scatter') {
      return normX === 'NUMERICO' && normY === 'NUMERICO';
    }

    // Grouped bar / box_compare: una categórica y una numérica
    if (chart.id === 'grouped_bar' || chart.id === 'box_compare') {
      return (
        (normX === 'CATEGORICO' && normY === 'NUMERICO') ||
        (normX === 'NUMERICO' && normY === 'CATEGORICO')
      );
    }

    // Heatmap: ambas categóricas
    if (chart.id === 'heatmap') {
      return normX === 'CATEGORICO' && normY === 'CATEGORICO';
    }

    // Line time: fecha + numérica
    if (chart.id === 'line_time') {
      return (
        (normX === 'FECHA' && normY === 'NUMERICO') ||
        (normX === 'NUMERICO' && normY === 'FECHA')
      );
    }

    // Stacked bar: fecha + categórica
    if (chart.id === 'stacked_bar') {
      return (
        (normX === 'FECHA' && normY === 'CATEGORICO') ||
        (normX === 'CATEGORICO' && normY === 'FECHA')
      );
    }

    return false;
  });
}

/**
 * Obtiene el tipo de gráfico por defecto según el tipo de dato
 */
export function getDefaultUnivariableChartType(tipoDato: DataType): ChartType | undefined {
  const normalizedType = tipoDato === 'TEXTO' ? 'CATEGORICO' : tipoDato;
  
  switch (normalizedType) {
    case 'NUMERICO':
      return CHART_TYPES.find((t) => t.id === 'histogram');
    case 'CATEGORICO':
      return CHART_TYPES.find((t) => t.id === 'bar');
    case 'FECHA':
      return CHART_TYPES.find((t) => t.id === 'line');
    default:
      return CHART_TYPES.find((t) => t.id === 'bar');
  }
}

/**
 * Obtiene el tipo de gráfico bivariable por defecto según los tipos de datos
 */
export function getDefaultBivariableChartType(tipoX: DataType, tipoY: DataType): ChartType | undefined {
  const normX = tipoX === 'TEXTO' ? 'CATEGORICO' : tipoX;
  const normY = tipoY === 'TEXTO' ? 'CATEGORICO' : tipoY;

  if (normX === 'NUMERICO' && normY === 'NUMERICO') {
    return CHART_TYPES.find((t) => t.id === 'scatter');
  }

  if ((normX === 'CATEGORICO' && normY === 'NUMERICO') ||
      (normX === 'NUMERICO' && normY === 'CATEGORICO')) {
    return CHART_TYPES.find((t) => t.id === 'grouped_bar');
  }

  if (normX === 'CATEGORICO' && normY === 'CATEGORICO') {
    return CHART_TYPES.find((t) => t.id === 'heatmap');
  }

  if ((normX === 'FECHA' && normY === 'NUMERICO') ||
      (normX === 'NUMERICO' && normY === 'FECHA')) {
    return CHART_TYPES.find((t) => t.id === 'line_time');
  }

  if ((normX === 'FECHA' && normY === 'CATEGORICO') ||
      (normX === 'CATEGORICO' && normY === 'FECHA')) {
    return CHART_TYPES.find((t) => t.id === 'stacked_bar');
  }

  return undefined;
}
