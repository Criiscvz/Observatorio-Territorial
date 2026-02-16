import { ChartData, VariableMetadato } from '@core/models';
import { BivariableResponse } from '@core/services/interfaces';
import { ChartFilter } from '@core/services/interfaces/stats/univariable-request.interface';

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
  filters?: ChartFilter[];
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
    forTypes: ['CATEGORICO', 'TEXTO'],
  },
  {
    id: 'treemap',
    name: 'Treemap',
    icon: 'grid_view',
    description: 'Jerarquía',
    forTypes: ['CATEGORICO', 'TEXTO'],
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
  {
    id: 'wordcloud',
    name: 'Nube de Palabras',
    icon: 'cloud',
    description: 'Frecuencia de texto',
    forTypes: ['TEXTO', 'CATEGORICO'],
  },
  {
    id: 'horizontal_bar',
    name: 'Barras Horizontales',
    icon: 'align_horizontal_left',
    description: 'Categorías con etiquetas largas',
    forTypes: ['CATEGORICO', 'TEXTO'],
  },
  {
    id: 'rose',
    name: 'Rosa de Nightingale',
    icon: 'flare',
    description: 'Proporciones polares',
    forTypes: ['CATEGORICO'],
  },
  {
    id: 'polar_bar',
    name: 'Barras Polares',
    icon: 'track_changes',
    description: 'Barras circulares',
    forTypes: ['CATEGORICO'],
  },
  {
    id: 'pictorial_bar',
    name: 'Barras Pictóricas',
    icon: 'insert_chart',
    description: 'Barras decorativas',
    forTypes: ['CATEGORICO', 'NUMERICO'],
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
  {
    id: 'bubble',
    name: 'Burbujas',
    icon: 'bubble_chart',
    description: 'Dispersión con tamaño',
    forTypes: ['NUMERICO'],
    bivariable: true,
  },
  {
    id: 'stacked_area',
    name: 'Área Apilada',
    icon: 'stacked_line_chart',
    description: 'Tendencias apiladas',
    forTypes: ['FECHA', 'CATEGORICO'],
    bivariable: true,
  },
];

/**
 * Filtra los tipos de gráficos univariables según el tipo de dato
 */
export function getUnivariableChartTypes(tipoDato: DataType): ChartType[] {
  // For TEXTO, show only chart types that explicitly list TEXTO in forTypes
  // (wordcloud, bar, horizontal_bar, treemap, funnel)
  // For other types, filter normally
  return CHART_TYPES.filter((chart) => !chart.bivariable && chart.forTypes.includes(tipoDato));
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

    // Bubble: ambas numéricas (dispersión con tamaño)
    if (chart.id === 'bubble') {
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
        (normX === 'FECHA' && normY === 'NUMERICO') || (normX === 'NUMERICO' && normY === 'FECHA')
      );
    }

    // Stacked bar: fecha + categórica
    if (chart.id === 'stacked_bar') {
      return (
        (normX === 'FECHA' && normY === 'CATEGORICO') ||
        (normX === 'CATEGORICO' && normY === 'FECHA')
      );
    }

    // Stacked area: fecha + categórica (mismo patrón que stacked bar)
    if (chart.id === 'stacked_area') {
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
  switch (tipoDato) {
    case 'NUMERICO':
      return CHART_TYPES.find((t) => t.id === 'histogram');
    case 'CATEGORICO':
      return CHART_TYPES.find((t) => t.id === 'bar');
    case 'TEXTO':
      return CHART_TYPES.find((t) => t.id === 'wordcloud');
    case 'FECHA':
      return CHART_TYPES.find((t) => t.id === 'line');
    default:
      return CHART_TYPES.find((t) => t.id === 'bar');
  }
}

/**
 * Obtiene el tipo de gráfico bivariable por defecto según los tipos de datos
 */
export function getDefaultBivariableChartType(
  tipoX: DataType,
  tipoY: DataType,
): ChartType | undefined {
  const normX = tipoX === 'TEXTO' ? 'CATEGORICO' : tipoX;
  const normY = tipoY === 'TEXTO' ? 'CATEGORICO' : tipoY;

  if (normX === 'NUMERICO' && normY === 'NUMERICO') {
    return CHART_TYPES.find((t) => t.id === 'scatter');
  }

  if (
    (normX === 'CATEGORICO' && normY === 'NUMERICO') ||
    (normX === 'NUMERICO' && normY === 'CATEGORICO')
  ) {
    return CHART_TYPES.find((t) => t.id === 'grouped_bar');
  }

  if (normX === 'CATEGORICO' && normY === 'CATEGORICO') {
    return CHART_TYPES.find((t) => t.id === 'heatmap');
  }

  if ((normX === 'FECHA' && normY === 'NUMERICO') || (normX === 'NUMERICO' && normY === 'FECHA')) {
    return CHART_TYPES.find((t) => t.id === 'line_time');
  }

  if (
    (normX === 'FECHA' && normY === 'CATEGORICO') ||
    (normX === 'CATEGORICO' && normY === 'FECHA')
  ) {
    return CHART_TYPES.find((t) => t.id === 'stacked_bar');
  }

  return undefined;
}
