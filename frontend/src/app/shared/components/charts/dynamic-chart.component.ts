import { Component, input, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgxEchartsDirective } from 'ngx-echarts';
import { EChartsOption } from 'echarts';
import { ChartData } from '../../../core/models';

@Component({
  selector: 'app-dynamic-chart',
  standalone: true,
  imports: [CommonModule, NgxEchartsDirective],
  template: `
    <div class="bg-white rounded-lg shadow p-4 h-full">
      <div class="flex justify-between items-start mb-2">
        <h3 class="text-lg font-semibold text-gray-800">{{ chartData().variable }}</h3>
        <span class="text-xs px-2 py-1 rounded" [class]="chartTypeClass()">
          {{ chartTypeLabel() }}
        </span>
      </div>
      
      @if (chartData().stats) {
        <div class="grid grid-cols-3 md:grid-cols-6 gap-2 mb-4 text-sm">
          <div class="bg-blue-50 p-2 rounded text-center">
            <span class="block text-xs text-gray-500">Promedio</span>
            <span class="font-bold text-blue-600">{{ formatNumber(chartData().stats?.mean) }}</span>
          </div>
          <div class="bg-green-50 p-2 rounded text-center">
            <span class="block text-xs text-gray-500">Mediana</span>
            <span class="font-bold text-green-600">{{ formatNumber(chartData().stats?.median) }}</span>
          </div>
          <div class="bg-purple-50 p-2 rounded text-center">
            <span class="block text-xs text-gray-500">Total</span>
            <span class="font-bold text-purple-600">{{ chartData().stats?.count | number }}</span>
          </div>
          <div class="bg-orange-50 p-2 rounded text-center">
            <span class="block text-xs text-gray-500">Mínimo</span>
            <span class="font-bold text-orange-600">{{ formatNumber(chartData().stats?.min) }}</span>
          </div>
          <div class="bg-red-50 p-2 rounded text-center">
            <span class="block text-xs text-gray-500">Máximo</span>
            <span class="font-bold text-red-600">{{ formatNumber(chartData().stats?.max) }}</span>
          </div>
          <div class="bg-gray-50 p-2 rounded text-center">
            <span class="block text-xs text-gray-500">Suma</span>
            <span class="font-bold text-gray-600">{{ formatNumber(chartData().stats?.sum) }}</span>
          </div>
        </div>
      }

      <div echarts [options]="chartOptions()" class="h-72"></div>
    </div>
  `
})
export class DynamicChartComponent {
  chartData = input.required<ChartData>();

