import { CommonModule, isPlatformBrowser } from '@angular/common';
import {
  Component,
  computed,
  DestroyRef,
  inject,
  OnInit,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { DatasetFuente, VariableMetadato } from '@core/models';
import { CategoriaService } from '@core/services/categoria.service';
import { DashboardService } from '@core/services/dashboard.service';
import { DataTableComponent } from '@shared/components/charts';
import { VariableListComponent } from '@shared/components/variable-list/variable-list.component';
import { ColumnWithUniqueId } from '@shared/models';

@Component({
  selector: 'app-public-dataset-view',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatTabsModule,
    MatProgressSpinnerModule,
    MatDividerModule,
    MatTooltipModule,
    TranslateModule,
    DataTableComponent,
    VariableListComponent,
  ],
  templateUrl: './public-dataset-view.component.html',
  styleUrl: './public-dataset-view.component.scss',
})
export class PublicDatasetViewComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private dashboardService = inject(DashboardService);
  private categoriaService = inject(CategoriaService);
  private platformId = inject(PLATFORM_ID);
  private destroyRef = inject(DestroyRef);

  loading = signal(true);
  datasetId = signal('');
  departamentoId = signal('');
  datasetInfo = signal<{
    id: string;
    nombre: string;
    descripcion?: string;
    total_registros: number;
  } | null>(null);
  variables = signal<VariableMetadato[]>([]);
  tableData = signal<{ id: number; data: Record<string, any> }[]>([]);
  pagination = signal({ current_page: 1, last_page: 1, per_page: 50, total: 0 });

  // Sources
  fuentes = signal<DatasetFuente[]>([]);

  // Columns with unique IDs for mat-table
  visibleColumns = computed<ColumnWithUniqueId[]>(() => {
    const cols = this.variables().filter((v) => v.es_visible);
    return cols.map((v, index) => ({
      ...v,
      _uniqueId: v.id || `col_${index}_${v.nombre_columna}`,
    }));
  });

  // All visible variables are analysable
  analysableVariables = computed(() => this.variables().filter((v) => v.es_visible));

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.route.params.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
        const id = params['id'];
        if (id && id !== this.datasetId()) {
          this.datasetId.set(id);
          this.fuentes.set([]);
          this.loadData();
        }
      });
    } else {
      this.loading.set(false);
    }
  }

  loadData(page = 1): void {
    this.loading.set(true);
    this.dashboardService.getPublicDatasetData(this.datasetId(), page).subscribe({
      next: (res) => {
        this.datasetInfo.set(res.dataset);
        this.variables.set(res.variables || []);
        this.tableData.set(res.data || []);
        this.pagination.set(res.pagination);
        if (res.dataset.departamento_id) {
          this.departamentoId.set(res.dataset.departamento_id);
        }
        this.loading.set(false);
        this.loadFuentes();
      },
      error: () => this.loading.set(false),
    });
  }

  private loadFuentes(): void {
    this.categoriaService.getFuentes(this.datasetId()).subscribe({
      next: (fuentes) => this.fuentes.set(fuentes || []),
      error: () => {},
    });
  }

  onPageChange(event: PageEvent): void {
    this.loadData(event.pageIndex + 1);
  }

  /** Navigate to variable analysis page */
  onVariableSelected(variable: VariableMetadato): void {
    this.router.navigate(['/publico/datasets', this.datasetId(), 'variable', variable.id]);
  }
}
