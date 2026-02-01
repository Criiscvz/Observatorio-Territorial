import { Injectable, inject, computed } from '@angular/core';
import { ThemeService } from './theme.service';
import { ChartThemeConfig } from './chart-theme.interfaces';

// Re-export interfaces for convenience
export * from './chart-theme.interfaces';

@Injectable({
  providedIn: 'root'
})
export class ChartThemeService {
  private readonly themeService = inject(ThemeService);

  // Paleta de colores para tema claro
  private readonly lightColors = [
    '#6366F1', // Indigo
    '#EC4899', // Pink
    '#14B8A6', // Teal
    '#F59E0B', // Amber
    '#EF4444', // Red
    '#8B5CF6', // Violet
    '#06B6D4', // Cyan
    '#84CC16', // Lime
    '#F97316', // Orange
    '#3B82F6', // Blue
    '#10B981', // Emerald
    '#E11D48', // Rose
  ];

  // Paleta de colores para tema oscuro (más brillantes)
  private readonly darkColors = [
    '#818CF8', // Indigo Light
    '#F472B6', // Pink Light
    '#2DD4BF', // Teal Light
    '#FBBF24', // Amber Light
    '#F87171', // Red Light
    '#A78BFA', // Violet Light
    '#22D3EE', // Cyan Light
    '#A3E635', // Lime Light
    '#FB923C', // Orange Light
    '#60A5FA', // Blue Light
    '#34D399', // Emerald Light
    '#FB7185', // Rose Light
  ];

  // Gradientes para gráficos
  readonly lightGradients = [
    { start: '#6366F1', end: '#4F46E5' },
    { start: '#EC4899', end: '#DB2777' },
    { start: '#14B8A6', end: '#0D9488' },
    { start: '#F59E0B', end: '#D97706' },
    { start: '#EF4444', end: '#DC2626' },
  ];

  readonly darkGradients = [
    { start: '#818CF8', end: '#6366F1' },
    { start: '#F472B6', end: '#EC4899' },
    { start: '#2DD4BF', end: '#14B8A6' },
    { start: '#FBBF24', end: '#F59E0B' },
    { start: '#F87171', end: '#EF4444' },
  ];

  // Computed para obtener configuración actual del tema
  readonly config = computed<ChartThemeConfig>(() => {
    const isDark = this.themeService.isDark();
    
    return isDark ? {
      colors: this.darkColors,
      backgroundColor: 'transparent',
      textColor: '#F9FAFB',
      textColorSecondary: '#9CA3AF',
      borderColor: '#334155',
      axisLineColor: '#475569',
      splitLineColor: '#334155',
      tooltipBg: 'rgba(30, 41, 59, 0.95)',
      tooltipBorder: '#475569',
    } : {
      colors: this.lightColors,
      backgroundColor: 'transparent',
      textColor: '#111827',
      textColorSecondary: '#6B7280',
      borderColor: '#E5E7EB',
      axisLineColor: '#D1D5DB',
      splitLineColor: '#F3F4F6',
      tooltipBg: 'rgba(255, 255, 255, 0.95)',
      tooltipBorder: '#E5E7EB',
    };
  });

  /**
   * Obtiene la paleta de colores actual según el tema
   */
  getColors(): string[] {
    return this.themeService.isDark() ? this.darkColors : this.lightColors;
  }

  /**
   * Obtiene un color específico de la paleta
   */
  getColor(index: number): string {
    const colors = this.getColors();
    return colors[index % colors.length];
  }

  /**
   * Obtiene los gradientes según el tema
   */
  getGradients(): { start: string; end: string }[] {
    return this.themeService.isDark() ? this.darkGradients : this.lightGradients;
  }

  /**
   * Obtiene un gradiente específico
   */
  getGradient(index: number): { start: string; end: string } {
    const gradients = this.getGradients();
    return gradients[index % gradients.length];
  }

  /**
   * Genera configuración base de ECharts con tema aplicado
   */
  getBaseChartOptions(): any {
    const cfg = this.config();
    
    return {
      backgroundColor: cfg.backgroundColor,
      textStyle: {
        color: cfg.textColor,
        fontFamily: "'Inter', system-ui, sans-serif",
      },
      title: {
        textStyle: {
          color: cfg.textColor,
          fontWeight: 600,
        },
        subtextStyle: {
          color: cfg.textColorSecondary,
        },
      },
      legend: {
        textStyle: {
          color: cfg.textColorSecondary,
        },
        pageTextStyle: {
          color: cfg.textColorSecondary,
        },
      },
      tooltip: {
        backgroundColor: cfg.tooltipBg,
        borderColor: cfg.tooltipBorder,
        textStyle: {
          color: cfg.textColor,
        },
        extraCssText: 'box-shadow: 0 4px 12px rgba(0,0,0,0.15); border-radius: 8px;',
      },
      xAxis: {
        axisLine: {
          lineStyle: { color: cfg.axisLineColor },
        },
        axisTick: {
          lineStyle: { color: cfg.axisLineColor },
        },
        axisLabel: {
          color: cfg.textColorSecondary,
        },
        splitLine: {
          lineStyle: { color: cfg.splitLineColor },
        },
      },
      yAxis: {
        axisLine: {
          lineStyle: { color: cfg.axisLineColor },
        },
        axisTick: {
          lineStyle: { color: cfg.axisLineColor },
        },
        axisLabel: {
          color: cfg.textColorSecondary,
        },
        splitLine: {
          lineStyle: { color: cfg.splitLineColor },
        },
      },
      grid: {
        borderColor: cfg.borderColor,
      },
      color: cfg.colors,
    };
  }

