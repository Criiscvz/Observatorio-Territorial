import { CommonModule } from '@angular/common';
import { Component, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { VariableMetadato } from '@core/models';
import { TranslateModule } from '@ngx-translate/core';

export interface BulkAction {
  variableIds: string[];
  action: 'visibility' | 'type';
  value: boolean | string;
}

@Component({
  selector: 'app-variable-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatCardModule,
    MatCheckboxModule,
    MatChipsModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatMenuModule,
    MatTooltipModule,
    TranslateModule,
  ],
  template: `
    <div class="variable-list-container">
      <!-- Search + Bulk Toggle -->
      <div class="toolbar-row">
        <mat-form-field appearance="outline" class="search-field">
          <mat-icon matPrefix>search</mat-icon>
          <mat-label>{{ 'variableList.search' | translate }}</mat-label>
          <input
            matInput
            [ngModel]="searchTerm()"
            (ngModelChange)="searchTerm.set($event)"
            [placeholder]="'variableList.searchPlaceholder' | translate"
          />
          @if (searchTerm()) {
            <button matSuffix mat-icon-button (click)="searchTerm.set('')">
              <mat-icon>close</mat-icon>
            </button>
          }
        </mat-form-field>
        @if (enableBulkActions()) {
          <button mat-stroked-button
            class="select-toggle-btn"
            (click)="toggleSelectionMode()">
            <mat-icon>{{ selectionMode() ? 'close' : 'checklist' }}</mat-icon>
            {{ selectionMode() ? ('variableList.cancelSelection' | translate) : ('variableList.selectMultiple' | translate) }}
          </button>
        }
      </div>

      <!-- Bulk Actions Bar -->
      @if (selectionMode() && selectedIds().size > 0) {
        <div class="bulk-actions-bar">
          <span class="bulk-count">
            {{ selectedIds().size }} {{ 'variableList.selected' | translate }}
          </span>
          <div class="bulk-buttons">
            <button mat-stroked-button (click)="bulkSetVisibility(true)">
              <mat-icon>visibility</mat-icon>
              {{ 'variableList.bulk.showAll' | translate }}
            </button>
            <button mat-stroked-button (click)="bulkSetVisibility(false)">
              <mat-icon>visibility_off</mat-icon>
              {{ 'variableList.bulk.hideAll' | translate }}
            </button>
            <button mat-stroked-button [matMenuTriggerFor]="typeMenu">
              <mat-icon>category</mat-icon>
              {{ 'variableList.bulk.changeType' | translate }}
            </button>
          </div>
          <mat-menu #typeMenu="matMenu">
            @for (type of typeFilters; track type.value) {
              <button mat-menu-item (click)="bulkSetType(type.value)">
                <mat-icon>{{ type.icon }}</mat-icon>
                <span>{{ type.label }}</span>
              </button>
            }
          </mat-menu>
        </div>
      }

      <!-- Stats bar -->
      <div class="stats-bar">
        <div class="stats-left">
          @if (selectionMode()) {
            <mat-checkbox
              [checked]="allFilteredSelected()"
              [indeterminate]="someFilteredSelected() && !allFilteredSelected()"
              (change)="toggleSelectAll()">
              {{ 'variableList.selectAll' | translate }}
            </mat-checkbox>
          }
          <span class="stats-text">
            {{ filteredVariables().length }} {{ 'variableList.of' | translate }}
            {{ variables().length }} {{ 'variableList.variables' | translate }}
          </span>
        </div>
        <div class="type-filters">
          @for (type of typeFilters; track type.value) {
            <button
              class="type-filter-chip"
              [class.active]="activeTypeFilter() === type.value"
              (click)="toggleTypeFilter(type.value)"
              [matTooltip]="type.label"
            >
              <mat-icon>{{ type.icon }}</mat-icon>
              {{ type.label }}
            </button>
          }
        </div>
      </div>

      <!-- Variables Grid -->
      @if (filteredVariables().length > 0) {
        <div class="variables-grid">
          @for (variable of filteredVariables(); track variable.id) {
            <div
              class="variable-card"
              [class.selected]="selectionMode() && selectedIds().has(variable.id)"
              (click)="onCardClick(variable, $event)"
              (keydown.enter)="onCardClick(variable, $event)"
              tabindex="0"
              role="button"
            >
              <div class="variable-card-header">
                @if (selectionMode()) {
                  <mat-checkbox
                    [checked]="selectedIds().has(variable.id)"
                    (change)="toggleSelection(variable.id)"
                    (click)="$event.stopPropagation()"
                    class="variable-checkbox">
                  </mat-checkbox>
                }
                <div class="variable-icon" [class]="'type-' + variable.tipo_dato.toLowerCase()">
                  <mat-icon>{{ getTypeIcon(variable.tipo_dato) }}</mat-icon>
                </div>
                <div class="variable-info">
                  <h4 class="variable-name">{{ variable.nombre_original || variable.nombre_columna }}</h4>
                  <span class="variable-type-badge" [class]="'badge-' + variable.tipo_dato.toLowerCase()">
                    {{ getTypeLabel(variable.tipo_dato) }}
                  </span>
                </div>
                @if (!selectionMode()) {
                  <mat-icon class="arrow-icon">chevron_right</mat-icon>
                }
              </div>
              @if (variable.tipo_dato === 'CATEGORICO' && variable.opciones?.length) {
                <div class="variable-options">
                  <span class="options-count">
                    {{ variable.opciones!.length }} {{ 'variableList.options' | translate }}
                  </span>
                  <div class="options-preview">
                    @for (opt of variable.opciones!.slice(0, 3); track opt) {
                      <span class="option-tag">{{ opt }}</span>
                    }
                    @if (variable.opciones!.length > 3) {
                      <span class="option-tag more">+{{ variable.opciones!.length - 3 }}</span>
                    }
                  </div>
                </div>
              }
            </div>
          }
        </div>
      } @else {
        <div class="empty-state">
          <mat-icon>search_off</mat-icon>
          <p>{{ 'variableList.noResults' | translate }}</p>
        </div>
      }
    </div>
  `,
  styles: [`
    .variable-list-container {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .toolbar-row {
      display: flex;
      align-items: flex-start;
      gap: 1rem;
      flex-wrap: wrap;
    }

    .search-field {
      width: 100%;
      max-width: 400px;
    }

    .select-toggle-btn {
      margin-top: 0.375rem;
      white-space: nowrap;
    }

    .bulk-actions-bar {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 0.75rem 1rem;
      background: var(--primary-50);
      border: 1px solid var(--primary-200);
      border-radius: var(--radius-lg);
      flex-wrap: wrap;
    }

    :host-context(.dark) .bulk-actions-bar {
      background: rgba(99, 102, 241, 0.1);
      border-color: rgba(99, 102, 241, 0.3);
    }

    .bulk-count {
      font-size: 0.875rem;
      font-weight: 600;
      color: var(--primary-700);
    }

    :host-context(.dark) .bulk-count {
      color: var(--primary-400);
    }

    .bulk-buttons {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
    }

    .stats-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 0.75rem;
    }

    .stats-left {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .stats-text {
      font-size: 0.875rem;
      color: var(--text-secondary);
    }

    .type-filters {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
    }

    .type-filter-chip {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      padding: 0.25rem 0.75rem;
      border: 1px solid var(--border-color);
      border-radius: 999px;
      background: transparent;
      font-size: 0.75rem;
      color: var(--text-secondary);
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .type-filter-chip mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }

    .type-filter-chip:hover {
      border-color: var(--primary-300);
      color: var(--primary-600);
    }

    .type-filter-chip.active {
      background: var(--primary-50);
      border-color: var(--primary-500);
      color: var(--primary-700);
      font-weight: 600;
    }

    :host-context(.dark) .type-filter-chip.active {
      background: rgba(99, 102, 241, 0.15);
    }

    /* Variables Grid */
    .variables-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 0.75rem;
    }

    .variable-card {
      display: flex;
      flex-direction: column;
      padding: 1rem;
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: var(--radius-lg);
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .variable-card:hover {
      border-color: var(--primary-400);
      box-shadow: 0 4px 12px var(--shadow-color);
      transform: translateY(-1px);
    }

    .variable-card.selected {
      border-color: var(--primary-500);
      background: var(--primary-50);
    }

    :host-context(.dark) .variable-card.selected {
      background: rgba(99, 102, 241, 0.08);
    }

    .variable-checkbox {
      flex-shrink: 0;
    }

    .variable-card:focus-visible {
      outline: 2px solid var(--primary-500);
      outline-offset: 2px;
    }

    .variable-card-header {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .variable-icon {
      width: 40px;
      height: 40px;
      border-radius: var(--radius-md);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .variable-icon mat-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
    }

    .variable-icon.type-numerico {
      background: #eff6ff;
      color: #2563eb;
    }
    .variable-icon.type-categorico {
      background: #f0fdf4;
      color: #16a34a;
    }
    .variable-icon.type-fecha {
      background: #fefce8;
      color: #ca8a04;
    }
    .variable-icon.type-texto {
      background: #faf5ff;
      color: #9333ea;
    }

    :host-context(.dark) .variable-icon.type-numerico {
      background: rgba(37, 99, 235, 0.15);
    }
    :host-context(.dark) .variable-icon.type-categorico {
      background: rgba(22, 163, 74, 0.15);
    }
    :host-context(.dark) .variable-icon.type-fecha {
      background: rgba(202, 138, 4, 0.15);
    }
    :host-context(.dark) .variable-icon.type-texto {
      background: rgba(147, 51, 234, 0.15);
    }

    .variable-info {
      flex: 1;
      min-width: 0;
    }

    .variable-name {
      font-size: 0.875rem;
      font-weight: 600;
      color: var(--text-primary);
      margin: 0 0 0.25rem;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .variable-type-badge {
      display: inline-block;
      font-size: 0.6875rem;
      font-weight: 600;
      padding: 0.125rem 0.5rem;
      border-radius: 999px;
      text-transform: uppercase;
      letter-spacing: 0.025em;
    }

    .badge-numerico { background: #dbeafe; color: #1d4ed8; }
    .badge-categorico { background: #dcfce7; color: #15803d; }
    .badge-fecha { background: #fef9c3; color: #a16207; }
    .badge-texto { background: #f3e8ff; color: #7e22ce; }

    :host-context(.dark) .badge-numerico { background: rgba(37, 99, 235, 0.2); color: #60a5fa; }
    :host-context(.dark) .badge-categorico { background: rgba(22, 163, 74, 0.2); color: #4ade80; }
    :host-context(.dark) .badge-fecha { background: rgba(202, 138, 4, 0.2); color: #facc15; }
    :host-context(.dark) .badge-texto { background: rgba(147, 51, 234, 0.2); color: #c084fc; }

    .arrow-icon {
      color: var(--text-tertiary);
      flex-shrink: 0;
      transition: transform 0.15s ease;
    }

    .variable-card:hover .arrow-icon {
      transform: translateX(2px);
      color: var(--primary-600);
    }

    .variable-options {
      margin-top: 0.5rem;
      padding-top: 0.5rem;
      border-top: 1px solid var(--border-color);
    }

    .options-count {
      font-size: 0.75rem;
      color: var(--text-tertiary);
      display: block;
      margin-bottom: 0.375rem;
    }

    .options-preview {
      display: flex;
      flex-wrap: wrap;
      gap: 0.25rem;
    }

    .option-tag {
      font-size: 0.6875rem;
      padding: 0.125rem 0.5rem;
      background: var(--surface-variant, rgba(0, 0, 0, 0.04));
      border-radius: 999px;
      color: var(--text-secondary);
    }

    .option-tag.more {
      background: var(--primary-50);
      color: var(--primary-600);
      font-weight: 600;
    }

    :host-context(.dark) .option-tag.more {
      background: rgba(99, 102, 241, 0.15);
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 3rem;
      color: var(--text-tertiary);
    }

    .empty-state mat-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      opacity: 0.5;
    }

    .empty-state p {
      margin-top: 0.75rem;
      font-size: 0.875rem;
    }

    @media (max-width: 640px) {
      .variables-grid {
        grid-template-columns: 1fr;
      }

      .stats-bar {
        flex-direction: column;
        align-items: flex-start;
      }
    }
  `],
})
export class VariableListComponent {
  variables = input.required<VariableMetadato[]>();
  enableBulkActions = input(false);
  variableSelected = output<VariableMetadato>();
  bulkActionRequested = output<BulkAction>();

