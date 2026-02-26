import { CommonModule } from '@angular/common';
import { Component, inject, input, output, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ChartData, VariableMetadato } from '@core/models';
import { BivariableResponse } from '@core/services/interfaces';
import { ChartFilter } from '@core/services/interfaces/stats/univariable-request.interface';
import { TranslateModule } from '@ngx-translate/core';
import { ActiveChart } from '@shared/models';
import { ChartOptionsService } from '@shared/services/chart-options.service';
import { ExportService } from '@shared/services/export.service';
import { EChartsOption } from 'echarts';
import { NgxEchartsDirective } from 'ngx-echarts';
import { ChartFiltersComponent } from '../chart-filters/chart-filters.component';

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
    ChartFiltersComponent,
  ],
  template: `
    <mat-card class="chart-card">
      <div class="chart-actions">
        <button
          mat-icon-button
          class="export-chart"
          (click)="exportPng()"
          [matTooltip]="'charts.export.png' | translate"
        >
          <mat-icon>image</mat-icon>
        </button>
        <button
          mat-icon-button
          class="export-chart"
          (click)="exportCsv()"
          [matTooltip]="'charts.export.csv' | translate"
        >
          <mat-icon>download</mat-icon>
        </button>
        @if (variables().length > 0) {
          <button
            mat-icon-button
            class="filter-chart"
            (click)="toggleFilters()"
            [matTooltip]="'datasets.view.analysis.filters' | translate"
          >
            <mat-icon [class.has-filters]="hasLocalFilters()">filter_list</mat-icon>
            @if (hasLocalFilters()) {
              <span class="filter-badge">{{ chart().filters?.length }}</span>
            }
          </button>
        }
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
      @if (chart().description) {
        <p class="chart-description">{{ chart().description }}</p>
      }
      <mat-card-content>
        @if (showFilters()) {
          <app-chart-filters
            [variables]="variables()"
            (filtersChange)="onLocalFiltersChange($event)"
          />
        }
        @if (chart().loading) {
          <div class="chart-loading">
            <mat-spinner diameter="32"></mat-spinner>
          </div>
        } @else if (chart().data) {
          <div
            echarts
            [options]="chartOptions()"
            (chartInit)="onChartInit($event)"
            class="chart-canvas"
          ></div>
        } @else {
          <div class="chart-error">
            <mat-icon>error_outline</mat-icon>
            <p>{{ 'charts.errors.loadFailed' | translate }}</p>
          </div>
        }
        @if (chart().analisis) {
          <div class="chart-analysis">
            <mat-icon>psychology</mat-icon>
            <p>{{ chart().analisis }}</p>
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

      .export-chart mat-icon {
        color: var(--text-tertiary);
        font-size: 20px;
      }

      .export-chart:hover mat-icon {
        color: var(--primary-600);
      }

      .filter-chart {
        position: relative;
      }

      .filter-chart .has-filters {
        color: var(--primary-600);
      }

      .filter-badge {
        position: absolute;
        top: 2px;
        right: 2px;
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background: var(--primary-600);
        color: white;
        font-size: 0.625rem;
        font-weight: 700;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .chart-canvas {
        height: 280px;
      }

      .chart-canvas.compact {
        height: 200px;
      }

      .chart-description {
        font-size: 0.8125rem;
        color: var(--text-secondary);
        margin: 0 16px 8px;
        line-height: 1.4;
      }

      .chart-analysis {
        display: flex;
        gap: 0.5rem;
        padding: 0.75rem;
        margin-top: 0.5rem;
        background: var(--surface-variant, rgba(0, 0, 0, 0.03));
        border-radius: var(--radius-md, 8px);
        border-left: 3px solid var(--primary-600);
      }

      .chart-analysis mat-icon {
        color: var(--primary-600);
        font-size: 18px;
        width: 18px;
        height: 18px;
        flex-shrink: 0;
        margin-top: 2px;
      }

      .chart-analysis p {
        font-size: 0.8125rem;
        color: var(--text-secondary);
        margin: 0;
        line-height: 1.5;
        font-style: italic;
      }

      :host-context(.compact) .chart-loading,
      :host-context(.compact) .chart-error {
        height: 200px;
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
  private exportService = inject(ExportService);

  chart = input.required<ActiveChart>();
  showSave = input<boolean>(false);
  variables = input<VariableMetadato[]>([]);
  compact = input<boolean>(false);
  remove = output<string>();
  save = output<ActiveChart>();
  filtersChange = output<{ chartId: string; filters: ChartFilter[] }>();

  showFilters = signal(false);
  private echartsInstance: any = null;

  onChartInit(instance: any): void {
    this.echartsInstance = instance;
  }

  exportPng(): void {
    if (!this.echartsInstance) return;
    const dataUrl = this.echartsInstance.getDataURL({
      type: 'png',
      pixelRatio: 2,
      backgroundColor: '#fff',
    });
    const name = this.chart().title || 'grafico';
    this.exportService.downloadChartPng(dataUrl, name);
  }

  exportCsv(): void {
    const data = this.chart().data;
    if (!data) return;
    const name = this.chart().title || 'datos';

    if ('labels' in data && 'values' in data) {
      const chartData = data as ChartData;
      this.exportService.downloadFrequencyCsv(chartData.labels || [], chartData.values || [], name);
    }
  }

  hasLocalFilters(): boolean {
    return (this.chart().filters?.length ?? 0) > 0;
  }

  toggleFilters(): void {
    this.showFilters.update((v) => !v);
  }

  onLocalFiltersChange(filters: ChartFilter[]): void {
    this.filtersChange.emit({ chartId: this.chart().id, filters });
  }

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
