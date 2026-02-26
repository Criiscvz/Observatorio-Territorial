import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Component, DestroyRef, inject, OnInit, PLATFORM_ID, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Dataset, Departamento } from '@core/models';
import { DepartamentoService } from '@core/services/departamento.service';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-public-departamento-detail',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
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
  datasetSearchTerm = '';

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
    const all = this.departamento()?.datasets || [];
    if (!this.datasetSearchTerm.trim()) return all;
    const term = this.datasetSearchTerm.toLowerCase().trim();
    return all.filter((ds) => ds.nombre.toLowerCase().includes(term));
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
