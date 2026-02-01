import { CommonModule } from '@angular/common';
import { Component, computed, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { VariableMetadato } from '@core/models';
import { TranslateModule } from '@ngx-translate/core';
import { ChartType } from '@shared/models';

@Component({
  selector: 'app-variable-selector',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatFormFieldModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    TranslateModule,
  ],
  template: `
    <div class="variable-selection">
      <mat-form-field appearance="outline">
        <mat-label>{{ 'datasets.view.analysis.variableX' | translate }}</mat-label>
        <mat-select [(value)]="variableX" (selectionChange)="onVariableXChange()">
          @for (v of compatibleVariablesX(); track v.id) {
            <mat-option [value]="v">
              {{ v.nombre_original }}
              <span class="option-type">({{ v.tipo_dato }})</span>
            </mat-option>
          }
        </mat-select>
        @if (compatibleVariablesX().length === 0) {
          <mat-hint class="hint-error">{{ incompatibilityMessageX() }}</mat-hint>
        } @else {
          <mat-hint>{{
            'datasets.view.analysis.variablesAvailable'
              | translate: { count: compatibleVariablesX().length }
          }}</mat-hint>
        }
      </mat-form-field>

      @if (selectedChartType()?.bivariable) {
        <mat-form-field appearance="outline">
          <mat-label>{{ 'datasets.view.analysis.variableY' | translate }}</mat-label>
          <mat-select [(value)]="variableY">
            @for (v of compatibleVariablesY(); track v.id) {
              <mat-option [value]="v">
                {{ v.nombre_original }}
                <span class="option-type">({{ v.tipo_dato }})</span>
              </mat-option>
            }
          </mat-select>
          @if (variableX && compatibleVariablesY().length === 0) {
            <mat-hint class="hint-error">{{ incompatibilityMessageY() }}</mat-hint>
          } @else if (compatibleVariablesY().length > 0) {
            <mat-hint>{{
              'datasets.view.analysis.variablesCompatible'
                | translate: { count: compatibleVariablesY().length }
            }}</mat-hint>
          }
        </mat-form-field>
      }

      <button mat-raised-button color="primary" [disabled]="!canAddChart()" (click)="onAddChart()">
        <mat-icon>add_chart</mat-icon>
        {{ 'datasets.view.analysis.addChart' | translate }}
      </button>
    </div>
  `,
  styles: [
    `
      .variable-selection {
        display: flex;
        gap: 1rem;
        flex-wrap: wrap;
        align-items: flex-end;
      }

      .variable-selection mat-form-field {
        flex: 1;
        min-width: 200px;
      }

      .option-type {
        font-size: 0.75rem;
        color: var(--text-tertiary);
        margin-left: 0.5rem;
      }

      .hint-error {
        color: var(--warning-color, #f59e0b) !important;
        font-weight: 500;
      }

      ::ng-deep .mat-mdc-form-field-hint {
        font-size: 0.75rem;
      }
    `,
  ],
})
export class VariableSelectorComponent {
  selectedChartType = input<ChartType | null>(null);
  variables = input.required<VariableMetadato[]>();

  variableX: VariableMetadato | null = null;
  variableY: VariableMetadato | null = null;

  addChart = output<{ variableX: VariableMetadato; variableY?: VariableMetadato }>();
  variableXChanged = output<VariableMetadato | null>();

  // Variables compatibles con el tipo de gráfico seleccionado (Variable X)
  compatibleVariablesX = computed(() => {
    const chartType = this.selectedChartType();
    const vars = this.variables();
    if (!chartType) return vars;

    return vars.filter((v) => {
      switch (chartType.id) {
        case 'scatter':
        case 'histogram':
        case 'gauge':
          return v.tipo_dato === 'NUMERICO';
        case 'pie':
        case 'donut':
        case 'funnel':
        case 'treemap':
        case 'radar':
          return v.tipo_dato === 'CATEGORICO' || v.tipo_dato === 'TEXTO';
        case 'bar':
        case 'heatmap':
        case 'stacked_bar':
          return v.tipo_dato === 'CATEGORICO' || v.tipo_dato === 'TEXTO';
        case 'grouped_bar':
        case 'box_compare':
          return (
            v.tipo_dato === 'CATEGORICO' || v.tipo_dato === 'NUMERICO' || v.tipo_dato === 'TEXTO'
          );
        case 'line_time':
          return v.tipo_dato === 'FECHA' || v.tipo_dato === 'NUMERICO';
        case 'line':
        case 'area':
          return (
            v.tipo_dato === 'FECHA' || v.tipo_dato === 'NUMERICO' || v.tipo_dato === 'CATEGORICO'
          );
        default:
          return true;
      }
    });
  });

