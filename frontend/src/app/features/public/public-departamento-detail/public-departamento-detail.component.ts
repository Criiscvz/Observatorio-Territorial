import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Component, DestroyRef, inject, OnInit, PLATFORM_ID, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { Dataset, Departamento } from '@core/models';
import { DepartamentoService } from '@core/services/departamento.service';

@Component({
  selector: 'app-public-departamento-detail',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatChipsModule,
    TranslateModule,
  ],
  templateUrl: './public-departamento-detail.component.html',
  styleUrl: './public-departamento-detail.component.scss',
})
export class PublicDepartamentoDetailComponent implements OnInit {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly route = inject(ActivatedRoute);
  private readonly deptoService = inject(DepartamentoService);
  private readonly destroyRef = inject(DestroyRef);

  departamento = signal<Departamento | null>(null);
  loading = signal(true);

  deptoGradient = 'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)';

  private readonly datasetColors = [
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

  get datasets(): Dataset[] {
    return this.departamento()?.datasets || [];
  }

  get totalRegistros(): number {
    return this.datasets.reduce((sum, ds) => sum + (ds.total_registros || 0), 0);
  }

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.route.params.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
        const id = params['id'];
        if (id) {
          this.loadDepartamento(id);
        }
      });
    } else {
      this.loading.set(false);
    }
  }

  loadDepartamento(id: string): void {
    this.deptoService.getPublicById(id).subscribe({
      next: (depto) => {
        this.departamento.set(depto);
        this.loading.set(false);
      },
      error: () => {
        this.departamento.set(null);
        this.loading.set(false);
      },
    });
  }

  getDatasetColor(index: number): string {
    return this.datasetColors[index % this.datasetColors.length];
  }

  getTypeClass(tipo: string): string {
    switch (tipo) {
      case 'NUMERICO':
        return 'type-numeric';
      case 'CATEGORICO':
        return 'type-categoric';
      case 'FECHA':
        return 'type-date';
      default:
        return 'type-text';
    }
  }
}
