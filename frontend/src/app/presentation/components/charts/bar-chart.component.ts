import { Component, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgxEchartsDirective } from 'ngx-echarts';
import { BaseChartComponent, CHART_COLORS } from './base-chart.component';
import { EChartsOption } from 'echarts';

@Component({
  selector: 'app-bar-chart',
  standalone: true,
  imports: [CommonModule, NgxEchartsDirective],
  template: `
    <div echarts [options]="chartOptions()" [style.height]="height"></div>
  `,
})
export class BarChartComponent extends BaseChartComponent {
  chartOptions = computed<EChartsOption>(() => ({
    tooltip: {
      trigger: 'axis' as const,
      axisPointer: { type: 'shadow' as const },
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
      axisLabel: {
        rotate: this._categories().length > 5 ? 45 : 0,
        interval: 0,
      },
    },
    yAxis: {
      type: 'value' as const,
    },
    series: [{
      type: 'bar' as const,
      data: this._values(),
      itemStyle: {
        color: (params: { dataIndex: number }) => CHART_COLORS[params.dataIndex % CHART_COLORS.length],
      },
    }],
  }));
}
