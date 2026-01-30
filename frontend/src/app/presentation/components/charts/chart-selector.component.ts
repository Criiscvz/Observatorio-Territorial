import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { ChartTypeOption } from '../../viewmodels/dataset-analysis.viewmodel';

@Component({
  selector: 'app-chart-selector',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatIconModule],
  template: `
    <div class="chart-selector-grid">
      @for (chartType of chartTypes; track chartType.id) {
        <mat-card 
          class="chart-type-card" 
          [class.selected]="selectedType?.id === chartType.id"
          [class.disabled]="!isAvailable(chartType)"
          (click)="selectType(chartType)">
          <div class="card-content">
            <mat-icon class="chart-icon">{{ chartType.icon }}</mat-icon>
            <span class="chart-name">{{ chartType.name }}</span>
            <span class="chart-desc">{{ chartType.description }}</span>
            @if (chartType.bivariable) {
              <span class="badge bivariable">2 Variables</span>
            }
          </div>
        </mat-card>
      }
    </div>
  `,
  styles: [`
    .chart-selector-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
      gap: 12px;
    }
    .chart-type-card {
      cursor: pointer;
      transition: all 0.2s ease;
    }
    .chart-type-card:hover:not(.disabled) {
      transform: translateY(-2px);
      box-shadow: 0 4px 8px rgba(0,0,0,0.1);
    }
    .chart-type-card.selected {
      border: 2px solid #00695C;
      background-color: #E0F2F1;
    }
    .chart-type-card.disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .card-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 12px;
      text-align: center;
    }
    .chart-icon {
      font-size: 32px;
      width: 32px;
      height: 32px;
      color: #00695C;
      margin-bottom: 8px;
    }
    .chart-name {
      font-weight: 500;
      font-size: 14px;
      margin-bottom: 4px;
    }
    .chart-desc {
      font-size: 11px;
      color: #666;
    }
    .badge {
      margin-top: 8px;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 10px;
      background-color: #E8F5E9;
      color: #2E7D32;
    }
  `],
})
export class ChartSelectorComponent {
  @Input() chartTypes: ChartTypeOption[] = [];
  @Input() selectedType: ChartTypeOption | null = null;
  @Input() availableTypes: ChartTypeOption[] = [];
  @Output() typeSelected = new EventEmitter<ChartTypeOption>();

  isAvailable(chartType: ChartTypeOption): boolean {
    return this.availableTypes.some(t => t.id === chartType.id);
  }

  selectType(chartType: ChartTypeOption): void {
    if (this.isAvailable(chartType)) {
      this.typeSelected.emit(chartType);
    }
  }
}
