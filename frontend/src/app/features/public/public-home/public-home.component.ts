import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Component, inject, OnInit, PLATFORM_ID, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { APP_CONFIG } from '@core/config';
import { Departamento } from '@core/models';
import { AuthService } from '@core/services/auth.service';
import { DepartamentoService } from '@core/services/departamento.service';
import { LanguageService } from '@core/services/language.service';
import { ThemeService } from '@core/services/theme.service';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-public-home',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    RouterLinkActive,
    MatButtonModule,
    MatDividerModule,
    MatIconModule,
    MatCardModule,
    MatMenuModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    TranslateModule,
  ],
  templateUrl: './public-home.component.html',
  styleUrl: './public-home.component.scss',
})
export class PublicHomeComponent implements OnInit {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly deptoService = inject(DepartamentoService);
  readonly authService = inject(AuthService);
  readonly themeService = inject(ThemeService);
  readonly languageService = inject(LanguageService);

  readonly appConfig = APP_CONFIG;

  departamentos = signal<Departamento[]>([]);
  loading = signal(true);
  currentYear = new Date().getFullYear();

  private readonly deptoColors = [
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

  get totalDatasets(): number {
    return this.departamentos().reduce((sum, d) => sum + (d.datasets?.length || 0), 0);
  }

  get totalRegistros(): number {
    return this.departamentos().reduce((sum, d) => {
      const datasets = d.datasets || [];
      return sum + datasets.reduce((s, ds) => s + (ds.total_registros || 0), 0);
    }, 0);
  }

  ngOnInit(): void {
    // Solo cargar datos en el navegador, no durante SSR
    if (isPlatformBrowser(this.platformId)) {
      this.loadDepartamentos();
    } else {
      // Durante SSR, simplemente marcar como no cargando
      this.loading.set(false);
    }
  }

  loadDepartamentos(): void {
    this.deptoService.getPublicos().subscribe({
      next: (deptos) => {
        this.departamentos.set(deptos || []);
        this.loading.set(false);
      },
      error: () => {
        this.departamentos.set([]);
        this.loading.set(false);
      },
    });
  }

  getDeptoColor(index: number): string {
    return this.deptoColors[index % this.deptoColors.length];
  }

  formatNumber(num: number): string {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  }
}
