import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Dataset, Departamento } from '../../core/models';
import { DepartamentoService } from '../../core/services/departamento.service';

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
  ],
  templateUrl: './public-departamento-detail.component.html',
  styleUrl: './public-departamento-detail.component.scss'
})
export class PublicDepartamentoDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private deptoService = inject(DepartamentoService);

  departamento = signal<Departamento | null>(null);
  loading = signal(true);

  deptoGradient = 'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)';

  private datasetColors = [
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
    const id = this.route.snapshot.params['id'];
    this.loadDepartamento(id);
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
