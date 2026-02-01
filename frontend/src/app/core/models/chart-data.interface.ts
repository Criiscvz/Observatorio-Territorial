export interface ChartData {
  variable: string;
  tipo: 'categorical' | 'numeric' | 'date';
  chart_type:
    | 'bar'
    | 'pie'
    | 'donut'
    | 'line'
    | 'area'
    | 'histogram'
    | 'scatter'
    | 'heatmap'
    | 'grouped_bar'
    | 'stacked_bar';
  data: {
    labels?: string[];
    values?: number[];
    points?: [number, number][];
    series?: { name: string; data: number[] }[];
  };
  stats?: {
    count?: number;
    mean?: number;
    median?: number;
    min?: number;
    max?: number;
    sum?: number;
  };
}
