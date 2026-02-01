import { CommonModule } from '@angular/common';
import { Component, computed, input } from '@angular/core';
import { ChartData } from '@core/models';
import { EChartsOption } from 'echarts';
import { NgxEchartsDirective } from 'ngx-echarts';

@Component({
  selector: 'app-dynamic-chart',
  standalone: true,
  imports: [CommonModule, NgxEchartsDirective],
  template: `
    <div class="chart-card">
      <div class="chart-header">
        <h3 class="chart-title">{{ chartData().variable }}</h3>
        <span class="chart-type-badge" [class]="chartTypeClass()">
          {{ chartTypeLabel() }}
        </span>
      </div>

      @if (chartData().stats) {
        <div class="stats-grid">
          <div class="stat-item stat-info">
            <span class="stat-label">Promedio</span>
            <span class="stat-value">{{ formatNumber(chartData().stats?.mean) }}</span>
          </div>
          <div class="stat-item stat-success">
            <span class="stat-label">Mediana</span>
            <span class="stat-value">{{ formatNumber(chartData().stats?.median) }}</span>
          </div>
          <div class="stat-item stat-primary">
            <span class="stat-label">Total</span>
            <span class="stat-value">{{ chartData().stats?.count | number }}</span>
          </div>
          <div class="stat-item stat-warning">
            <span class="stat-label">Mínimo</span>
            <span class="stat-value">{{ formatNumber(chartData().stats?.min) }}</span>
          </div>
          <div class="stat-item stat-error">
            <span class="stat-label">Máximo</span>
            <span class="stat-value">{{ formatNumber(chartData().stats?.max) }}</span>
          </div>
          <div class="stat-item stat-neutral">
            <span class="stat-label">Suma</span>
            <span class="stat-value">{{ formatNumber(chartData().stats?.sum) }}</span>
          </div>
        </div>
      }

      <div echarts [options]="chartOptions()" class="chart-container"></div>
    </div>
  `,
  styles: [
    `
      .chart-card {
        background: var(--card-bg);
        border: 1px solid var(--card-border);
        border-radius: var(--radius-xl);
        padding: 1rem;
        height: 100%;
      }
      .chart-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 0.5rem;
      }
      .chart-title {
        font-size: 1.125rem;
        font-weight: 600;
        color: var(--text-primary);
        margin: 0;
      }
      .chart-type-badge {
        font-size: 0.75rem;
        padding: 0.25rem 0.5rem;
        border-radius: var(--radius-md);
      }
      .chart-type-badge.type-bar {
        background: var(--info-bg);
        color: var(--info-color);
      }
      .chart-type-badge.type-pie,
      .chart-type-badge.type-donut {
        background: var(--success-bg);
        color: var(--success-color);
      }
      .chart-type-badge.type-line,
      .chart-type-badge.type-area {
        background: rgba(139, 92, 246, 0.15);
        color: #a78bfa;
      }
      .chart-type-badge.type-histogram {
        background: var(--warning-bg);
        color: var(--warning-color);
      }
      .chart-type-badge.type-scatter {
        background: var(--error-bg);
        color: var(--error-color);
      }
      .chart-type-badge.type-default {
        background: var(--neutral-bg);
        color: var(--text-secondary);
      }
      .stats-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 0.5rem;
        margin-bottom: 1rem;
        font-size: 0.875rem;
      }
      @media (min-width: 768px) {
        .stats-grid {
          grid-template-columns: repeat(6, 1fr);
        }
      }
      .stat-item {
        padding: 0.5rem;
        border-radius: var(--radius-md);
        text-align: center;
      }
      .stat-label {
        display: block;
        font-size: 0.75rem;
        color: var(--text-secondary);
      }
      .stat-value {
        font-weight: 700;
      }
      .stat-item.stat-info {
        background: var(--info-bg);
      }
      .stat-item.stat-info .stat-value {
        color: var(--info-color);
      }
      .stat-item.stat-success {
        background: var(--success-bg);
      }
      .stat-item.stat-success .stat-value {
        color: var(--success-color);
      }
      .stat-item.stat-primary {
        background: rgba(139, 92, 246, 0.15);
      }
      .stat-item.stat-primary .stat-value {
        color: #a78bfa;
      }
      .stat-item.stat-warning {
        background: var(--warning-bg);
      }
      .stat-item.stat-warning .stat-value {
        color: var(--warning-color);
      }
      .stat-item.stat-error {
        background: var(--error-bg);
      }
      .stat-item.stat-error .stat-value {
        color: var(--error-color);
      }
      .stat-item.stat-neutral {
        background: var(--neutral-bg);
      }
      .stat-item.stat-neutral .stat-value {
        color: var(--text-secondary);
      }
      .chart-container {
        height: 18rem;
      }
    `,
  ],
})
export class DynamicChartComponent {
  chartData = input.required<ChartData>();

