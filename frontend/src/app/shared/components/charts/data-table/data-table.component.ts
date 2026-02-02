import { CommonModule } from '@angular/common';
import { Component, computed, ElementRef, input, output, viewChild } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
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
    MatButtonModule,
    MatTooltipModule,
    TranslateModule,
  ],
  template: `
    <mat-card class="data-card">
      @if (columns().length > 5 && data().length > 0) {
        <div class="table-nav-controls">
          <button
            mat-mini-fab
            color="primary"
            (click)="scrollLeft()"
            [matTooltip]="'datasets.view.data.scrollLeft' | translate"
          >
            <mat-icon>chevron_left</mat-icon>
          </button>
          <span class="nav-hint">{{ 'datasets.view.data.scrollHint' | translate }}</span>
          <button
            mat-mini-fab
            color="primary"
            (click)="scrollRight()"
            [matTooltip]="'datasets.view.data.scrollRight' | translate"
          >
            <mat-icon>chevron_right</mat-icon>
          </button>
        </div>
      }
      <div class="table-wrapper">
        @if (columns().length > 5 && data().length > 0) {
          <button
            mat-icon-button
            class="scroll-arrow scroll-arrow-left"
            (click)="scrollLeft()"
            [class.hidden]="!canScrollLeft"
          >
            <mat-icon>keyboard_arrow_left</mat-icon>
          </button>
        }

        <div class="table-container" #tableContainer (scroll)="onScroll()">
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

        @if (columns().length > 5 && data().length > 0) {
          <button
            mat-icon-button
            class="scroll-arrow scroll-arrow-right"
            (click)="scrollRight()"
            [class.hidden]="!canScrollRight"
          >
            <mat-icon>keyboard_arrow_right</mat-icon>
          </button>
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

      /* Barra de controles de navegación */
      .table-nav-controls {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 1rem;
        padding: 0.75rem;
        margin-bottom: 0.5rem;
        background: var(--bg-tertiary);
        border-radius: var(--radius-lg);
      }

      .table-nav-controls .nav-hint {
        color: var(--text-secondary);
        font-size: 0.875rem;
      }

      /* Contenedor wrapper con flechas */
      .table-wrapper {
        position: relative;
        display: flex;
        align-items: stretch;
      }

      /* Flechas flotantes */
      .scroll-arrow {
        position: absolute;
        top: 50%;
        transform: translateY(-50%);
        z-index: 10;
        background: var(--card-bg) !important;
        border: 1px solid var(--border-color) !important;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
        width: 40px;
        height: 40px;
        transition: all 0.15s ease;
      }

      .scroll-arrow:hover {
        background: var(--primary-500) !important;
        color: white !important;
        border-color: var(--primary-500) !important;
      }

      .scroll-arrow.hidden {
        opacity: 0;
        pointer-events: none;
      }

      .scroll-arrow-left {
        left: 0;
      }

      .scroll-arrow-right {
        right: 0;
      }

      .scroll-arrow mat-icon {
        font-size: 24px;
        width: 24px;
        height: 24px;
      }

      .table-container {
        overflow-x: auto;
        overflow-y: visible;
        max-width: 100%;
        flex: 1;
        position: relative;
        margin: 0 48px;
        scrollbar-width: thin;
        scrollbar-color: var(--primary-400) var(--bg-tertiary);
        padding-bottom: 8px;
        margin-bottom: 8px;
      }

      /* Scrollbar personalizado para Webkit (Chrome, Safari, Edge) */
      .table-container::-webkit-scrollbar {
        height: 12px;
      }

      .table-container::-webkit-scrollbar-track {
        background: var(--bg-tertiary);
        border-radius: 6px;
      }

      .table-container::-webkit-scrollbar-thumb {
        background: var(--primary-400);
        border-radius: 6px;
        border: 2px solid var(--bg-tertiary);
      }

      .table-container::-webkit-scrollbar-thumb:hover {
        background: var(--primary-500);
      }

      .data-table {
        width: 100%;
        min-width: max-content;
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

  tableContainer = viewChild<ElementRef<HTMLDivElement>>('tableContainer');
  canScrollLeft = false;
  canScrollRight = true;

  columnNames = computed(() => this.columns().map((v) => v._uniqueId));

  scrollLeft(): void {
    const container = this.tableContainer()?.nativeElement;
    if (container) {
      container.scrollBy({ left: -300, behavior: 'smooth' });
    }
  }

  scrollRight(): void {
    const container = this.tableContainer()?.nativeElement;
    if (container) {
      container.scrollBy({ left: 300, behavior: 'smooth' });
    }
  }

  onScroll(): void {
    const container = this.tableContainer()?.nativeElement;
    if (container) {
      this.canScrollLeft = container.scrollLeft > 0;
      this.canScrollRight =
        container.scrollLeft < container.scrollWidth - container.clientWidth - 5;
    }
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
