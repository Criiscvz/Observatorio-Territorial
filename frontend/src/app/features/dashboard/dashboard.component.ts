import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal, DestroyRef } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatRippleModule } from '@angular/material/core';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import { Dataset, Departamento } from '@core/models';
import { ObservatorioPublicacion } from '@core/models/publicacion/publicacion.interface';
import { AuthService } from '@core/services/auth.service';
import { DepartamentoService } from '@core/services/departamento.service';
import { PublicacionService } from '@core/services/publicacion.service';
import { SubscriberAccessDialogComponent } from '@shared/components/subscriber-access-dialog';
import { TranslateModule } from '@ngx-translate/core';
import { environment } from '../../../environments/environment';
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
    MatDialogModule,
    MatRippleModule,
    MatTooltipModule,
    TranslateModule,
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly deptoService = inject(DepartamentoService);
  private readonly publicacionService = inject(PublicacionService);
  private readonly dialog = inject(MatDialog);
  authService = inject(AuthService);

  departamentos = signal<Departamento[]>([]);
  atlasReportes = signal<ObservatorioPublicacion[]>([]);
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

  getAtlasUrl(reporte: ObservatorioPublicacion): string | null {
    if (this.isContentLocked(reporte)) return null;
    const url = reporte.sharepoint_url || reporte.link_url || reporte.download_url;
    if (!url) return null;
    if (/^https?:\/\//i.test(url)) return url;
    return `${environment.apiUrl}${url.replace(/^\/api/, '')}`;
  }

  isContentLocked(reporte: ObservatorioPublicacion): boolean {
    if (reporte.bloqueado) return true;
    if (!reporte.solo_suscriptores) return false;
    return !this.authService.isAdmin() && !this.authService.isSubscriber();
  }

  showSubscriberMessage(): void {
    this.dialog.open(SubscriberAccessDialogComponent, {
      width: 'min(92vw, 460px)',
      maxWidth: '92vw',
      panelClass: 'subscriber-access-dialog-panel',
      backdropClass: 'subscriber-access-dialog-backdrop',
      autoFocus: false,
      restoreFocus: false,
      data: {
        title: 'Contenido exclusivo para suscriptores',
        message:
          'Este contenido está disponible exclusivamente para usuarios suscriptores. Inicie sesión con una cuenta suscriptora o suscríbase para obtener acceso.',
        icon: 'lock',
        closeText: 'Entendido',
      },
    });
  }

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

  ngOnInit(): void {
    this.loadDepartamentos();
    this.loadAtlasReportes();
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

  loadAtlasReportes(): void {
    this.publicacionService
      .getRecentAtlasReports()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (items) => this.atlasReportes.set(items || []),
        error: () => this.atlasReportes.set([]),
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
