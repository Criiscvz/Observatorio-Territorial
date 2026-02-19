import { inject, Injectable } from '@angular/core';
import { ChartData } from '@core/models';
import { ChartThemeService } from '@core/services/chart-theme.service';
import { BivariableResponse } from '@core/services/interfaces';
import { EChartsOption } from 'echarts';

// Only import echarts-wordcloud in browser (it depends on 'window')
if (typeof window !== 'undefined') {
  import('echarts-wordcloud');
}

@Injectable({ providedIn: 'root' })
export class ChartOptionsService {
  private readonly chartTheme = inject(ChartThemeService);

  get colors() {
    return this.chartTheme.getColors();
  }

  get config() {
    return this.chartTheme.config();
  }

  /** Truncate a label to maxLen chars with ellipsis */
  private truncateLabel(label: string, maxLen = 30): string {
    if (!label || label.length <= maxLen) return label;
    return label.substring(0, maxLen) + '...';
  }

  /** Truncate an array of labels */
  private truncateLabels(labels: string[], maxLen = 30): string[] {
    return labels.map((l) => this.truncateLabel(l, maxLen));
  }

  getUnivariableOptions(data: ChartData, type: string): EChartsOption {
    const cfg = this.config;
    const colors = this.colors;
    const labels = data.data?.labels || [];
    const values = data.data?.values || [];
    const title = data.variable || 'Variable';
    const total = values.reduce((a, b) => a + b, 0);
    const maxValue = Math.max(...values, 1);

    const baseOptions = this.getBaseOptions(cfg);

    switch (type) {
      case 'bar':
        return this.getBarOptions(baseOptions, title, labels, values, colors, cfg);
      case 'pie':
      case 'donut':
        return this.getPieOptions(
          baseOptions,
          title,
          labels,
          values,
          colors,
          cfg,
          type === 'donut',
        );
      case 'histogram':
        return this.getHistogramOptions(baseOptions, title, labels, values, colors, cfg);
      case 'line':
        return this.getLineOptions(baseOptions, title, labels, values, colors, cfg);
      case 'area':
        return this.getAreaOptions(baseOptions, title, labels, values, colors, cfg);
      case 'funnel':
        return this.getFunnelOptions(baseOptions, title, labels, values, colors, cfg);
      case 'treemap':
        return this.getTreemapOptions(baseOptions, title, labels, values, colors, cfg);
      case 'gauge':
        return this.getGaugeOptions(baseOptions, title, values, colors, cfg, data.stats, total);
      case 'radar':
        return this.getRadarOptions(baseOptions, title, labels, values, colors, cfg, maxValue);
      case 'wordcloud':
        return this.getWordCloudOptions(baseOptions, title, labels, values, colors, cfg);
      case 'horizontal_bar':
        return this.getHorizontalBarOptions(baseOptions, title, labels, values, colors, cfg);
      case 'rose':
        return this.getRoseOptions(baseOptions, title, labels, values, colors, cfg);
      case 'polar_bar':
        return this.getPolarBarOptions(baseOptions, title, labels, values, colors, cfg);
      case 'pictorial_bar':
        return this.getPictorialBarOptions(baseOptions, title, labels, values, colors, cfg);
      default:
        return {};
    }
  }

