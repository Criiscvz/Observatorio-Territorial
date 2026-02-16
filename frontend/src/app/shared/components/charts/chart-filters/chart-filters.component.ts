import { CommonModule } from '@angular/common';
import { Component, effect, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { VariableMetadato } from '@core/models';
import { ChartFilter } from '@core/services/interfaces/stats/univariable-request.interface';
import { TranslateModule } from '@ngx-translate/core';

export interface FilterRow {
  id: string;
  column: string;
  operator: string;
  value: string;
  valueTo?: string; // for 'between' operator
}

const OPERATORS_BY_TYPE: Record<string, { value: string; label: string }[]> = {
  NUMERICO: [
    { value: 'eq', label: 'filters.operators.eq' },
    { value: 'neq', label: 'filters.operators.neq' },
    { value: 'gt', label: 'filters.operators.gt' },
    { value: 'gte', label: 'filters.operators.gte' },
    { value: 'lt', label: 'filters.operators.lt' },
    { value: 'lte', label: 'filters.operators.lte' },
    { value: 'between', label: 'filters.operators.between' },
  ],
  CATEGORICO: [
    { value: 'eq', label: 'filters.operators.eq' },
    { value: 'neq', label: 'filters.operators.neq' },
    { value: 'in', label: 'filters.operators.in' },
    { value: 'not_in', label: 'filters.operators.notIn' },
  ],
  TEXTO: [
    { value: 'eq', label: 'filters.operators.eq' },
    { value: 'neq', label: 'filters.operators.neq' },
    { value: 'contains', label: 'filters.operators.contains' },
    { value: 'not_contains', label: 'filters.operators.notContains' },
  ],
  FECHA: [
    { value: 'eq', label: 'filters.operators.eq' },
    { value: 'gt', label: 'filters.operators.gt' },
    { value: 'lt', label: 'filters.operators.lt' },
    { value: 'between', label: 'filters.operators.between' },
  ],
};

@Component({
  selector: 'app-chart-filters',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatFormFieldModule,
    MatSelectModule,
    MatAutocompleteModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    TranslateModule,
  ],
  template: `
    <div class="filters-container">
      <div class="filters-header">
        <div class="header-left">
          <mat-icon>filter_list</mat-icon>
          <span>{{ 'datasets.view.analysis.filters' | translate }}</span>
          @if (filterRows().length > 0) {
            <span class="filter-count">{{ filterRows().length }}</span>
          }
        </div>
        <div class="header-actions">
          @if (filterRows().length > 0) {
            <button mat-icon-button (click)="clearAll()" [matTooltip]="'filters.clear' | translate">
              <mat-icon>clear_all</mat-icon>
            </button>
          }
          <button mat-icon-button (click)="addFilter()" [matTooltip]="'filters.add' | translate">
            <mat-icon>add</mat-icon>
          </button>
        </div>
      </div>

      @for (row of filterRows(); track row.id; let i = $index) {
        <div class="filter-row">
          <!-- Column selector -->
          <mat-form-field appearance="outline" class="filter-field column-field">
            <mat-label>{{ 'filters.column' | translate }}</mat-label>
            <input
              matInput
              [value]="getColumnSearchTerm(i)"
              (input)="onColumnSearch(i, $any($event.target).value)"
              (focus)="onColumnFocus(i)"
              [matAutocomplete]="colAuto"
            />
            <mat-autocomplete
              #colAuto="matAutocomplete"
              (optionSelected)="updateRow(i, 'column', $event.option.value)"
              [displayWith]="displayColumnFn.bind(this)"
            >
              @for (v of getFilteredColumns(i); track v.id) {
                <mat-option [value]="v.nombre_columna">{{ v.nombre_original }}</mat-option>
              }
            </mat-autocomplete>
          </mat-form-field>

          <!-- Operator -->
          <mat-form-field appearance="outline" class="filter-field operator-field">
            <mat-label>{{ 'filters.operator' | translate }}</mat-label>
            <mat-select [ngModel]="row.operator" (ngModelChange)="updateRow(i, 'operator', $event)">
              @for (op of getOperators(row.column); track op.value) {
                <mat-option [value]="op.value">{{ op.label | translate }}</mat-option>
              }
            </mat-select>
          </mat-form-field>

          <!-- Value -->
          @if (row.operator === 'in' || row.operator === 'not_in') {
            <mat-form-field appearance="outline" class="filter-field value-field">
              <mat-label>{{ 'filters.value' | translate }}</mat-label>
              <mat-select
                [ngModel]="splitValues(row.value)"
                (ngModelChange)="updateRow(i, 'value', joinValues($event))"
                multiple
              >
                @for (opt of getOptions(row.column); track opt) {
                  <mat-option [value]="opt">{{ opt }}</mat-option>
                }
              </mat-select>
            </mat-form-field>
          } @else if (row.operator === 'between') {
            <mat-form-field appearance="outline" class="filter-field value-field-half">
              <mat-label>{{ 'filters.valueFrom' | translate }}</mat-label>
              <input
                matInput
                [ngModel]="row.value"
                (ngModelChange)="updateRow(i, 'value', $event)"
              />
            </mat-form-field>
            <mat-form-field appearance="outline" class="filter-field value-field-half">
              <mat-label>{{ 'filters.valueTo' | translate }}</mat-label>
              <input
                matInput
                [ngModel]="row.valueTo"
                (ngModelChange)="updateRow(i, 'valueTo', $event)"
              />
            </mat-form-field>
          } @else if (getColumnType(row.column) === 'CATEGORICO') {
            <mat-form-field appearance="outline" class="filter-field value-field">
              <mat-label>{{ 'filters.value' | translate }}</mat-label>
              <mat-select [ngModel]="row.value" (ngModelChange)="updateRow(i, 'value', $event)">
                @for (opt of getOptions(row.column); track opt) {
                  <mat-option [value]="opt">{{ opt }}</mat-option>
                }
              </mat-select>
            </mat-form-field>
          } @else {
            <mat-form-field appearance="outline" class="filter-field value-field">
              <mat-label>{{ 'filters.value' | translate }}</mat-label>
              <input
                matInput
                [ngModel]="row.value"
                (ngModelChange)="updateRow(i, 'value', $event)"
              />
            </mat-form-field>
          }

          <!-- Remove button -->
          <button mat-icon-button (click)="removeFilter(i)" class="remove-btn">
            <mat-icon>close</mat-icon>
          </button>
        </div>
      }

      @if (filterRows().length > 0) {
        <div class="filters-footer">
          <button mat-flat-button color="primary" (click)="applyFilters()" class="apply-btn">
            <mat-icon>done</mat-icon>
            {{ 'filters.apply' | translate }}
          </button>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .filters-container {
        padding: 0.75rem 1rem;
        border: 1px solid var(--card-border);
        border-radius: var(--radius-lg);
        background: var(--card-bg);
        margin-bottom: 1rem;
      }

      .filters-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 0.5rem;
      }

      .header-left {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-weight: 600;
        font-size: 0.875rem;
        color: var(--text-primary);
      }

      .header-left mat-icon {
        font-size: 20px;
        width: 20px;
        height: 20px;
        color: var(--primary-600);
      }

      .filter-count {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 20px;
        height: 20px;
        border-radius: 50%;
        background: var(--primary-600);
        color: white;
        font-size: 0.6875rem;
        font-weight: 700;
      }

      .header-actions {
        display: flex;
        gap: 0.25rem;
      }

      .filter-row {
        display: flex;
        align-items: flex-start;
        gap: 0.5rem;
        margin-bottom: 0.25rem;
      }

      .filter-field {
        font-size: 0.8125rem;
      }

      .column-field {
        flex: 1.2;
        min-width: 0;
      }

      .operator-field {
        flex: 0.8;
        min-width: 0;
      }

      .value-field {
        flex: 1;
        min-width: 0;
      }

      .value-field-half {
        flex: 0.5;
        min-width: 0;
      }

      .remove-btn {
        margin-top: 4px;
        flex-shrink: 0;
      }

      .filters-footer {
        display: flex;
        justify-content: flex-end;
        margin-top: 0.5rem;
      }

      .apply-btn {
        font-size: 0.8125rem;
      }

      @media (max-width: 640px) {
        .filter-row {
          flex-wrap: wrap;
        }
        .column-field,
        .operator-field,
        .value-field,
        .value-field-half {
          flex: 1 1 100%;
        }
      }
    `,
  ],
})
export class ChartFiltersComponent {
  variables = input.required<VariableMetadato[]>();
  filtersChange = output<ChartFilter[]>();

