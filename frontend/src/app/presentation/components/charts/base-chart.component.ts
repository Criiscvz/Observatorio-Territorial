import { Component, Input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

export const CHART_COLORS = [
  '#00695C', // ULEAM primary
  '#26A69A',
  '#4DB6AC',
  '#80CBC4',
  '#B2DFDB',
  '#FF7043',
  '#FFB74D',
  '#4FC3F7',
  '#BA68C8',
  '#F06292',
];

@Component({
  template: '',
  standalone: true,
  imports: [CommonModule],
})
export abstract class BaseChartComponent {
  @Input() set categories(value: string[]) { this._categories.set(value); }
  @Input() set values(value: number[]) { this._values.set(value); }
  @Input() set title(value: string) { this._title.set(value); }
  @Input() height = '300px';

  protected _categories = signal<string[]>([]);
  protected _values = signal<number[]>([]);
  protected _title = signal('');

  protected formatNumber(value: number): string {
    if (value >= 1000000) return (value / 1000000).toFixed(1) + 'M';
    if (value >= 1000) return (value / 1000).toFixed(1) + 'K';
    return value.toFixed(2);
  }
}