  searchTerm = signal('');
  activeTypeFilter = signal<string | null>(null);
  selectionMode = signal(false);
  selectedIds = signal<Set<string>>(new Set());

  readonly typeFilters = [
    { value: 'CATEGORICO', label: 'Categórico', icon: 'category' },
    { value: 'NUMERICO', label: 'Numérico', icon: 'tag' },
    { value: 'FECHA', label: 'Fecha', icon: 'calendar_today' },
    { value: 'TEXTO', label: 'Texto', icon: 'text_fields' },
  ];

  filteredVariables = computed(() => {
    let vars = this.variables();
    const search = this.searchTerm().toLowerCase().trim();
    const typeFilter = this.activeTypeFilter();

    if (search) {
      vars = vars.filter(
        (v) =>
          v.nombre_columna.toLowerCase().includes(search) ||
          v.nombre_original.toLowerCase().includes(search),
      );
    }

    if (typeFilter) {
      vars = vars.filter((v) => v.tipo_dato === typeFilter);
    }

    return vars;
  });

  allFilteredSelected = computed(() => {
    const filtered = this.filteredVariables();
    const selected = this.selectedIds();
    return filtered.length > 0 && filtered.every((v) => selected.has(v.id));
  });

  someFilteredSelected = computed(() => {
    const filtered = this.filteredVariables();
    const selected = this.selectedIds();
    return filtered.some((v) => selected.has(v.id));
  });