  // Colores ULEAM y paleta complementaria
  private readonly colors = [
    '#C8102E',
    '#1E3A5F',
    '#3B82F6',
    '#10B981',
    '#F59E0B',
    '#8B5CF6',
    '#EC4899',
    '#06B6D4',
    '#84CC16',
    '#F97316',
  ];

  chartOptions = computed<EChartsOption>(() => {
    const data = this.chartData();

    switch (data.chart_type) {
      case 'bar':
        return this.getBarOptions(data);
      case 'pie':
        return this.getPieOptions(data);
      case 'line':
        return this.getLineOptions(data);
      case 'histogram':
        return this.getHistogramOptions(data);
      case 'scatter':
        return this.getScatterOptions(data);
      case 'donut':
        return this.getDonutOptions(data);
      case 'area':
        return this.getAreaOptions(data);
      default:
        return this.getBarOptions(data);
    }
  });

  chartTypeClass = computed(() => {
    const type = this.chartData().chart_type;
    switch (type) {
      case 'bar':
        return 'type-bar';
      case 'pie':
      case 'donut':
        return 'type-pie';
      case 'line':
      case 'area':
        return 'type-line';
      case 'histogram':
        return 'type-histogram';
      case 'scatter':
        return 'type-scatter';
      default:
        return 'type-default';
    }
  });

  chartTypeLabel = computed(() => {
    const type = this.chartData().chart_type;
    switch (type) {
      case 'bar':
        return 'Barras';
      case 'pie':
        return 'Pastel';
      case 'donut':
        return 'Donut';
      case 'line':
        return 'Líneas';
      case 'area':
        return 'Área';
      case 'histogram':
        return 'Histograma';
      case 'scatter':
        return 'Dispersión';
      default:
        return type;
    }
  });

  formatNumber(value: number | undefined): string {
    if (value === undefined || value === null) return '-';
    if (Math.abs(value) >= 1000000) return (value / 1000000).toFixed(1) + 'M';
    if (Math.abs(value) >= 1000) return (value / 1000).toFixed(1) + 'K';
    return value.toFixed(2);
  }

