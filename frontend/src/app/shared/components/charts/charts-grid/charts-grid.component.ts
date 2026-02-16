import { CommonModule } from '@angular/common';
import { Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { VariableMetadato } from '@core/models';
import { ChartFilter } from '@core/services/interfaces/stats/univariable-request.interface';
import { TranslateModule } from '@ngx-translate/core';
import { ActiveChart } from '@shared/models';
import { ChartCardComponent } from '../chart-card/chart-card.component';

@Component({
  selector: 'app-charts-grid',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule, TranslateModule, ChartCardComponent],
  template: `
    @if (charts().length > 0) {
      <div class="charts-grid">
        @for (chart of charts(); track chart.id) {
          <app-chart-card
            [chart]="chart"
            [showSave]="showSave()"
            [variables]="variables()"
            (remove)="removeChart.emit($event)"
            (save)="saveChart.emit($event)"
            (filtersChange)="chartFiltersChange.emit($event)"
          />
        }
      </div>
    } @else {
      <div class="no-charts">
        <mat-icon>insert_chart</mat-icon>
        <h3>{{ 'public.datasetView.noCharts.title' | translate }}</h3>
        <p>{{ 'public.datasetView.noCharts.message' | translate }}</p>
      </div>
    }
  `,
  styles: [
    `
      .charts-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 1.5rem;
      }

      @media (max-width: 1024px) {
        .charts-grid {
          grid-template-columns: 1fr;
        }
      }

      .no-charts {
        text-align: center;
        padding: 4rem;
        background: var(--card-bg);
        border: 1px solid var(--card-border);
        border-radius: var(--radius-xl);
      }

      .no-charts mat-icon {
        font-size: 64px;
        width: 64px;
        height: 64px;
        color: var(--text-tertiary);
        opacity: 0.5;
      }

      .no-charts h3 {
        color: var(--text-primary);
        margin: 1rem 0 0.5rem;
      }

      .no-charts p {
        color: var(--text-secondary);
      }
    `,
  ],
})
export class ChartsGridComponent {
  charts = input.required<ActiveChart[]>();
  showSave = input<boolean>(false);
  variables = input<VariableMetadato[]>([]);
  removeChart = output<string>();
  saveChart = output<ActiveChart>();
  chartFiltersChange = output<{ chartId: string; filters: ChartFilter[] }>();
}