  filterRows = signal<FilterRow[]>([]);
  columnSearchTerms = signal<Record<string, string>>({});

  private variablesMap = new Map<string, VariableMetadato>();

  constructor() {
    effect(() => {
      const vars = this.variables();
      this.variablesMap.clear();
      vars.forEach((v) => this.variablesMap.set(v.nombre_columna, v));
    });
  }

  addFilter(): void {
    const vars = this.variables();
    const firstCol = vars.length > 0 ? vars[0].nombre_columna : '';
    this.filterRows.update((rows) => [
      ...rows,
      {
        id: `filter-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        column: firstCol,
        operator: 'eq',
        value: '',
      },
    ]);
  }

  removeFilter(index: number): void {
    this.filterRows.update((rows) => rows.filter((_, i) => i !== index));
  }

  clearAll(): void {
    this.filterRows.set([]);
    this.filtersChange.emit([]);
  }

  updateRow(index: number, field: keyof FilterRow, value: any): void {
    this.filterRows.update((rows) =>
      rows.map((row, i) => {
        if (i !== index) return row;
        const updated = { ...row, [field]: value };
        // Reset operator/value when column changes
        if (field === 'column') {
          const type = this.getColumnType(value);
          updated.operator = type === 'NUMERICO' || type === 'FECHA' ? 'eq' : 'eq';
          updated.value = '';
          updated.valueTo = undefined;
          // Clear the search term and show the display name
          this.columnSearchTerms.update((t) => {
            const copy = { ...t };
            delete copy[row.id];
            return copy;
          });
        }
        // Reset valueTo when operator changes from 'between'
        if (field === 'operator' && value !== 'between') {
          updated.valueTo = undefined;
        }
        return updated;
      }),
    );
  }

  displayColumnFn(colName: string): string {
    if (!colName) return '';
    const v = this.variablesMap.get(colName);
    return v ? v.nombre_original : colName;
  }

  getColumnSearchTerm(index: number): string {
    const row = this.filterRows()[index];
    const terms = this.columnSearchTerms();
    if (terms[row.id] !== undefined) return terms[row.id];
    return this.displayColumnFn(row.column);
  }

  onColumnSearch(index: number, term: string): void {
    const row = this.filterRows()[index];
    this.columnSearchTerms.update((t) => ({ ...t, [row.id]: term }));
  }

  onColumnFocus(index: number): void {
    const row = this.filterRows()[index];
    this.columnSearchTerms.update((t) => ({ ...t, [row.id]: '' }));
  }

  getFilteredColumns(index: number): VariableMetadato[] {
    const row = this.filterRows()[index];
    const terms = this.columnSearchTerms();
    const term = (terms[row.id] || '').toLowerCase();
    const vars = this.variables();
    if (!term) return vars;
    return vars.filter((v) => v.nombre_original.toLowerCase().includes(term));
  }

  getColumnType(column: string): string {
    return this.variablesMap.get(column)?.tipo_dato || 'TEXTO';
  }

  getOperators(column: string): { value: string; label: string }[] {
    const type = this.getColumnType(column);
    return OPERATORS_BY_TYPE[type] || OPERATORS_BY_TYPE['TEXTO'];
  }

  getOptions(column: string): string[] {
    return this.variablesMap.get(column)?.opciones || [];
  }

  splitValues(val: string): string[] {
    return val ? val.split('|||') : [];
  }

  joinValues(vals: string[]): string {
    return vals.join('|||');
  }

  applyFilters(): void {
    const filters: ChartFilter[] = this.filterRows()
      .filter((row) => row.column && row.operator && row.value)
      .map((row) => {
        let value: any = row.value;
        if (row.operator === 'between' && row.valueTo) {
          value = [row.value, row.valueTo];
        } else if (row.operator === 'in' || row.operator === 'not_in') {
          value = row.value.split('|||');
        }
        return {
          column: row.column,
          operator: row.operator as ChartFilter['operator'],
          value,
        };
      });
    this.filtersChange.emit(filters);
  }
}
