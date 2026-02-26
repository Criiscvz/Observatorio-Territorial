import { CommonModule } from '@angular/common';
import {
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { DatasetFuente, VariableMetadato } from '@core/models';
import { CategoriaService } from '@core/services/categoria.service';
import { DashboardService } from '@core/services/dashboard.service';
import { DatasetService } from '@core/services/dataset.service';
import { StopwordsManagerComponent } from '@shared/components/stopwords-manager/stopwords-manager.component';
import { BulkAction, VariableListComponent } from '@shared/components/variable-list/variable-list.component';
import { ColumnWithUniqueId } from '@shared/models';

@Component({
  selector: 'app-dataset-view',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatTabsModule,
    MatTableModule,
    MatPaginatorModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatFormFieldModule,
    MatInputModule,
    MatCheckboxModule,
    MatChipsModule,
    MatTooltipModule,
    MatSnackBarModule,
    MatDividerModule,
    TranslateModule,
    VariableListComponent,
    StopwordsManagerComponent,
  ],
  templateUrl: './dataset-view.component.html',
  styleUrl: './dataset-view.component.scss',
})
export class DatasetViewComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly datasetService = inject(DatasetService);
  private readonly dashboardService = inject(DashboardService);
  private readonly categoriaService = inject(CategoriaService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  // Estado
  loading = signal(true);
  datasetId = signal<string>('');
  departamentoId = signal<string>('');
  datasetInfo = signal<{
    id: string;
    nombre: string;
    descripcion?: string;
    total_registros: number;
    estado?: 'PENDIENTE' | 'PROCESANDO' | 'COMPLETADO' | 'ERROR';
  } | null>(null);
  variables = signal<VariableMetadato[]>([]);
  tableData = signal<{ id: number; data: Record<string, any> }[]>([]);
  pagination = signal({ current_page: 1, last_page: 1, per_page: 50, total: 0 });

  // Inline editing
  editingDescription = signal(false);
  editDescriptionValue = signal('');
  savingDescription = signal(false);

  // Scroll horizontal de la tabla
  tableScrollContainer = viewChild<ElementRef<HTMLDivElement>>('tableScrollContainer');
  canScrollLeft = false;
  canScrollRight = true;

  // Computed para verificar si el dataset está pendiente
  isDatasetPending = computed(() => {
    const info = this.datasetInfo();
    return (
      info?.estado === 'PENDIENTE' || (info?.total_registros === 0 && this.variables().length === 0)
    );
  });

  // Sources
  fuentes = signal<DatasetFuente[]>([]);

  // Sources form
  showSourceForm = signal(false);
  editingSource = signal<DatasetFuente | null>(null);
  sourceForm = signal({ titulo: '', url: '', descripcion: '' });

  // Computed
  visibleColumns = computed<ColumnWithUniqueId[]>(() => {
    const vars = this.variables();
    const visible = vars.filter((v) => v.es_visible);
    const columns = visible.length > 0 ? visible : vars;
    return columns.map((col, index) => ({
      ...col,
      _uniqueId: `col_${index}_${col.nombre_columna}`,
    }));
  });
  columnNames = computed(() => this.visibleColumns().map((v) => v._uniqueId));
  analysableVariables = computed(() => this.variables().filter((v) => v.es_visible));

  ngOnInit(): void {
    this.route.params.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const id = params['id'];
      if (id && id !== this.datasetId()) {
        this.datasetId.set(id);
        this.fuentes.set([]);
        this.loadData();
      }
    });
  }

  loadData(page: number = 1): void {
    this.loading.set(true);
    this.dashboardService.getDatasetData(this.datasetId(), page).subscribe({
      next: (res) => {
        this.variables.set(res.variables || []);
        this.tableData.set(res.data || []);
        this.pagination.set(res.pagination);

        this.datasetService.getById(this.datasetId()).subscribe({
          next: (dsRes) => {
            this.datasetInfo.set({
              id: dsRes.id,
              nombre: dsRes.nombre,
              descripcion: dsRes.descripcion,
              total_registros: dsRes.total_registros,
              estado: dsRes.estado,
            });
            if (dsRes.departamento_id) {
              this.departamentoId.set(dsRes.departamento_id);
            }
            this.loading.set(false);
          },
          error: () => {
            this.datasetInfo.set(res.dataset);
            if (res.dataset.departamento_id) {
              this.departamentoId.set(res.dataset.departamento_id);
            }
            this.loading.set(false);
          },
        });

        // Load fuentes
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

  scrollTableLeft(): void {
    const container = this.tableScrollContainer()?.nativeElement;
    if (container) {
      container.scrollBy({ left: -300, behavior: 'smooth' });
    }
  }

  scrollTableRight(): void {
    const container = this.tableScrollContainer()?.nativeElement;
    if (container) {
      container.scrollBy({ left: 300, behavior: 'smooth' });
    }
  }

  onTableScroll(): void {
    const container = this.tableScrollContainer()?.nativeElement;
    if (container) {
      this.canScrollLeft = container.scrollLeft > 0;
      this.canScrollRight =
        container.scrollLeft < container.scrollWidth - container.clientWidth - 5;
    }
  }

  deleteIncompleteDataset(): void {
    const message = this.translate.instant('datasets.view.pendingWarning.confirmDelete', {
      name: this.datasetInfo()?.nombre,
    });

    if (confirm(message)) {
      this.datasetService.delete(this.datasetId()).subscribe({
        next: () => {
          this.snackBar.open(
            this.translate.instant('datasets.view.pendingWarning.deleteSuccess'),
            this.translate.instant('common.buttons.close'),
            { duration: 3000 },
          );
          if (this.departamentoId()) {
            this.router.navigate(['/admin/departamentos', this.departamentoId()]);
          } else {
            this.router.navigate(['/admin/datasets']);
          }
        },
        error: (err) => {
          this.snackBar.open(
            err.error?.message ||
              this.translate.instant('datasets.view.pendingWarning.deleteError'),
            this.translate.instant('common.buttons.close'),
            { duration: 5000 },
          );
        },
      });
    }
  }

  /** Navigate to variable analysis page */
  onVariableSelected(variable: VariableMetadato): void {
    this.router.navigate(['/admin/datasets', this.datasetId(), 'variable', variable.id]);
  }

  // =========== SOURCES MANAGEMENT ===========

  openSourceForm(source?: DatasetFuente): void {
    if (source) {
      this.editingSource.set(source);
      this.sourceForm.set({
        titulo: source.titulo,
        url: source.url,
        descripcion: source.descripcion || '',
      });
    } else {
      this.editingSource.set(null);
      this.sourceForm.set({ titulo: '', url: '', descripcion: '' });
    }
    this.showSourceForm.set(true);
  }

  closeSourceForm(): void {
    this.showSourceForm.set(false);
    this.editingSource.set(null);
  }

  saveSource(): void {
    const form = this.sourceForm();
    if (!form.titulo || !form.url) return;

    const editing = this.editingSource();

    const obs = editing
      ? this.categoriaService.updateFuente(editing.id, form)
      : this.categoriaService.createFuente(this.datasetId(), form);

    obs.subscribe({
      next: () => {
        this.snackBar.open(
          this.translate.instant('datasets.view.sources.sourceAdded'),
          this.translate.instant('common.buttons.close'),
          { duration: 3000 },
        );
        this.closeSourceForm();
        this.loadFuentes();
      },
      error: () => {
        this.snackBar.open(
          this.translate.instant('datasets.view.sources.sourceError'),
          this.translate.instant('common.buttons.close'),
          { duration: 3000 },
        );
      },
    });
  }

  deleteSource(source: DatasetFuente): void {
    if (confirm(this.translate.instant('common.messages.confirmDelete'))) {
      this.categoriaService.deleteFuente(source.id).subscribe({
        next: () => {
          this.snackBar.open(
            this.translate.instant('datasets.view.sources.sourceDeleted'),
            this.translate.instant('common.buttons.close'),
            { duration: 3000 },
          );
          this.loadFuentes();
        },
        error: () => {
          this.snackBar.open(
            this.translate.instant('datasets.view.sources.sourceError'),
            this.translate.instant('common.buttons.close'),
            { duration: 3000 },
          );
        },
      });
    }
  }

  // =========== VARIABLES ===========

  updateVariable(variable: VariableMetadato): void {
    this.dashboardService
      .updateVariable(variable.id, {
        tipo_dato: variable.tipo_dato,
        es_visible: variable.es_visible,
      })
      .subscribe({
        next: () =>
          this.snackBar.open(this.translate.instant('common.messages.success'), 'OK', {
            duration: 2000,
          }),
        error: () =>
          this.snackBar.open(this.translate.instant('common.messages.error'), 'OK', {
            duration: 2000,
          }),
      });
  }

  // =========== BULK VARIABLE OPERATIONS ===========

  onBulkAction(action: BulkAction): void {
    const data: Record<string, any> = {};
    if (action.action === 'visibility') {
      data['es_visible'] = action.value;
    } else if (action.action === 'type') {
      data['tipo_dato'] = action.value;
    }

    this.dashboardService.bulkUpdateVariables(action.variableIds, data).subscribe({
      next: (result) => {
        // Update local variables state
        this.variables.update((vars) =>
          vars.map((v) => {
            if (action.variableIds.includes(v.id)) {
              return {
                ...v,
                ...(action.action === 'visibility' ? { es_visible: action.value as boolean } : {}),
                ...(action.action === 'type' ? { tipo_dato: action.value as string } : {}),
              };
            }
            return v;
          }),
        );
        this.snackBar.open(
          `${result.updated} ${this.translate.instant('variableList.bulk.updated')}`,
          this.translate.instant('common.buttons.close'),
          { duration: 3000 },
        );
      },
      error: () => {
        this.snackBar.open(
          this.translate.instant('common.messages.error'),
          this.translate.instant('common.buttons.close'),
          { duration: 3000 },
        );
      },
    });
  }

  // =========== DESCRIPTION EDITING ===========

  startEditDescription(): void {
    this.editDescriptionValue.set(this.datasetInfo()?.descripcion || '');
    this.editingDescription.set(true);
  }

  cancelEditDescription(): void {
    this.editingDescription.set(false);
  }

  saveDescription(): void {
    this.savingDescription.set(true);
    this.datasetService.update(this.datasetId(), {
      descripcion: this.editDescriptionValue(),
    }).subscribe({
      next: () => {
        const current = this.datasetInfo();
        if (current) {
          this.datasetInfo.set({ ...current, descripcion: this.editDescriptionValue() });
        }
        this.editingDescription.set(false);
        this.savingDescription.set(false);
        this.snackBar.open(
          this.translate.instant('common.messages.success'),
          this.translate.instant('common.buttons.close'),
          { duration: 2000 },
        );
      },
      error: () => {
        this.savingDescription.set(false);
        this.snackBar.open(
          this.translate.instant('common.messages.error'),
          this.translate.instant('common.buttons.close'),
          { duration: 3000 },
        );
      },
    });
  }

  getTipoClass(tipo: string): string {
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
