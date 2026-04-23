import { Component, Input, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgxEchartsDirective } from 'ngx-echarts';
import { CHART_COLORS } from './base-chart.component';
import { EChartsOption } from 'echarts';

@Component({
  selector: 'app-scatter-chart',
  standalone: true,
  imports: [CommonModule, NgxEchartsDirective],
  template: `
    <div echarts [options]="chartOptions()" [style.height]="height"></div>
  `,
})
export class ScatterChartComponent {
  @Input() set points(value: [number, number][]) { this._points.set(value); }
  @Input() set xLabel(value: string) { this._xLabel.set(value); }
  @Input() set yLabel(value: string) { this._yLabel.set(value); }
  @Input() height = '300px';

  protected _points = signal<[number, number][]>([]);
  protected _xLabel = signal('X');
  protected _yLabel = signal('Y');

  chartOptions = computed<EChartsOption>(() => ({
    tooltip: {
      trigger: 'item' as const,
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true,
    },
    xAxis: {
      type: 'value' as const,
      name: this._xLabel(),
      nameLocation: 'middle' as const,
      nameGap: 25,
    },
    yAxis: {
      type: 'value' as const,
      name: this._yLabel(),
      nameLocation: 'middle' as const,
      nameGap: 40,
    },
    series: [{
      type: 'scatter' as const,
      data: this._points(),
      symbolSize: 8,
      itemStyle: {
        color: CHART_COLORS[0],
        opacity: 0.7,
      },
    }],
  }));
}
