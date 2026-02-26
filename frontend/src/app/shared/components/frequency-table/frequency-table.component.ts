import { CommonModule } from '@angular/common';
import { Component, computed, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatSortModule, Sort } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { TranslateModule } from '@ngx-translate/core';

export interface FrequencyRow {
  label: string;
  count: number;
  percentage: number;
}

@Component({
  selector: 'app-frequency-table',
  standalone: true,
  imports: [CommonModule, MatTableModule, MatSortModule, MatIconModule, TranslateModule],
  template: `
    <div class="frequency-table-container">
      <div class="table-header">
        <h4 class="table-title">
          <mat-icon>table_chart</mat-icon>
          {{ title() || ('frequencyTable.title' | translate) }}
        </h4>
        <span class="total-badge"> Total: {{ total() | number }} </span>
      </div>

      <div class="table-wrapper">
        <table
          mat-table
          [dataSource]="sortedRows()"
          matSort
          (matSortChange)="sortData($event)"
          class="frequency-mat-table"
        >
          <!-- Label Column -->
          <ng-container matColumnDef="label">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>
              {{ 'frequencyTable.value' | translate }}
            </th>
            <td mat-cell *matCellDef="let row">
              <span class="cell-label">{{ row.label }}</span>
            </td>
            <td mat-footer-cell *matFooterCellDef>
              <strong>{{ 'frequencyTable.total' | translate }}</strong>
            </td>
          </ng-container>

          <!-- Count Column -->
          <ng-container matColumnDef="count">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>
              {{ 'frequencyTable.frequency' | translate }}
            </th>
            <td mat-cell *matCellDef="let row">
              <span class="cell-count">{{ row.count | number }}</span>
            </td>
            <td mat-footer-cell *matFooterCellDef>
              <strong>{{ total() | number }}</strong>
            </td>
          </ng-container>

          <!-- Percentage Column -->
          <ng-container matColumnDef="percentage">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>
              {{ 'frequencyTable.percentage' | translate }}
            </th>
            <td mat-cell *matCellDef="let row">
              <div class="percentage-cell">
                <div class="percentage-bar-bg">
                  <div class="percentage-bar-fill" [style.width.%]="row.percentage"></div>
                </div>
                <span class="percentage-value">{{ row.percentage | number: '1.1-1' }}%</span>
              </div>
            </td>
            <td mat-footer-cell *matFooterCellDef>
              <strong>100%</strong>
            </td>
          </ng-container>

          <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
          <tr
            mat-row
            *matRowDef="let row; columns: displayedColumns"
            [class.highlighted]="highlightedValue() === row.label"
          ></tr>
          @if (showFooter()) {
            <tr mat-footer-row *matFooterRowDef="displayedColumns"></tr>
          }
        </table>
      </div>
    </div>
  `,
  styles: [
    `
      .frequency-table-container {
        border: 1px solid var(--card-border);
        border-radius: var(--radius-lg);
        overflow: hidden;
        background: var(--card-bg);
      }

      .table-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0.75rem 1rem;
        background: var(--surface-variant, rgba(0, 0, 0, 0.02));
        border-bottom: 1px solid var(--card-border);
      }

      .table-title {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        margin: 0;
        font-size: 0.875rem;
        font-weight: 600;
        color: var(--text-primary);
      }

      .table-title mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
        color: var(--primary-600);
      }

      .total-badge {
        font-size: 0.75rem;
        font-weight: 600;
        padding: 0.25rem 0.625rem;
        background: var(--primary-50);
        color: var(--primary-700);
        border-radius: 999px;
      }

      :host-context(.dark) .total-badge {
        background: rgba(99, 102, 241, 0.15);
        color: var(--primary-400);
      }

      .table-wrapper {
        overflow-x: auto;
      }

      .frequency-mat-table {
        width: 100%;
      }

      .cell-label {
        font-weight: 500;
        color: var(--text-primary);
      }

      .cell-count {
        font-variant-numeric: tabular-nums;
      }

      .percentage-cell {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        min-width: 120px;
      }

      .percentage-bar-bg {
        flex: 1;
        height: 6px;
        background: var(--surface-variant, rgba(0, 0, 0, 0.06));
        border-radius: 3px;
        overflow: hidden;
      }

      .percentage-bar-fill {
        height: 100%;
        background: var(--primary-500);
        border-radius: 3px;
        transition: width 0.3s ease;
      }

      .percentage-value {
        font-size: 0.8125rem;
        font-weight: 500;
        font-variant-numeric: tabular-nums;
        min-width: 48px;
        text-align: right;
      }

      tr.highlighted {
        background: var(--primary-50) !important;
      }

      :host-context(.dark) tr.highlighted {
        background: rgba(99, 102, 241, 0.1) !important;
      }

      td.mat-mdc-footer-cell {
        border-top: 2px solid var(--card-border);
        background: var(--surface-variant, rgba(0, 0, 0, 0.02));
      }
    `,
  ],
})
export class FrequencyTableComponent {
  labels = input.required<string[]>();
  values = input.required<number[]>();
  title = input<string>('');
  showFooter = input<boolean>(true);
  highlightedValue = input<string | null>(null);

  displayedColumns = ['label', 'count', 'percentage'];

  private currentSort = { active: '', direction: '' as '' | 'asc' | 'desc' };

  total = computed(() => {
    return this.values().reduce((sum, v) => sum + v, 0);
  });

  rows = computed<FrequencyRow[]>(() => {
    const labels = this.labels();
    const values = this.values();
    const total = this.total();

    return labels.map((label, i) => ({
      label,
      count: values[i] || 0,
      percentage: total > 0 ? ((values[i] || 0) / total) * 100 : 0,
    }));
  });

  sortedRows = computed(() => {
    const rows = [...this.rows()];
    const { active, direction } = this.currentSort;

    if (!active || direction === '') return rows;

    return rows.sort((a, b) => {
      const isAsc = direction === 'asc';
      switch (active) {
        case 'label':
          return compare(a.label, b.label, isAsc);
        case 'count':
          return compare(a.count, b.count, isAsc);
        case 'percentage':
          return compare(a.percentage, b.percentage, isAsc);
        default:
          return 0;
      }
    });
  });

  sortData(sort: Sort): void {
    this.currentSort = { active: sort.active, direction: sort.direction };
  }
}

function compare(a: string | number, b: string | number, isAsc: boolean): number {
  return (a < b ? -1 : 1) * (isAsc ? 1 : -1);
}
