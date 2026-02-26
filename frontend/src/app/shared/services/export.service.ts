import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ExportService {
  /**
   * Download a CSV file from label/value pairs (frequency table format)
   */
  downloadFrequencyCsv(labels: string[], values: number[], filename: string = 'frecuencias'): void {
    const total = values.reduce((s, v) => s + v, 0);
    const rows = [
      ['Valor', 'Frecuencia', 'Porcentaje'].join(','),
      ...labels.map((label, i) => {
        const count = values[i] || 0;
        const pct = total > 0 ? ((count / total) * 100).toFixed(2) : '0.00';
        return [this.escapeCsvField(label), count, `${pct}%`].join(',');
      }),
      ['Total', total, '100.00%'].join(','),
    ];
    this.downloadTextFile(rows.join('\n'), `${filename}.csv`, 'text/csv;charset=utf-8;');
  }

  /**
   * Download chart data as CSV. Handles both univariable (labels+values) and generic key-value.
   */
  downloadChartDataCsv(
    data: { labels?: string[]; values?: number[]; stats?: Record<string, number> },
    filename: string = 'datos',
  ): void {
    if (data.labels && data.values) {
      this.downloadFrequencyCsv(data.labels, data.values, filename);
    }
  }

  /**
   * Download an image from an ECharts instance data URL
   */
  downloadChartPng(dataUrl: string, filename: string = 'grafico'): void {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `${filename}.png`;
    link.click();
  }

  /**
   * Download generic 2D data as CSV
   */
  downloadTableCsv(headers: string[], rows: (string | number)[][], filename: string): void {
    const csvRows = [
      headers.map((h) => this.escapeCsvField(String(h))).join(','),
      ...rows.map((row) => row.map((cell) => this.escapeCsvField(String(cell))).join(',')),
    ];
    this.downloadTextFile(csvRows.join('\n'), `${filename}.csv`, 'text/csv;charset=utf-8;');
  }

  private escapeCsvField(field: string): string {
    if (field.includes(',') || field.includes('"') || field.includes('\n')) {
      return `"${field.replace(/"/g, '""')}"`;
    }
    return field;
  }

  private downloadTextFile(content: string, filename: string, mimeType: string): void {
    const bom = '\uFEFF'; // UTF-8 BOM for Excel compatibility
    const blob = new Blob([bom + content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }
}
