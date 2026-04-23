import { Component, Input, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgxEchartsDirective } from 'ngx-echarts';
import { BaseChartComponent, CHART_COLORS } from './base-chart.component';
import { EChartsOption } from 'echarts';

@Component({
  selector: 'app-line-chart',
  standalone: true,
  imports: [CommonModule, NgxEchartsDirective],
  template: `
    <div echarts [options]="chartOptions()" [style.height]="height"></div>
  `,
})
export class LineChartComponent extends BaseChartComponent {
  @Input() set isArea(value: boolean) { this._isArea.set(value); }
  
  protected _isArea = signal(false);

  chartOptions = computed<EChartsOption>(() => ({
    tooltip: {
      trigger: 'axis' as const,
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true,
    },
    xAxis: {
      type: 'category' as const,
      data: this._categories(),
      boundaryGap: false,
    },
    yAxis: {
      type: 'value' as const,
    },
    series: [{
      type: 'line' as const,
      data: this._values(),
      smooth: true,
      areaStyle: this._isArea() ? { opacity: 0.3 } : undefined,
      lineStyle: { color: CHART_COLORS[0] },
      itemStyle: { color: CHART_COLORS[0] },
    }],
  }));
}
