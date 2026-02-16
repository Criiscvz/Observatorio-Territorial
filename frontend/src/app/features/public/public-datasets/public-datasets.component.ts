import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Component, computed, inject, OnInit, PLATFORM_ID, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RouterLink } from '@angular/router';
import { Dataset, Departamento } from '@core/models';
import { DepartamentoService } from '@core/services/departamento.service';
import { TranslateModule } from '@ngx-translate/core';

interface DatasetConDepto extends Dataset {
  departamento_nombre: string;
  departamento_icono?: string;
}

@Component({
  selector: 'app-public-datasets',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatChipsModule,
    TranslateModule,
  ],
  templateUrl: './public-datasets.component.html',
  styleUrl: './public-datasets.component.scss',
})
export class PublicDatasetsComponent implements OnInit {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly deptoService = inject(DepartamentoService);

  private departamentos = signal<Departamento[]>([]);
  loading = signal(true);
  searchTerm = signal('');

  allDatasets = computed<DatasetConDepto[]>(() => {
    const deptos = this.departamentos();
    const datasets: DatasetConDepto[] = [];
    for (const depto of deptos) {
      for (const ds of depto.datasets || []) {
        datasets.push({
          ...ds,
          departamento_nombre: depto.nombre,
          departamento_icono: depto.icono,
        });
      }
    }
    return datasets.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
  });

  filteredDatasets = computed<DatasetConDepto[]>(() => {
    const term = this.searchTerm().toLowerCase().trim();
    const all = this.allDatasets();
    if (!term) return all;
    return all.filter(
      (ds) =>
        ds.nombre.toLowerCase().includes(term) ||
        ds.departamento_nombre.toLowerCase().includes(term) ||
        (ds.descripcion && ds.descripcion.toLowerCase().includes(term)),
    );
  });

  totalRegistros = computed(() =>
    this.allDatasets().reduce((sum, ds) => sum + (ds.total_registros || 0), 0),
  );

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

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.loadData();
    } else {
      this.loading.set(false);
    }
  }

  private loadData(): void {
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

  onSearch(term: string): void {
    this.searchTerm.set(term);
  }

  clearSearch(): void {
    this.searchTerm.set('');
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

  formatNumber(num: number): string {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  }
}