  /**
   * Obtiene opciones de tooltip mejoradas
   */
  getTooltipOptions(showPercentage = false): any {
    const cfg = this.config();
    
    return {
      trigger: 'item' as const,
      backgroundColor: cfg.tooltipBg,
      borderColor: cfg.tooltipBorder,
      borderWidth: 1,
      padding: [12, 16],
      textStyle: {
        color: cfg.textColor,
        fontSize: 13,
      },
      extraCssText: 'box-shadow: 0 4px 20px rgba(0,0,0,0.15); border-radius: 12px;',
      formatter: showPercentage 
        ? (params: any) => {
            const value = params.value;
            const percent = params.percent ? `(${params.percent.toFixed(1)}%)` : '';
            return `<strong>${params.name}</strong><br/>${params.seriesName || ''}: ${value.toLocaleString()} ${percent}`;
          }
        : undefined,
    };
  }

  /**
   * Obtiene opciones de animación
   */
  getAnimationOptions(): any {
    return {
      animation: true,
      animationDuration: 800,
      animationEasing: 'cubicOut' as const,
      animationDelay: (idx: number) => idx * 50,
    };
  }

  /**
   * Obtiene opciones de animación extendidas para diferentes efectos
   */
  getEnhancedAnimations(type: 'bar' | 'pie' | 'line' | 'scatter' | 'default' = 'default'): any {
    const base = {
      animation: true,
      animationThreshold: 2000,
    };

    switch (type) {
      case 'bar':
        return {
          ...base,
          animationDuration: 600,
          animationEasing: 'elasticOut' as const,
          animationDelay: (idx: number) => idx * 30,
          animationDurationUpdate: 300,
        };
      case 'pie':
        return {
          ...base,
          animationDuration: 1000,
          animationType: 'scale' as const,
          animationEasing: 'elasticOut' as const,
        };
      case 'line':
        return {
          ...base,
          animationDuration: 1200,
          animationEasing: 'cubicInOut' as const,
        };
      case 'scatter':
        return {
          ...base,
          animationDuration: 600,
          animationEasing: 'cubicOut' as const,
          animationDelay: (idx: number) => idx * 5,
        };
      default:
        return {
          ...base,
          animationDuration: 800,
          animationEasing: 'cubicOut' as const,
        };
    }
  }

  /**
   * Obtiene opciones de leyenda mejoradas
   */
  getEnhancedLegend(position: 'bottom' | 'right' | 'top' = 'bottom'): any {
    const cfg = this.config();
    const base = {
      textStyle: { 
        color: cfg.textColorSecondary,
        fontSize: 12,
      },
      itemGap: 16,
      itemWidth: 14,
      itemHeight: 14,
      icon: 'roundRect',
      pageTextStyle: { color: cfg.textColorSecondary },
      pageIconColor: cfg.textColorSecondary,
      pageIconInactiveColor: cfg.borderColor,
    };

    switch (position) {
      case 'right':
        return {
          ...base,
          orient: 'vertical' as const,
          right: 20,
          top: 'middle' as const,
          type: 'scroll' as const,
        };
      case 'top':
        return {
          ...base,
          orient: 'horizontal' as const,
          top: 10,
          left: 'center' as const,
        };
      default:
        return {
          ...base,
          orient: 'horizontal' as const,
          bottom: 10,
          left: 'center' as const,
          type: 'scroll' as const,
        };
    }
  }

  /**
   * Obtiene opciones de grid responsivas
   */
  getResponsiveGrid(hasLegendBottom = true): any {
    return {
      top: 70,
      right: 30,
      bottom: hasLegendBottom ? 80 : 50,
      left: 60,
      containLabel: true,
    };
  }

  /**
   * Obtiene opciones de zoom para gráficos de línea/área
   */
  getDataZoomOptions(): any[] {
    const cfg = this.config();
    
    return [
      {
        type: 'inside',
        start: 0,
        end: 100,
      },
      {
        type: 'slider',
        show: true,
        start: 0,
        end: 100,
        height: 20,
        bottom: 10,
        borderColor: cfg.borderColor,
        fillerColor: 'rgba(99, 102, 241, 0.2)',
        handleStyle: {
          color: cfg.colors[0],
        },
        textStyle: {
          color: cfg.textColorSecondary,
        },
      },
    ];
  }

  /**
   * Obtiene color según el valor de correlación
   */
  getCorrelationColor(correlation: number): string {
    const absCorr = Math.abs(correlation);
    
    if (absCorr >= 0.7) {
      return correlation > 0 ? '#10B981' : '#EF4444'; // Verde fuerte / Rojo fuerte
    } else if (absCorr >= 0.4) {
      return correlation > 0 ? '#34D399' : '#F87171'; // Verde medio / Rojo medio
    } else if (absCorr >= 0.2) {
      return '#F59E0B'; // Amarillo (correlación débil)
    } else {
      return '#6B7280'; // Gris (sin correlación)
    }
  }

  /**
   * Obtiene texto descriptivo de correlación
   */
  getCorrelationText(correlation: number): string {
    const absCorr = Math.abs(correlation);
    const direction = correlation > 0 ? 'positiva' : 'negativa';
    
    if (absCorr >= 0.7) {
      return `Correlación ${direction} fuerte`;
    } else if (absCorr >= 0.4) {
      return `Correlación ${direction} moderada`;
    } else if (absCorr >= 0.2) {
      return `Correlación ${direction} débil`;
    } else {
      return 'Sin correlación significativa';
    }
  }
}
