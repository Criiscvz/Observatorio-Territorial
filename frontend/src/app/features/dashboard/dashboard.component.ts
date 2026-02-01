import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatRippleModule } from '@angular/material/core';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RouterLink } from '@angular/router';
import { Dataset, Departamento } from '../../core/models';
import { AuthService } from '../../core/services/auth.service';
import { DepartamentoService } from '../../core/services/departamento.service';

interface StatCard {
  title: string;
  icon: string;
  gradient: string;
  iconBg: string;
}

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
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements OnInit {
  private readonly deptoService = inject(DepartamentoService);
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
    // Ordenar por fecha y tomar los últimos 5
    return allDatasets
      .sort(
        (a, b) => new Date(b.fecha_carga || 0).getTime() - new Date(a.fecha_carga || 0).getTime(),
      )
      .slice(0, 5);
  });

  ngOnInit(): void {
    this.loadDepartamentos();
  }

  loadDepartamentos(): void {
    this.deptoService.getAll().subscribe({
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
        return 'text-green-600';
      case 'PROCESANDO':
        return 'text-yellow-600';
      case 'ERROR':
        return 'text-red-600';
      default:
        return 'text-gray-600';
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