  // Colores ULEAM y paleta complementaria
  private readonly colors = [
    '#C8102E', '#1E3A5F', '#3B82F6', '#10B981', '#F59E0B', 
    '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16', '#F97316'
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
      case 'bar': return 'bg-blue-100 text-blue-800';
      case 'pie': case 'donut': return 'bg-green-100 text-green-800';
      case 'line': case 'area': return 'bg-purple-100 text-purple-800';
      case 'histogram': return 'bg-orange-100 text-orange-800';
      case 'scatter': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  });

  chartTypeLabel = computed(() => {
    const type = this.chartData().chart_type;
    switch (type) {
      case 'bar': return 'Barras';
      case 'pie': return 'Pastel';
      case 'donut': return 'Donut';
      case 'line': return 'Líneas';
      case 'area': return 'Área';
      case 'histogram': return 'Histograma';
      case 'scatter': return 'Dispersión';
      default: return type;
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
        }
      },
      xAxis: {
        type: 'category',
        data: labels,
        axisLabel: { rotate: 45, interval: 0 }
      },
      yAxis: { type: 'value' },
      series: [{
        type: 'bar',
        data: values.map((v, i) => ({
          value: v,
          itemStyle: { color: this.colors[i % this.colors.length] }
        })),
        emphasis: {
          itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.3)' }
        }
      }],
      grid: { bottom: 80, left: 60, right: 20 }
    };
  }

  private getPieOptions(data: ChartData): EChartsOption {
    const labels = data.data?.labels || [];
    const values = data.data?.values || [];
    const pieData = labels.map((label, i) => ({
      name: label,
      value: values[i] || 0,
      itemStyle: { color: this.colors[i % this.colors.length] }
    }));

    return {
      tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
      legend: { bottom: 0, type: 'scroll' },
      series: [{
        type: 'pie',
        radius: '70%',
        data: pieData,
        label: { formatter: '{b}\n{d}%' },
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowOffsetX: 0,
            shadowColor: 'rgba(0, 0, 0, 0.5)'
          }
        }
      }]
    };
  }

  private getDonutOptions(data: ChartData): EChartsOption {
    const labels = data.data?.labels || [];
    const values = data.data?.values || [];
    const pieData = labels.map((label, i) => ({
      name: label,
      value: values[i] || 0,
      itemStyle: { color: this.colors[i % this.colors.length] }
    }));

    const total = values.reduce((a, b) => a + b, 0);

    return {
      tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
      legend: { bottom: 0, type: 'scroll' },
      graphic: [{
        type: 'text',
        left: 'center',
        top: '40%',
        style: {
          text: total.toLocaleString(),
          fontSize: 24,
          fontWeight: 'bold',
          fill: '#333'
        }
      }, {
        type: 'text',
        left: 'center',
        top: '50%',
        style: {
          text: 'Total',
          fontSize: 12,
          fill: '#666'
        }
      }],
      series: [{
        type: 'pie',
        radius: ['45%', '70%'],
        data: pieData,
        label: { show: false },
        emphasis: {
          label: { show: true, fontSize: 14, fontWeight: 'bold' },
          itemStyle: {
            shadowBlur: 10,
            shadowColor: 'rgba(0, 0, 0, 0.5)'
          }
        }
      }]
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
        axisLabel: { rotate: 45 }
      },
      yAxis: { type: 'value' },
      series: [{
        type: 'line',
        data: values,
        smooth: true,
        lineStyle: { color: '#C8102E', width: 3 },
        itemStyle: { color: '#C8102E' },
        symbol: 'circle',
        symbolSize: 8
      }],
      dataZoom: [{ type: 'inside' }, { type: 'slider', bottom: 10 }],
      grid: { bottom: 80, left: 60, right: 20 }
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
        boundaryGap: false
      },
      yAxis: { type: 'value' },
      series: [{
        type: 'line',
        data: values,
        smooth: true,
        lineStyle: { color: '#C8102E', width: 2 },
        itemStyle: { color: '#C8102E' },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(200, 16, 46, 0.5)' },
              { offset: 1, color: 'rgba(200, 16, 46, 0.05)' }
            ]
          }
        }
      }],
      dataZoom: [{ type: 'inside' }, { type: 'slider', bottom: 10 }],
      grid: { bottom: 80, left: 60, right: 20 }
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
        }
      },
      xAxis: {
        type: 'category',
        data: labels,
        axisLabel: { rotate: 45, fontSize: 10 },
        name: 'Valores'
      },
      yAxis: { type: 'value', name: 'Frecuencia' },
      series: [{
        type: 'bar',
        data: values,
        itemStyle: { 
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: '#3B82F6' },
              { offset: 1, color: '#1E40AF' }
            ]
          },
          borderRadius: [4, 4, 0, 0]
        },
        barWidth: '90%'
      }],
      grid: { bottom: 80, left: 60, right: 20 }
    };
  }

  private getScatterOptions(data: ChartData): EChartsOption {
    return {
      tooltip: { 
        trigger: 'item',
        formatter: (params: any) => `X: ${params.value[0]}<br/>Y: ${params.value[1]}`
      },
      xAxis: { type: 'value', scale: true },
      yAxis: { type: 'value', scale: true },
      series: [{
        type: 'scatter',
        data: data.data.points || [],
        symbolSize: 10,
        itemStyle: { color: '#C8102E', opacity: 0.7 }
      }],
      dataZoom: [
        { type: 'inside', xAxisIndex: 0 },
        { type: 'inside', yAxisIndex: 0 }
      ]
    };
  }
}
