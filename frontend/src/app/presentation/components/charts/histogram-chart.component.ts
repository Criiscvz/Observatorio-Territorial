import { Component, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgxEchartsDirective } from 'ngx-echarts';
import { BaseChartComponent, CHART_COLORS } from './base-chart.component';
import { EChartsOption } from 'echarts';

@Component({
  selector: 'app-histogram-chart',
  standalone: true,
  imports: [CommonModule, NgxEchartsDirective],
  template: `
    <div echarts [options]="chartOptions()" [style.height]="height"></div>
  `,
})
export class HistogramChartComponent extends BaseChartComponent {
  chartOptions = computed<EChartsOption>(() => ({
    tooltip: {
      trigger: 'axis' as const,
      axisPointer: { type: 'shadow' as const },
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '15%',
      containLabel: true,
    },
    xAxis: {
      type: 'category' as const,
      data: this._categories(),
      axisLabel: {
        rotate: 45,
        interval: 0,
        fontSize: 10,
      },
    },
    yAxis: {
      type: 'value' as const,
      name: 'Frecuencia',
    },
    series: [{
      type: 'bar' as const,
      data: this._values(),
      barWidth: '90%',
      itemStyle: {
        color: CHART_COLORS[0],
      },
    }],
  }));
}