  toggleSelectionMode(): void {
    const newMode = !this.selectionMode();
    this.selectionMode.set(newMode);
    if (!newMode) {
      this.selectedIds.set(new Set());
    }
  }

  toggleSelection(id: string): void {
    this.selectedIds.update((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  toggleSelectAll(): void {
    if (this.allFilteredSelected()) {
      // Deselect all filtered
      const filteredIds = new Set(this.filteredVariables().map((v) => v.id));
      this.selectedIds.update((current) => {
        const next = new Set(current);
        filteredIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      // Select all filtered
      this.selectedIds.update((current) => {
        const next = new Set(current);
        this.filteredVariables().forEach((v) => next.add(v.id));
        return next;
      });
    }
  }

  onCardClick(variable: VariableMetadato, event: Event): void {
    if (this.selectionMode()) {
      this.toggleSelection(variable.id);
    } else {
      this.variableSelected.emit(variable);
    }
  }

  bulkSetVisibility(visible: boolean): void {
    const ids = Array.from(this.selectedIds());
    if (ids.length === 0) return;
    this.bulkActionRequested.emit({ variableIds: ids, action: 'visibility', value: visible });
  }

  bulkSetType(type: string): void {
    const ids = Array.from(this.selectedIds());
    if (ids.length === 0) return;
    this.bulkActionRequested.emit({ variableIds: ids, action: 'type', value: type });
  }

  toggleTypeFilter(type: string): void {
    this.activeTypeFilter.update((current) => (current === type ? null : type));
  }

  getTypeIcon(tipo: string): string {
    switch (tipo) {
      case 'NUMERICO':
        return 'tag';
      case 'CATEGORICO':
        return 'category';
      case 'FECHA':
        return 'calendar_today';
      case 'TEXTO':
        return 'text_fields';
      default:
        return 'help_outline';
    }
  }

  getTypeLabel(tipo: string): string {
    switch (tipo) {
      case 'NUMERICO':
        return 'Numérico';
      case 'CATEGORICO':
        return 'Categórico';
      case 'FECHA':
        return 'Fecha';
      case 'TEXTO':
        return 'Texto';
      default:
        return tipo;
    }
  }
}
