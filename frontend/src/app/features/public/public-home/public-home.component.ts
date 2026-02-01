import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { Departamento } from '@core/models';
import { DepartamentoService } from '@core/services/departamento.service';
import { ThemeService } from '@core/services/theme.service';

@Component({
  selector: 'app-public-home',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatProgressSpinnerModule,
    TranslateModule,
  ],
  templateUrl: './public-home.component.html',
  styleUrl: './public-home.component.scss',
})
export class PublicHomeComponent implements OnInit {
  private deptoService = inject(DepartamentoService);
  readonly themeService = inject(ThemeService);

  departamentos = signal<Departamento[]>([]);
  loading = signal(true);
  currentYear = new Date().getFullYear();

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

  get totalDatasets(): number {
    return this.departamentos().reduce((sum, d) => sum + (d.datasets_count || 0), 0);
  }

  get totalRegistros(): number {
    return this.departamentos().reduce((sum, d) => {
      const datasets = d.datasets || [];
      return sum + datasets.reduce((s, ds) => s + (ds.total_registros || 0), 0);
    }, 0);
  }

  ngOnInit(): void {
    this.loadDepartamentos();
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
