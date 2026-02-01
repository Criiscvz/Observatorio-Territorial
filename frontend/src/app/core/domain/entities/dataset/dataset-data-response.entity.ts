export interface DatasetDataResponse {
  dataset: {
    id: string;
    nombre: string;
    total_registros: number;
  };
  data: { id: number; data: Record<string, unknown> }[];
  pagination: {
    current_page: number;
    per_page: number;
    total: number;
    last_page: number;
  };
}
