import { ColumnaAnalizada } from './columna-analizada.interface';

export interface AnalisisResponse {
  message: string;
  columnas: ColumnaAnalizada[];
  preview: Record<string, any>[];
  total_filas: number;
}
