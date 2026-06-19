import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal, DestroyRef } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatRippleModule } from '@angular/material/core';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import { Dataset, Departamento } from '@core/models';
import { AuthService } from '@core/services/auth.service';
import { DepartamentoService } from '@core/services/departamento.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import type { EChartsOption } from 'echarts';
import { NgxEchartsDirective } from 'ngx-echarts';
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatRippleModule,
    MatTooltipModule,
    TranslateModule,
    NgxEchartsDirective,
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit {
    private readonly destroyRef = inject(DestroyRef);
  private readonly deptoService = inject(DepartamentoService);
  private readonly translate = inject(TranslateService);
  authService = inject(AuthService);

  departamentos = signal<Departamento[]>([]);
  loading = signal(true);

  // Computed values
  totalDatasets = computed(() => {
    let count = 0;
    this.departamentos().forEach((d) => {
      count += d.datasets?.length || 0;
    });
    return count;
  });

  totalRegistros = computed(() => {
    let count = 0;
    this.departamentos().forEach((d) => {
      d.datasets?.forEach((ds) => {
        count += ds.total_registros || 0;
      });
    });
    return count;
  });

  totalVariables = computed(() => {
    let count = 0;
    this.departamentos().forEach((d) => {
      d.datasets?.forEach((ds) => {
        count += ds.variables_metadatos?.length || 0;
      });
    });
    return count;
  });

  departamentosPublicos = computed(() => {
    return this.departamentos().filter((d) => d.publico).length;
  });

  departamentosRecientes = computed(() => {
    return this.departamentos().slice(0, 5);
  });

  datasetsRecientes = computed(() => {
    const allDatasets: Dataset[] = [];
    this.departamentos().forEach((d) => {
      d.datasets?.forEach((ds) => {
        allDatasets.push(ds);
      });
    });
    return allDatasets
      .sort(
        (a, b) => new Date(b.fecha_carga || 0).getTime() - new Date(a.fecha_carga || 0).getTime(),
      )
      .slice(0, 5);
  });

  datasetsByStatus = computed(() => {
    const status: Record<string, number> = {
      COMPLETADO: 0,
      PROCESANDO: 0,
      ERROR: 0,
      PENDIENTE: 0,
    };
    this.departamentos().forEach((d) => {
      d.datasets?.forEach((ds) => {
        status[ds.estado] = (status[ds.estado] || 0) + 1;
      });
    });
    return status;
  });

  completionRate = computed(() => {
    const total = this.totalDatasets();
    if (total === 0) return 0;
    return Math.round((this.datasetsByStatus()['COMPLETADO'] / total) * 100);
  });

  distributionChartOptions = computed<EChartsOption>(() => {
    const deptos = this.departamentos();
    if (deptos.length === 0) return {};

    const sorted = [...deptos]
      .map((d) => ({
        name: d.nombre,
        count: d.datasets?.length || 0,
        publico: d.publico,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
      },
      grid: {
        left: 8,
        right: 24,
        top: 8,
        bottom: 0,
        containLabel: true,
      },
      xAxis: {
        type: 'value',
        splitLine: { show: false },
        axisLabel: { show: false },
        axisTick: { show: false },
        axisLine: { show: false },
      },
      yAxis: {
        type: 'category',
        data: sorted.map((d) => d.name),
        inverse: true,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: 'var(--text-secondary)',
          fontSize: 12,
          width: 120,
          overflow: 'truncate',
        },
      },
      series: [
        {
          type: 'bar',
          data: sorted.map((d) => ({
            value: d.count,
            itemStyle: {
              color: d.publico ? '#6366f1' : '#94a3b8',
              borderRadius: [0, 4, 4, 0],
            },
          })),
          barWidth: 18,
          label: {
            show: true,
            position: 'right',
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--text-primary)',
          },
        },
      ],
    };
  });

  statusChartOptions = computed<EChartsOption>(() => {
    const status = this.datasetsByStatus();
    const total = this.totalDatasets();
    if (total === 0) return {};

    const data = [
      { value: status['COMPLETADO'], name: this.translate.instant('datasets.status.completed') || 'Completado', itemStyle: { color: '#10b981' } },
      { value: status['PROCESANDO'], name: this.translate.instant('datasets.status.processing') || 'Procesando', itemStyle: { color: '#f59e0b' } },
      { value: status['ERROR'], name: this.translate.instant('datasets.status.error') || 'Error', itemStyle: { color: '#ef4444' } },
      { value: status['PENDIENTE'], name: this.translate.instant('datasets.status.pending') || 'Pendiente', itemStyle: { color: '#94a3b8' } },
    ].filter((d) => d.value > 0);

    return {
      tooltip: {
        trigger: 'item',
        formatter: '{b}: {c} ({d}%)',
      },
      series: [
        {
          type: 'pie',
          radius: ['55%', '80%'],
          center: ['50%', '50%'],
          avoidLabelOverlap: false,
          itemStyle: {
            borderRadius: 4,
            borderColor: 'var(--card-bg)',
            borderWidth: 2,
          },
          label: { show: false },
          emphasis: {
            label: { show: false },
          },
          data,
        },
      ],
    };
  });

  ngOnInit(): void {
    this.loadDepartamentos();
  }

  loadDepartamentos(): void {
    this.deptoService.getAll().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (departamentos) => {
        this.departamentos.set(departamentos || []);
        this.loading.set(false);
      },
      error: () => {
        this.departamentos.set([]);
        this.loading.set(false);
      },
    });
  }

  getEstadoClass(estado: string): string {
    switch (estado) {
      case 'COMPLETADO':
        return 'text-success';
      case 'PROCESANDO':
        return 'text-warning';
      case 'ERROR':
        return 'text-error';
      default:
        return 'text-[var(--text-secondary)]';
    }
  }

  getEstadoBadgeClass(estado: string): string {
    switch (estado) {
      case 'COMPLETADO':
        return 'success';
      case 'PROCESANDO':
        return 'warning';
      case 'ERROR':
        return 'error';
      default:
        return 'info';
    }
  }

  getGreeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'Buenos días';
    if (hour < 18) return 'Buenas tardes';
    return 'Buenas noches';
  }

  formatNumber(num: number): string {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  }

  // Colores para departamentos
  private deptoColors = [
    '#6366F1',
    '#EC4899',
    '#14B8A6',
    '#F59E0B',
    '#EF4444',
    '#8B5CF6',
    '#06B6D4',
    '#84CC16',
    '#F97316',
    '#3B82F6',
  ];

  getDeptoColor(index: number): string {
    return this.deptoColors[index % this.deptoColors.length];
  }
}