  getBivariableOptions(data: BivariableResponse, type: string): EChartsOption {
    const cfg = this.config;
    const colors = this.colors;
    const d = data.data;
    const varX = data.nombre_variable_x || 'X';
    const varY = data.nombre_variable_y || 'Y';
    const correlation = d.correlation ?? data.stats?.correlation;
    const categories = d.categories || d.labels || d.labels_x || [];
    const values = d.values || [];

    const baseOptions = this.getBaseOptions(cfg);

    // LINE_TIME (serie temporal)
    if (type === 'line_time' || (d.labels && d.values && !d.points && !d.heatmap && !d.series)) {
      return this.getLineTimeOptions(baseOptions, d, varY, colors, cfg);
    }

    // BUBBLE (dispersión con tamaño variable)
    if (type === 'bubble' && d.points && d.points.length > 0) {
      return this.getBubbleOptions(baseOptions, d, varX, varY, correlation, colors, cfg);
    }

    // STACKED_AREA (áreas apiladas, misma estructura que stacked_bar)
    if (type === 'stacked_area' && d.series && Array.isArray(d.series) && d.labels_x) {
      return this.getStackedAreaOptions(baseOptions, d, varX, varY, colors, cfg);
    }

    // SCATTER (2 numéricas)
    if (d.points && d.points.length > 0) {
      return this.getScatterOptions(baseOptions, d, varX, varY, correlation, colors, cfg);
    }

    // HEATMAP (2 categóricas)
    if (d.heatmap && d.labels_x && d.labels_y) {
      return this.getHeatmapOptions(baseOptions, d, varX, varY, cfg);
    }

    // STACKED/GROUPED BAR (con series)
    if (d.series && Array.isArray(d.series) && d.labels_x) {
      return this.getStackedBarOptions(baseOptions, d, varX, varY, colors, cfg, type);
    }

    // BAR COMPARATIVO (grouped_bar, box_compare)
    if (categories.length > 0 && values.length > 0) {
      return this.getComparativeBarOptions(
        baseOptions,
        categories,
        values,
        varX,
        varY,
        colors,
        cfg,
      );
    }

    return {};
  }

  private getBaseOptions(cfg: any): EChartsOption {
    return {
      backgroundColor: 'transparent',
      textStyle: { color: cfg.textColor },
      tooltip: {
        backgroundColor: cfg.tooltipBg,
        borderColor: cfg.tooltipBorder,
        textStyle: { color: cfg.textColor },
        extraCssText: 'border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);',
      },
    };
  }

  private getBarOptions(
    base: EChartsOption,
    title: string,
    labels: string[],
    values: number[],
    colors: string[],
    cfg: any,
  ): EChartsOption {
    const displayLabels = this.truncateLabels(labels, 25);
    return {
      ...base,
      title: { text: title, left: 'center', textStyle: { color: cfg.textColor } },
      tooltip: {
        ...(base.tooltip as any),
        trigger: 'axis',
        formatter: (params: any) => {
          const p = Array.isArray(params) ? params[0] : params;
          const idx = p.dataIndex;
          const fullLabel = labels[idx] || p.name;
          return `<strong>${fullLabel}</strong><br/>${p.value}`;
        },
      },
      xAxis: {
        type: 'category',
        data: displayLabels,
        axisLabel: {
          color: cfg.textColorSecondary,
          rotate: displayLabels.length > 6 ? 45 : 0,
          width: 100,
          overflow: 'truncate',
        },
      },
      yAxis: {
        type: 'value',
        axisLabel: { color: cfg.textColorSecondary },
        splitLine: { lineStyle: { color: cfg.splitLineColor } },
      },
      series: [
        {
          type: 'bar',
          data: values.map((v, i) => ({
            value: v,
            itemStyle: { color: colors[i % colors.length], borderRadius: [4, 4, 0, 0] },
          })),
        },
      ],
      grid: { bottom: displayLabels.length > 6 ? 80 : 40, left: 60, right: 20, top: 60 },
    };
  }

