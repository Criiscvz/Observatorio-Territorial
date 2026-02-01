export interface StatsResponse {
  variable: string;
  tipo_dato: string;
  tipo_grafico: string;
  data: {
    labels: string[];
    values: number[];
    points?: [number, number][];
  };
}