  // Variables compatibles para Y (solo bivariables)
  compatibleVariablesY = computed(() => {
    const chartType = this.selectedChartType();
    const vars = this.variables();
    if (!chartType?.bivariable) return [];

    const selectedX = this.variableX;
    const tipoX = selectedX?.tipo_dato === 'TEXTO' ? 'CATEGORICO' : selectedX?.tipo_dato;

    return vars.filter((v) => {
      if (selectedX && v.id === selectedX.id) return false;
      const tipoY = v.tipo_dato === 'TEXTO' ? 'CATEGORICO' : v.tipo_dato;

      switch (chartType.id) {
        case 'scatter':
          return v.tipo_dato === 'NUMERICO';
        case 'heatmap':
          return v.tipo_dato === 'CATEGORICO' || v.tipo_dato === 'TEXTO';
        case 'stacked_bar':
          if (tipoX === 'FECHA') return tipoY === 'CATEGORICO';
          if (tipoX === 'CATEGORICO') return tipoY === 'FECHA' || tipoY === 'CATEGORICO';
          return tipoY === 'CATEGORICO';
        case 'grouped_bar':
        case 'box_compare':
          if (tipoX === 'CATEGORICO') return v.tipo_dato === 'NUMERICO';
          if (tipoX === 'NUMERICO') return v.tipo_dato === 'CATEGORICO' || v.tipo_dato === 'TEXTO';
          return v.tipo_dato === 'NUMERICO' || v.tipo_dato === 'CATEGORICO';
        case 'line_time':
          if (selectedX?.tipo_dato === 'FECHA') return v.tipo_dato === 'NUMERICO';
          if (selectedX?.tipo_dato === 'NUMERICO') return v.tipo_dato === 'FECHA';
          return v.tipo_dato === 'FECHA' || v.tipo_dato === 'NUMERICO';
        default:
          return true;
      }
    });
  });

  incompatibilityMessageX = computed(() => {
    const chartType = this.selectedChartType();
    if (!chartType) return null;

    switch (chartType.id) {
      case 'scatter':
      case 'histogram':
      case 'gauge':
        return 'Este gráfico requiere variables numéricas';
      case 'pie':
      case 'donut':
      case 'heatmap':
      case 'funnel':
      case 'treemap':
      case 'radar':
        return 'Este gráfico requiere variables categóricas';
      case 'line_time':
        return 'Este gráfico requiere una fecha y una numérica';
      default:
        return 'No hay variables compatibles';
    }
  });

  incompatibilityMessageY = computed(() => {
    const chartType = this.selectedChartType();
    if (!chartType) return null;

    switch (chartType.id) {
      case 'scatter':
        return 'Selecciona otra variable numérica';
      case 'heatmap':
        return 'Selecciona otra variable categórica';
      case 'grouped_bar':
      case 'box_compare':
        return 'Selecciona una variable del tipo opuesto';
      case 'line_time':
        return 'Selecciona una fecha o numérica';
      default:
        return 'No hay variables compatibles';
    }
  });

  canAddChart(): boolean {
    const type = this.selectedChartType();
    if (!type || !this.variableX) return false;
    if (type.bivariable && !this.variableY) return false;
    return true;
  }

  onVariableXChange(): void {
    this.variableXChanged.emit(this.variableX);
    // Reset Y when X changes
    this.variableY = null;
  }

  onAddChart(): void {
    if (!this.canAddChart() || !this.variableX) return;
    this.addChart.emit({
      variableX: this.variableX,
      variableY: this.variableY || undefined,
    });
  }

  reset(): void {
    this.variableX = null;
    this.variableY = null;
  }
}