  private getPieOptions(
    base: EChartsOption,
    title: string,
    labels: string[],
    values: number[],
    colors: string[],
    cfg: any,
    isDonut: boolean,
  ): EChartsOption {
    return {
      ...base,
      title: { text: title, left: 'center', textStyle: { color: cfg.textColor } },
      legend: { bottom: 10, textStyle: { color: cfg.textColorSecondary }, type: 'scroll' },
      tooltip: {
        ...(base.tooltip as any),
        trigger: 'item',
        formatter: (params: any) => {
          const idx = params.dataIndex;
          const fullLabel = labels[idx] || params.name;
          const percent = params.percent;
          return `<strong>${fullLabel}</strong><br/>${params.value} (${percent}%)`;
        },
      },
      series: [
        {
          type: 'pie',
          radius: isDonut ? ['40%', '70%'] : '70%',
          center: ['50%', '50%'],
          data: labels.map((l, i) => ({
            name: this.truncateLabel(l, 30),
            value: values[i],
            itemStyle: { color: colors[i % colors.length] },
          })),
          label: {
            show: true,
            color: cfg.textColorSecondary,
            formatter: (params: any) => {
              const idx = params.dataIndex;
              const displayName = this.truncateLabel(labels[idx] || params.name, 20);
              return `${displayName}: ${params.percent}%`;
            },
          },
          emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.2)' } },
        },
      ],
    };
  }

  private getHistogramOptions(
    base: EChartsOption,
    title: string,
    labels: string[],
    values: number[],
    colors: string[],
    cfg: any,
  ): EChartsOption {
    return {
      ...base,
      title: {
        text: `Distribución: ${title}`,
        left: 'center',
        textStyle: { color: cfg.textColor },
      },
      xAxis: {
        type: 'category',
        data: labels,
        axisLabel: { color: cfg.textColorSecondary, rotate: 45 },
      },
      yAxis: {
        type: 'value',
        axisLabel: { color: cfg.textColorSecondary },
        splitLine: { lineStyle: { color: cfg.splitLineColor } },
      },
      series: [
        {
          type: 'bar',
          data: values,
          itemStyle: { color: colors[2], borderRadius: [4, 4, 0, 0] },
        },
      ],
      grid: { bottom: 80, left: 60, right: 20, top: 60 },
    };
  }

  private getLineOptions(
    base: EChartsOption,
    title: string,
    labels: string[],
    values: number[],
    colors: string[],
    cfg: any,
  ): EChartsOption {
    return {
      ...base,
      title: { text: title, left: 'center', textStyle: { color: cfg.textColor } },
      xAxis: {
        type: 'category',
        data: labels,
        boundaryGap: false,
        axisLabel: { color: cfg.textColorSecondary },
      },
      yAxis: {
        type: 'value',
        axisLabel: { color: cfg.textColorSecondary },
        splitLine: { lineStyle: { color: cfg.splitLineColor } },
      },
      series: [
        {
          type: 'line',
          data: values,
          smooth: true,
          itemStyle: { color: colors[3] },
          areaStyle: { color: `${colors[3]}20` },
        },
      ],
      grid: { bottom: 40, left: 60, right: 20, top: 60 },
    };
  }

  private getAreaOptions(
    base: EChartsOption,
    title: string,
    labels: string[],
    values: number[],
    colors: string[],
    cfg: any,
  ): EChartsOption {
    return {
      ...base,
      title: { text: title, left: 'center', textStyle: { color: cfg.textColor } },
      xAxis: {
        type: 'category',
        data: labels,
        boundaryGap: false,
        axisLabel: { color: cfg.textColorSecondary },
      },
      yAxis: {
        type: 'value',
        axisLabel: { color: cfg.textColorSecondary },
        splitLine: { lineStyle: { color: cfg.splitLineColor } },
      },
      series: [
        {
          type: 'line',
          data: values,
          smooth: true,
          itemStyle: { color: colors[4] },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: `${colors[4]}60` },
                { offset: 1, color: `${colors[4]}05` },
              ],
            },
          },
        },
      ],
      grid: { bottom: 40, left: 60, right: 20, top: 60 },
    };
  }

  private getFunnelOptions(
    base: EChartsOption,
    title: string,
    labels: string[],
    values: number[],
    colors: string[],
    cfg: any,
  ): EChartsOption {
    return {
      ...base,
      title: { text: title, left: 'center', textStyle: { color: cfg.textColor } },
      legend: { bottom: 10, textStyle: { color: cfg.textColorSecondary } },
      series: [
        {
          type: 'funnel',
          left: '10%',
          right: '10%',
          top: 60,
          bottom: 60,
          minSize: '20%',
          maxSize: '100%',
          sort: 'descending',
          gap: 2,
          label: { show: true, position: 'inside', color: '#fff' },
          data: labels.map((l, i) => ({
            name: l,
            value: values[i],
            itemStyle: { color: colors[i % colors.length] },
          })),
        },
      ],
    };
  }

  private getTreemapOptions(
    base: EChartsOption,
    title: string,
    labels: string[],
    values: number[],
    colors: string[],
    cfg: any,
  ): EChartsOption {
    return {
      ...base,
      title: { text: title, left: 'center', textStyle: { color: cfg.textColor } },
      series: [
        {
          type: 'treemap',
          roam: false,
          breadcrumb: { show: false },
          label: { show: true, formatter: '{b}', color: '#fff' },
          data: labels.map((l, i) => ({
            name: l,
            value: values[i],
            itemStyle: { color: colors[i % colors.length] },
          })),
        },
      ],
    };
  }

  private getGaugeOptions(
    base: EChartsOption,
    title: string,
    values: number[],
    colors: string[],
    cfg: any,
    stats: any,
    total: number,
  ): EChartsOption {
    const gaugeAvg = total / Math.max(values.length, 1);
    return {
      ...base,
      title: { text: title, left: 'center', textStyle: { color: cfg.textColor } },
      series: [
        {
          type: 'gauge',
          min: stats?.min ?? 0,
          max: stats?.max ?? 100,
          progress: { show: true, width: 18 },
          axisLine: {
            lineStyle: {
              width: 18,
              color: [
                [0.3, '#EF4444'],
                [0.7, '#F59E0B'],
                [1, '#10B981'],
              ],
            },
          },
          axisTick: { show: false },
          splitLine: { length: 12, lineStyle: { width: 2, color: cfg.splitLineColor } },
          axisLabel: { distance: 25, color: cfg.textColorSecondary },
          pointer: { itemStyle: { color: colors[0] } },
          title: { show: true, offsetCenter: [0, '70%'], color: cfg.textColorSecondary },
          detail: {
            valueAnimation: true,
            formatter: '{value}',
            color: cfg.textColor,
            fontSize: 24,
          },
          data: [{ value: Number(gaugeAvg.toFixed(1)), name: 'Promedio' }],
        },
      ],
    };
  }

  private getRadarOptions(
    base: EChartsOption,
    title: string,
    labels: string[],
    values: number[],
    colors: string[],
    cfg: any,
    maxValue: number,
  ): EChartsOption {
    return {
      ...base,
      title: { text: title, left: 'center', textStyle: { color: cfg.textColor } },
      radar: {
        indicator: labels.map((l) => ({ name: l, max: maxValue * 1.2 })),
        axisName: { color: cfg.textColorSecondary },
        splitLine: { lineStyle: { color: cfg.splitLineColor } },
        splitArea: { areaStyle: { color: ['transparent', `${cfg.splitLineColor}30`] } },
      },
      series: [
        {
          type: 'radar',
          data: [
            {
              value: values,
              name: title,
              itemStyle: { color: colors[0] },
              areaStyle: { color: `${colors[0]}40` },
            },
          ],
        },
      ],
    };
  }

  private getWordCloudOptions(
    base: EChartsOption,
    title: string,
    labels: string[],
    values: number[],
    colors: string[],
    cfg: any,
  ): EChartsOption {
    const wordData = labels.map((label, i) => ({
      name: label,
      value: values[i] || 1,
    }));

    return {
      ...base,
      title: { text: title, left: 'center', textStyle: { color: cfg.textColor } },
      tooltip: {
        ...(base.tooltip as any),
        formatter: (params: any) => `${params.name}: ${params.value}`,
      },
      series: [
        {
          type: 'wordCloud',
          shape: 'circle',
          sizeRange: [14, 60],
          rotationRange: [-45, 45],
          rotationStep: 15,
          gridSize: 8,
          drawOutOfBound: false,
          layoutAnimation: true,
          textStyle: {
            fontFamily: 'Inter, sans-serif',
            fontWeight: 'bold',
            color: () => colors[Math.floor(Math.random() * colors.length)],
          },
          emphasis: {
            textStyle: {
              shadowBlur: 10,
              shadowColor: '#333',
            },
          },
          data: wordData,
        },
      ],
    } as any;
  }

  private getLineTimeOptions(
    base: EChartsOption,
    d: any,
    varY: string,
    colors: string[],
    cfg: any,
  ): EChartsOption {
    const labels = d.labels || [];
    const vals = d.values || [];

    return {
      ...base,
      title: {
        text: `${varY} en el tiempo`,
        left: 'center',
        textStyle: { color: cfg.textColor },
      },
      xAxis: {
        type: 'category',
        data: labels,
        boundaryGap: false,
        axisLabel: { color: cfg.textColorSecondary, rotate: labels.length > 10 ? 45 : 0 },
      },
      yAxis: {
        type: 'value',
        name: varY,
        axisLabel: { color: cfg.textColorSecondary },
        splitLine: { lineStyle: { color: cfg.splitLineColor } },
      },
      series: [
        {
          type: 'line',
          data: vals,
          smooth: true,
          symbol: 'circle',
          symbolSize: 6,
          lineStyle: { color: colors[0], width: 3 },
          itemStyle: { color: colors[0] },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: `${colors[0]}40` },
                { offset: 1, color: `${colors[0]}05` },
              ],
            },
          },
        },
      ],
      grid: { bottom: labels.length > 10 ? 80 : 40, left: 60, right: 20, top: 60 },
    };
  }

  private getScatterOptions(
    base: EChartsOption,
    d: any,
    varX: string,
    varY: string,
    correlation: number | undefined,
    colors: string[],
    cfg: any,
  ): EChartsOption {
    const correlationText = correlation !== undefined ? correlation.toFixed(3) : 'N/A';
    return {
      ...base,
      title: {
        text: `${varX} vs ${varY}`,
        subtext: `Correlación: ${correlationText}`,
        left: 'center',
        textStyle: { color: cfg.textColor },
        subtextStyle: { color: cfg.textColorSecondary },
      },
      xAxis: {
        type: 'value',
        name: varX,
        scale: true,
        axisLabel: { color: cfg.textColorSecondary },
        splitLine: { lineStyle: { color: cfg.splitLineColor } },
      },
      yAxis: {
        type: 'value',
        name: varY,
        scale: true,
        axisLabel: { color: cfg.textColorSecondary },
        splitLine: { lineStyle: { color: cfg.splitLineColor } },
      },
      series: [
        {
          type: 'scatter',
          data: d.points,
          symbolSize: 8,
          itemStyle: { color: colors[5], opacity: 0.7 },
          emphasis: { itemStyle: { opacity: 1, borderColor: '#fff', borderWidth: 2 } },
        },
      ],
      grid: { bottom: 50, left: 60, right: 30, top: 70 },
    };
  }

  private getHeatmapOptions(
    base: EChartsOption,
    d: any,
    varX: string,
    varY: string,
    cfg: any,
  ): EChartsOption {
    const maxVal = Math.max(...d.heatmap.map((h: [number, number, number]) => h[2]), 1);
    return {
      ...base,
      title: { text: `${varX} × ${varY}`, left: 'center', textStyle: { color: cfg.textColor } },
      xAxis: {
        type: 'category',
        data: d.labels_x,
        axisLabel: { color: cfg.textColorSecondary, rotate: 45 },
        splitArea: { show: true },
      },
      yAxis: {
        type: 'category',
        data: d.labels_y,
        axisLabel: { color: cfg.textColorSecondary },
        splitArea: { show: true },
      },
      visualMap: {
        min: 0,
        max: maxVal,
        calculable: true,
        orient: 'horizontal',
        left: 'center',
        bottom: 10,
        inRange: { color: ['#FDF2F8', '#FBCFE8', '#F9A8D4', '#EC4899', '#BE185D'] },
      },
      series: [
        {
          type: 'heatmap',
          data: d.heatmap,
          label: {
            show: d.labels_x.length <= 8 && d.labels_y.length <= 8,
            formatter: (p: any) => (p.value[2] > 0 ? p.value[2] : ''),
          },
          emphasis: { itemStyle: { shadowBlur: 10 } },
        },
      ],
      grid: { bottom: 70, top: 60, left: 80, right: 20 },
    };
  }

  private getStackedBarOptions(
    base: EChartsOption,
    d: any,
    varX: string,
    varY: string,
    colors: string[],
    cfg: any,
    type: string,
  ): EChartsOption {
    return {
      ...base,
      title: { text: `${varY} por ${varX}`, left: 'center', textStyle: { color: cfg.textColor } },
      legend: { bottom: 10, textStyle: { color: cfg.textColorSecondary }, type: 'scroll' },
      xAxis: {
        type: 'category',
        data: d.labels_x,
        axisLabel: { color: cfg.textColorSecondary, rotate: d.labels_x.length > 6 ? 45 : 0 },
      },
      yAxis: {
        type: 'value',
        axisLabel: { color: cfg.textColorSecondary },
        splitLine: { lineStyle: { color: cfg.splitLineColor } },
      },
      series: d.series.map((s: any, i: number) => ({
        name: s.name,
        type: 'bar',
        stack: type === 'stacked_bar' ? 'total' : undefined,
        data: s.data,
        itemStyle: {
          color: colors[i % colors.length],
          borderRadius: type !== 'stacked_bar' ? [4, 4, 0, 0] : 0,
        },
      })),
      grid: { bottom: 70, left: 60, right: 20, top: 60 },
    };
  }

  private getComparativeBarOptions(
    base: EChartsOption,
    categories: string[],
    values: number[],
    varX: string,
    varY: string,
    colors: string[],
    cfg: any,
  ): EChartsOption {
    const total = values.reduce((a: number, b: number) => a + b, 0);
    const avg = total / values.length;

    return {
      ...base,
      title: {
        text: `Promedio de ${varY} por ${varX}`,
        subtext: `${categories.length} categorías`,
        left: 'center',
        textStyle: { color: cfg.textColor },
        subtextStyle: { color: cfg.textColorSecondary },
      },
      xAxis: {
        type: 'category',
        data: categories,
        axisLabel: { color: cfg.textColorSecondary, rotate: categories.length > 5 ? 45 : 0 },
      },
      yAxis: {
        type: 'value',
        name: `Promedio de ${varY}`,
        axisLabel: { color: cfg.textColorSecondary },
        splitLine: { lineStyle: { color: cfg.splitLineColor } },
      },
      series: [
        {
          type: 'bar',
          data: values.map((v: number, i: number) => ({
            value: v,
            name: categories[i],
            itemStyle: {
              color: {
                type: 'linear',
                x: 0,
                y: 0,
                x2: 0,
                y2: 1,
                colorStops: [
                  { offset: 0, color: colors[i % colors.length] },
                  { offset: 1, color: this.adjustColor(colors[i % colors.length], -40) },
                ],
              },
              borderRadius: [6, 6, 0, 0],
            },
          })),
          barWidth: '60%',
          markLine: {
            silent: true,
            symbol: 'none',
            lineStyle: { color: '#EF4444', type: 'dashed', width: 2 },
            data: [
              {
                yAxis: avg,
                label: {
                  formatter: `Prom: ${avg.toFixed(1)}`,
                  position: 'end',
                  color: '#EF4444',
                },
              },
            ],
          },
        },
      ],
      grid: { bottom: categories.length > 5 ? 90 : 50, left: 70, right: 20, top: 70 },
    };
  }

  private getHorizontalBarOptions(
    base: EChartsOption,
    title: string,
    labels: string[],
    values: number[],
    colors: string[],
    cfg: any,
  ): EChartsOption {
    const displayLabels = this.truncateLabels(labels, 20);
    return {
      ...base,
      title: { text: title, left: 'center', textStyle: { color: cfg.textColor } },
      tooltip: {
        ...(base.tooltip as any),
        trigger: 'axis',
        formatter: (params: any) => {
          const p = Array.isArray(params) ? params[0] : params;
          const idx = p.dataIndex;
          const fullLabel = labels[idx] || p.name;
          return `<strong>${fullLabel}</strong><br/>${p.value}`;
        },
      },
      yAxis: {
        type: 'category',
        data: displayLabels,
        axisLabel: { color: cfg.textColorSecondary, width: 120, overflow: 'truncate' },
      },
      xAxis: {
        type: 'value',
        axisLabel: { color: cfg.textColorSecondary },
        splitLine: { lineStyle: { color: cfg.splitLineColor } },
      },
      series: [
        {
          type: 'bar',
          data: values.map((v, i) => ({
            value: v,
            itemStyle: { color: colors[i % colors.length], borderRadius: [0, 4, 4, 0] },
          })),
        },
      ],
      grid: { bottom: 40, left: 120, right: 30, top: 60 },
    };
  }

  private getRoseOptions(
    base: EChartsOption,
    title: string,
    labels: string[],
    values: number[],
    colors: string[],
    cfg: any,
  ): EChartsOption {
    return {
      ...base,
      title: { text: title, left: 'center', textStyle: { color: cfg.textColor } },
      legend: { bottom: 10, textStyle: { color: cfg.textColorSecondary }, type: 'scroll' },
      tooltip: {
        ...(base.tooltip as any),
        trigger: 'item',
        formatter: '{b}: {c} ({d}%)',
      },
      series: [
        {
          type: 'pie',
          radius: ['20%', '70%'],
          center: ['50%', '50%'],
          roseType: 'radius',
          itemStyle: { borderRadius: 5, borderColor: cfg.tooltipBg, borderWidth: 2 },
          data: labels.map((l, i) => ({
            name: l,
            value: values[i],
            itemStyle: { color: colors[i % colors.length] },
          })),
          label: {
            show: true,
            color: cfg.textColorSecondary,
            formatter: '{b}: {d}%',
          },
          emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.2)' } },
        },
      ],
    };
  }

  private getPolarBarOptions(
    base: EChartsOption,
    title: string,
    labels: string[],
    values: number[],
    colors: string[],
    cfg: any,
  ): EChartsOption {
    return {
      ...base,
      title: { text: title, left: 'center', textStyle: { color: cfg.textColor } },
      polar: { radius: [30, '80%'] },
      angleAxis: {
        max: Math.max(...values) * 1.2,
        startAngle: 90,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { show: false },
        splitLine: { lineStyle: { color: cfg.splitLineColor } },
      },
      radiusAxis: {
        type: 'category',
        data: labels,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: cfg.textColorSecondary },
      },
      tooltip: {
        ...(base.tooltip as any),
        trigger: 'item',
        formatter: (params: any) => `${params.name}: ${params.value}`,
      },
      series: [
        {
          type: 'bar',
          coordinateSystem: 'polar',
          data: values.map((v, i) => ({
            value: v,
            itemStyle: {
              color: {
                type: 'linear',
                x: 0,
                y: 0,
                x2: 1,
                y2: 0,
                colorStops: [
                  { offset: 0, color: `${colors[i % colors.length]}80` },
                  { offset: 1, color: colors[i % colors.length] },
                ],
              },
              borderRadius: 4,
            },
          })),
          barWidth: '60%',
        },
      ],
    } as any;
  }

  private getPictorialBarOptions(
    base: EChartsOption,
    title: string,
    labels: string[],
    values: number[],
    colors: string[],
    cfg: any,
  ): EChartsOption {
    return {
      ...base,
      title: { text: title, left: 'center', textStyle: { color: cfg.textColor } },
      xAxis: {
        type: 'category',
        data: labels,
        axisLabel: { color: cfg.textColorSecondary, rotate: labels.length > 6 ? 45 : 0 },
        axisTick: { show: false },
        axisLine: { lineStyle: { color: cfg.splitLineColor } },
      },
      yAxis: {
        type: 'value',
        axisLabel: { color: cfg.textColorSecondary },
        splitLine: { lineStyle: { color: cfg.splitLineColor } },
      },
      series: [
        {
          type: 'pictorialBar',
          symbol: 'roundRect',
          symbolRepeat: true,
          symbolSize: ['80%', 10],
          symbolMargin: 2,
          data: values.map((v, i) => ({
            value: v,
            itemStyle: { color: colors[i % colors.length] },
          })),
        },
      ],
      grid: { bottom: labels.length > 6 ? 80 : 40, left: 60, right: 20, top: 60 },
    } as any;
  }

  private getBubbleOptions(
    base: EChartsOption,
    d: any,
    varX: string,
    varY: string,
    correlation: number | undefined,
    colors: string[],
    cfg: any,
  ): EChartsOption {
    const points: [number, number][] = d.points || [];
    const allX = points.map((p) => Math.abs(p[0]));
    const allY = points.map((p) => Math.abs(p[1]));
    const maxMag = Math.max(...allX, ...allY, 1);
    const correlationText = correlation !== undefined ? correlation.toFixed(3) : 'N/A';

    return {
      ...base,
      title: {
        text: `${varX} vs ${varY}`,
        subtext: `Correlación: ${correlationText}`,
        left: 'center',
        textStyle: { color: cfg.textColor },
        subtextStyle: { color: cfg.textColorSecondary },
      },
      xAxis: {
        type: 'value',
        name: varX,
        scale: true,
        axisLabel: { color: cfg.textColorSecondary },
        splitLine: { lineStyle: { color: cfg.splitLineColor } },
      },
      yAxis: {
        type: 'value',
        name: varY,
        scale: true,
        axisLabel: { color: cfg.textColorSecondary },
        splitLine: { lineStyle: { color: cfg.splitLineColor } },
      },
      series: [
        {
          type: 'scatter',
          data: points.map((p) => [p[0], p[1], Math.abs(p[0]) + Math.abs(p[1])]),
          symbolSize: (data: number[]) => {
            const ratio = data[2] / maxMag;
            return Math.max(8, Math.min(50, ratio * 35 + 8));
          },
          itemStyle: {
            color: (params: any) => {
              const c = colors[params.dataIndex % colors.length];
              return `${c}BB`;
            },
          },
          emphasis: { itemStyle: { opacity: 1, borderColor: '#fff', borderWidth: 2 } },
        },
      ],
      grid: { bottom: 50, left: 60, right: 30, top: 70 },
    } as any;
  }

  private getStackedAreaOptions(
    base: EChartsOption,
    d: any,
    varX: string,
    varY: string,
    colors: string[],
    cfg: any,
  ): EChartsOption {
    return {
      ...base,
      title: {
        text: `${varY} por ${varX}`,
        left: 'center',
        textStyle: { color: cfg.textColor },
      },
      legend: { bottom: 10, textStyle: { color: cfg.textColorSecondary }, type: 'scroll' },
      xAxis: {
        type: 'category',
        data: d.labels_x,
        boundaryGap: false,
        axisLabel: {
          color: cfg.textColorSecondary,
          rotate: d.labels_x.length > 6 ? 45 : 0,
        },
      },
      yAxis: {
        type: 'value',
        axisLabel: { color: cfg.textColorSecondary },
        splitLine: { lineStyle: { color: cfg.splitLineColor } },
      },
      series: d.series.map((s: any, i: number) => ({
        name: s.name,
        type: 'line',
        stack: 'total',
        smooth: true,
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: `${colors[i % colors.length]}60` },
              { offset: 1, color: `${colors[i % colors.length]}10` },
            ],
          },
        },
        data: s.data,
        itemStyle: { color: colors[i % colors.length] },
        emphasis: { focus: 'series' },
      })),
      grid: { bottom: 70, left: 60, right: 20, top: 60 },
    };
  }

  private adjustColor(color: string, amount: number): string {
    const clamp = (val: number) => Math.min(255, Math.max(0, val));
    let hex = color.replace('#', '');
    if (hex.length === 3)
      hex = hex
        .split('')
        .map((c) => c + c)
        .join('');
    const r = clamp(parseInt(hex.substring(0, 2), 16) + amount);
    const g = clamp(parseInt(hex.substring(2, 4), 16) + amount);
    const b = clamp(parseInt(hex.substring(4, 6), 16) + amount);
    return `#${[r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
  }
}
