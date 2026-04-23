import { CommonModule } from '@angular/common';
import { Component, input, output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { TranslateModule } from '@ngx-translate/core';
import { ChartType } from '@shared/models';

@Component({
  selector: 'app-chart-type-selector',
  standalone: true,
  imports: [CommonModule, MatIconModule, TranslateModule],
  template: `
    <div class="chart-types-grid">
      @for (type of chartTypes(); track type.id) {
        <div
          class="chart-type-item"
          [class.selected]="selectedType()?.id === type.id"
          (click)="selectType(type)"
        >
          <mat-icon>{{ type.icon }}</mat-icon>
          <span class="type-name">{{ 'charts.types.' + type.id + '.name' | translate }}</span>
          <span class="type-desc">{{
            'charts.types.' + type.id + '.description' | translate
          }}</span>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .chart-types-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
        gap: 0.75rem;
      }

      .chart-type-item {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 1rem;
        border: 2px solid var(--border-color);
        border-radius: var(--radius-lg);
        cursor: pointer;
        text-align: center;
        transition: all var(--transition-fast);
      }

      .chart-type-item:hover {
        border-color: var(--primary-300);
        background: var(--hover-bg);
      }

      .chart-type-item.selected {
        border-color: var(--primary-500);
        background: var(--primary-50);
      }

      :host-context(.dark) .chart-type-item.selected {
        background: rgba(99, 102, 241, 0.15);
      }

      .chart-type-item mat-icon {
        font-size: 28px;
        width: 28px;
        height: 28px;
        color: var(--text-secondary);
        margin-bottom: 0.5rem;
      }

      .chart-type-item.selected mat-icon {
        color: var(--primary-600);
      }

      .type-name {
        font-weight: 600;
        font-size: 0.875rem;
        color: var(--text-primary);
      }

      .type-desc {
        font-size: 0.75rem;
        color: var(--text-tertiary);
        margin-top: 0.25rem;
      }
    `,
  ],
})
export class ChartTypeSelectorComponent {
  chartTypes = input.required<ChartType[]>();
  selectedType = input<ChartType | null>(null);
  typeSelected = output<ChartType>();

  selectType(type: ChartType): void {
    this.typeSelected.emit(type);
  }
}
