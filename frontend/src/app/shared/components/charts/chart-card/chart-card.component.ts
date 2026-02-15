import { CommonModule } from '@angular/common';
import { Component, inject, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ChartData } from '@core/models';
import { BivariableResponse } from '@core/services/interfaces';
import { TranslateModule } from '@ngx-translate/core';
import { ActiveChart } from '@shared/models';
import { ChartOptionsService } from '@shared/services/chart-options.service';
import { EChartsOption } from 'echarts';
import { NgxEchartsDirective } from 'ngx-echarts';

@Component({
  selector: 'app-chart-card',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    NgxEchartsDirective,
    TranslateModule,
  ],
  template: `
    <mat-card class="chart-card">
      <div class="chart-actions">
        @if (showSave()) {
          <button
            mat-icon-button
            class="save-chart"
            (click)="save.emit(chart())"
            [matTooltip]="'charts.predefined.save' | translate"
          >
            <mat-icon>bookmark_border</mat-icon>
          </button>
        }
        <button mat-icon-button class="remove-chart" (click)="remove.emit(chart().id)">
          <mat-icon>close</mat-icon>
        </button>
      </div>
      <mat-card-header>
        <mat-icon mat-card-avatar>{{ chart().chartType.icon }}</mat-icon>
        <mat-card-title>{{ chart().title }}</mat-card-title>
        <mat-card-subtitle>{{
          'charts.types.' + chart().chartType.id + '.name' | translate
        }}</mat-card-subtitle>
      </mat-card-header>
      <mat-card-content>
        @if (chart().loading) {
          <div class="chart-loading">
            <mat-spinner diameter="32"></mat-spinner>
          </div>
        } @else if (chart().data) {
          <div echarts [options]="chartOptions()" class="chart-canvas"></div>
        } @else {
          <div class="chart-error">
            <mat-icon>error_outline</mat-icon>
            <p>{{ 'charts.errors.loadFailed' | translate }}</p>
          </div>
        }
      </mat-card-content>
    </mat-card>
  `,
  styles: [
    `
      .chart-card {
        position: relative;
      }

      .chart-actions {
        position: absolute;
        top: 8px;
        right: 8px;
        z-index: 10;
        display: flex;
        gap: 2px;
      }

      .save-chart mat-icon {
        color: var(--primary-600);
      }

      .chart-canvas {
        height: 280px;
      }

      .chart-loading,
      .chart-error {
        height: 280px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        color: var(--text-tertiary);
      }
    `,
  ],
})
export class ChartCardComponent {
  private chartOptionsService = inject(ChartOptionsService);

  chart = input.required<ActiveChart>();
  showSave = input<boolean>(false);
  remove = output<string>();
  save = output<ActiveChart>();

  chartOptions(): EChartsOption {
    const chartData = this.chart();
    if (!chartData.data) return {};

    // Check if bivariable
    if ('variable_x_id' in chartData.data || 'nombre_variable_x' in chartData.data) {
      return this.chartOptionsService.getBivariableOptions(
        chartData.data as BivariableResponse,
        chartData.chartType.id,
      );
    }

    // Univariable
    return this.chartOptionsService.getUnivariableOptions(
      chartData.data as ChartData,
      chartData.chartType.id,
    );
  }
}
