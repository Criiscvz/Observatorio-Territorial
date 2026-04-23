import { Component, Input, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgxEchartsDirective } from 'ngx-echarts';
import { BaseChartComponent, CHART_COLORS } from './base-chart.component';
import { EChartsOption } from 'echarts';

@Component({
  selector: 'app-pie-chart',
  standalone: true,
  imports: [CommonModule, NgxEchartsDirective],
  template: `
    <div echarts [options]="chartOptions()" [style.height]="height"></div>
  `,
})
export class PieChartComponent extends BaseChartComponent {
  @Input() set isDonut(value: boolean) { this._isDonut.set(value); }
  
  protected _isDonut = signal(false);

  chartOptions = computed<EChartsOption>(() => ({
    tooltip: {
      trigger: 'item' as const,
      formatter: '{b}: {c} ({d}%)',
    },
    legend: {
      orient: 'vertical' as const,
      right: 10,
      top: 'center',
      type: 'scroll' as const,
    },
    series: [{
      type: 'pie' as const,
      radius: this._isDonut() ? ['40%', '70%'] : '70%',
      center: ['40%', '50%'],
      data: this._categories().map((name, i) => ({
        name,
        value: this._values()[i],
        itemStyle: { color: CHART_COLORS[i % CHART_COLORS.length] },
      })),
      label: {
        show: true,
        formatter: '{b}: {d}%',
      },
      emphasis: {
        itemStyle: {
          shadowBlur: 10,
          shadowOffsetX: 0,
          shadowColor: 'rgba(0, 0, 0, 0.5)',
        },
      },
    }],
  }));
}
