export interface ChartData {
  categories?: string[];
  values?: number[];
  points?: [number, number][];
  series?: Record<string, Record<string, number>>;
  counts?: number[];
}
