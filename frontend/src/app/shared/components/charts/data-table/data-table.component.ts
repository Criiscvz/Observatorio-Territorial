import { CommonModule } from '@angular/common';
import { Component, computed, input, output } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatTableModule } from '@angular/material/table';
import { TranslateModule } from '@ngx-translate/core';
import { ColumnWithUniqueId } from '@shared/models';

export interface PaginationInfo {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

@Component({
  selector: 'app-data-table',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatTableModule,
    MatPaginatorModule,
    MatIconModule,
    TranslateModule,
  ],
  template: `
    <mat-card class="data-card">
      <div class="table-container">
        @if (columns().length > 0 && data().length > 0) {
          <table mat-table [dataSource]="data()" class="data-table">
            @for (col of columns(); track col._uniqueId) {
              <ng-container [matColumnDef]="col._uniqueId">
                <th mat-header-cell *matHeaderCellDef>
                  <div class="header-cell">
                    <span>{{ col.nombre_original || col.nombre_columna }}</span>
                    <span class="type-indicator" [class]="getTypeClass(col.tipo_dato)">
                      {{ getTypeShort(col.tipo_dato) }}
                    </span>
                  </div>
                </th>
                <td mat-cell *matCellDef="let row">{{ row.data[col.nombre_columna] }}</td>
              </ng-container>
            }
            <tr mat-header-row *matHeaderRowDef="columnNames()"></tr>
            <tr mat-row *matRowDef="let row; columns: columnNames()"></tr>
          </table>
        } @else {
          <div class="empty-state">
            <mat-icon>table_rows</mat-icon>
            <p>{{ 'public.datasetView.noData' | translate }}</p>
          </div>
        }
      </div>
      <mat-paginator
        [length]="pagination().total"
        [pageSize]="pagination().per_page"
        [pageIndex]="pagination().current_page - 1"
        [pageSizeOptions]="[25, 50, 100]"
        (page)="onPageChange($event)"
        showFirstLastButtons
      >
      </mat-paginator>
    </mat-card>
  `,
  styles: [
    `
      .data-card {
        overflow: hidden;
      }

      .table-container {
        overflow-x: auto;
      }

      .data-table {
        width: 100%;
        background: transparent !important;
      }

      .header-cell {
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }

      .type-indicator {
        font-size: 0.625rem;
        padding: 0.125rem 0.375rem;
        border-radius: var(--radius-sm);
        text-transform: uppercase;
        font-weight: 600;
      }

      .type-indicator.type-numeric {
        background: var(--type-numeric-bg);
        color: var(--type-numeric-color);
      }
      .type-indicator.type-categoric {
        background: var(--type-categoric-bg);
        color: var(--type-categoric-color);
      }
      .type-indicator.type-date {
        background: var(--type-date-bg);
        color: var(--type-date-color);
      }
      .type-indicator.type-text {
        background: var(--type-text-bg);
        color: var(--type-text-color);
      }

      .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 4rem;
        text-align: center;
        color: var(--text-secondary);
      }

      .empty-state mat-icon {
        font-size: 48px;
        width: 48px;
        height: 48px;
        opacity: 0.5;
        margin-bottom: 1rem;
      }
    `,
  ],
})
export class DataTableComponent {
  columns = input.required<ColumnWithUniqueId[]>();
  data = input.required<{ id: number; data: Record<string, any> }[]>();
  pagination = input.required<PaginationInfo>();

  pageChange = output<PageEvent>();

  columnNames = computed(() => this.columns().map((v) => v._uniqueId));

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

  getTypeShort(tipo: string): string {
    switch (tipo) {
      case 'NUMERICO':
        return 'NUM';
      case 'CATEGORICO':
        return 'CAT';
      case 'FECHA':
        return 'DATE';
      default:
        return 'TXT';
    }
  }

  onPageChange(event: PageEvent): void {
    this.pageChange.emit(event);
  }
}