  private getBarOptions(data: ChartData): EChartsOption {
    const labels = data.data?.labels || [];
    const values = data.data?.values || [];
    return {
      tooltip: {
        trigger: 'axis',
        formatter: (params: any) => {
          const p = params[0];
          return `<strong>${p.name}</strong><br/>${p.value.toLocaleString()}`;
        },
      },
      xAxis: {
        type: 'category',
        data: labels,
        axisLabel: { rotate: 45, interval: 0 },
      },
      yAxis: { type: 'value' },
      series: [
        {
          type: 'bar',
          data: values.map((v, i) => ({
            value: v,
            itemStyle: { color: this.colors[i % this.colors.length] },
          })),
          emphasis: {
            itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.3)' },
          },
        },
      ],
      grid: { bottom: 80, left: 60, right: 20 },
    };
  }

  private getPieOptions(data: ChartData): EChartsOption {
    const labels = data.data?.labels || [];
    const values = data.data?.values || [];
    const pieData = labels.map((label, i) => ({
      name: label,
      value: values[i] || 0,
      itemStyle: { color: this.colors[i % this.colors.length] },
    }));

    return {
      tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
      legend: { bottom: 0, type: 'scroll' },
      series: [
        {
          type: 'pie',
          radius: '70%',
          data: pieData,
          label: { formatter: '{b}\n{d}%' },
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowOffsetX: 0,
              shadowColor: 'rgba(0, 0, 0, 0.5)',
            },
          },
        },
      ],
    };
  }

  private getDonutOptions(data: ChartData): EChartsOption {
    const labels = data.data?.labels || [];
    const values = data.data?.values || [];
    const pieData = labels.map((label, i) => ({
      name: label,
      value: values[i] || 0,
      itemStyle: { color: this.colors[i % this.colors.length] },
    }));

    const total = values.reduce((a, b) => a + b, 0);

    return {
      tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
      legend: { bottom: 0, type: 'scroll' },
      graphic: [
        {
          type: 'text',
          left: 'center',
          top: '40%',
          style: {
            text: total.toLocaleString(),
            fontSize: 24,
            fontWeight: 'bold',
            fill: '#333',
          },
        },
        {
          type: 'text',
          left: 'center',
          top: '50%',
          style: {
            text: 'Total',
            fontSize: 12,
            fill: '#666',
          },
        },
      ],
      series: [
        {
          type: 'pie',
          radius: ['45%', '70%'],
          data: pieData,
          label: { show: false },
          emphasis: {
            label: { show: true, fontSize: 14, fontWeight: 'bold' },
            itemStyle: {
              shadowBlur: 10,
              shadowColor: 'rgba(0, 0, 0, 0.5)',
            },
          },
        },
      ],
    };
  }

  private getLineOptions(data: ChartData): EChartsOption {
    const labels = data.data?.labels || [];
    const values = data.data?.values || [];
    return {
      tooltip: { trigger: 'axis' },
      xAxis: {
        type: 'category',
        data: labels,
        axisLabel: { rotate: 45 },
      },
      yAxis: { type: 'value' },
      series: [
        {
          type: 'line',
          data: values,
          smooth: true,
          lineStyle: { color: '#C8102E', width: 3 },
          itemStyle: { color: '#C8102E' },
          symbol: 'circle',
          symbolSize: 8,
        },
      ],
      dataZoom: [{ type: 'inside' }, { type: 'slider', bottom: 10 }],
      grid: { bottom: 80, left: 60, right: 20 },
    };
  }

  private getAreaOptions(data: ChartData): EChartsOption {
    const labels = data.data?.labels || [];
    const values = data.data?.values || [];
    return {
      tooltip: { trigger: 'axis' },
      xAxis: {
        type: 'category',
        data: labels,
        axisLabel: { rotate: 45 },
        boundaryGap: false,
      },
      yAxis: { type: 'value' },
      series: [
        {
          type: 'line',
          data: values,
          smooth: true,
          lineStyle: { color: '#C8102E', width: 2 },
          itemStyle: { color: '#C8102E' },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(200, 16, 46, 0.5)' },
                { offset: 1, color: 'rgba(200, 16, 46, 0.05)' },
              ],
            },
          },
        },
      ],
      dataZoom: [{ type: 'inside' }, { type: 'slider', bottom: 10 }],
      grid: { bottom: 80, left: 60, right: 20 },
    };
  }

  private getHistogramOptions(data: ChartData): EChartsOption {
    const labels = data.data?.labels || [];
    const values = data.data?.values || [];
    return {
      tooltip: {
        trigger: 'axis',
        formatter: (params: any) => {
          const p = params[0];
          return `Rango: ${p.name}<br/>Frecuencia: ${p.value.toLocaleString()}`;
        },
      },
      xAxis: {
        type: 'category',
        data: labels,
        axisLabel: { rotate: 45, fontSize: 10 },
        name: 'Valores',
      },
      yAxis: { type: 'value', name: 'Frecuencia' },
      series: [
        {
          type: 'bar',
          data: values,
          itemStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: '#3B82F6' },
                { offset: 1, color: '#1E40AF' },
              ],
            },
            borderRadius: [4, 4, 0, 0],
          },
          barWidth: '90%',
        },
      ],
      grid: { bottom: 80, left: 60, right: 20 },
    };
  }

  private getScatterOptions(data: ChartData): EChartsOption {
    return {
      tooltip: {
        trigger: 'item',
        formatter: (params: any) => `X: ${params.value[0]}<br/>Y: ${params.value[1]}`,
      },
      xAxis: { type: 'value', scale: true },
      yAxis: { type: 'value', scale: true },
      series: [
        {
          type: 'scatter',
          data: data.data.points || [],
          symbolSize: 10,
          itemStyle: { color: '#C8102E', opacity: 0.7 },
        },
      ],
      dataZoom: [
        { type: 'inside', xAxisIndex: 0 },
        { type: 'inside', yAxisIndex: 0 },
      ],
    };
  }
}
