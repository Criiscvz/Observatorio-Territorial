import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DashboardService } from '@core/services/dashboard.service';
import { NgramItem, TextAnalysisResponse } from '@core/services/interfaces';
import { ChartFilter } from '@core/services/interfaces/stats/univariable-request.interface';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-text-insights-panel',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatButtonToggleModule,
    TranslateModule,
  ],
  template: `
    <div class="insights-panel">
      @if (loading()) {
        <div class="insights-loading">
          <mat-spinner diameter="32"></mat-spinner>
          <span>{{ 'textInsights.analyzing' | translate }}</span>
        </div>
      } @else if (analysisData()) {
        <!-- Sentiment Card -->
        <div class="insight-card sentiment-card">
          <div class="card-header">
            <mat-icon>sentiment_satisfied</mat-icon>
            <h4>{{ 'textInsights.sentiment' | translate }}</h4>
          </div>
          <div class="sentiment-body">
            <div class="sentiment-gauge" [class]="sentimentClass()">
              <div class="gauge-icon">
                <mat-icon>{{ sentimentIcon() }}</mat-icon>
              </div>
              <div class="gauge-info">
                <span class="gauge-label">{{ sentimentLabel() }}</span>
                <span class="gauge-score">{{ sentimentScoreText() }}</span>
              </div>
            </div>
            <div class="sentiment-bars">
              <div class="bar-row">
                <span class="bar-label positive">
                  <mat-icon>thumb_up</mat-icon>
                  {{ analysisData()!.sentiment.distribution.positive }}
                </span>
                <div class="bar-track">
                  <div class="bar-fill positive" [style.width.%]="sentimentPct().positive"></div>
                </div>
              </div>
              <div class="bar-row">
                <span class="bar-label neutral-label">
                  <mat-icon>sentiment_neutral</mat-icon>
                  {{ analysisData()!.sentiment.distribution.neutral }}
                </span>
                <div class="bar-track">
                  <div class="bar-fill neutral-fill" [style.width.%]="sentimentPct().neutral"></div>
                </div>
              </div>
              <div class="bar-row">
                <span class="bar-label negative">
                  <mat-icon>thumb_down</mat-icon>
                  {{ analysisData()!.sentiment.distribution.negative }}
                </span>
                <div class="bar-track">
                  <div class="bar-fill negative" [style.width.%]="sentimentPct().negative"></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- N-grams Card -->
        <div class="insight-card ngrams-card">
          <div class="card-header">
            <mat-icon>text_fields</mat-icon>
            <h4>{{ 'textInsights.topPhrases' | translate }}</h4>
            <div class="ngram-toggle">
              <mat-button-toggle-group
                [value]="ngramMode()"
                (change)="ngramMode.set($event.value)"
                hideSingleSelectionIndicator
              >
                <mat-button-toggle value="bigrams"
                  >2 {{ 'textInsights.words' | translate }}</mat-button-toggle
                >
                <mat-button-toggle value="trigrams"
                  >3 {{ 'textInsights.words' | translate }}</mat-button-toggle
                >
              </mat-button-toggle-group>
            </div>
          </div>
          <div class="ngrams-body">
            @for (item of activeNgrams(); track item.phrase) {
              <div class="ngram-row">
                <span class="ngram-phrase">{{ item.phrase }}</span>
                <div class="ngram-bar-wrapper">
                  <div class="ngram-bar" [style.width.%]="ngramBarWidth(item)"></div>
                </div>
                <span class="ngram-count">{{ item.count }}</span>
              </div>
            } @empty {
              <div class="ngrams-empty">
                <mat-icon>info_outline</mat-icon>
                <span>{{ 'textInsights.noPhrases' | translate }}</span>
              </div>
            }
          </div>
        </div>

        <!-- Keywords Card -->
        <div class="insight-card keywords-card">
          <div class="card-header">
            <mat-icon>label</mat-icon>
            <h4>{{ 'textInsights.topKeywords' | translate }}</h4>
          </div>
          <div class="keywords-body">
            @for (kw of topKeywords(); track kw.label; let i = $index) {
              <div class="keyword-chip" [style.opacity]="1 - i * 0.05">
                <span class="keyword-rank">#{{ i + 1 }}</span>
                <span class="keyword-label">{{ kw.label }}</span>
                <span class="keyword-count">{{ kw.count }}</span>
              </div>
            }
          </div>
        </div>

        <!-- Stats Summary -->
        <div class="insight-card stats-card">
          <div class="card-header">
            <mat-icon>analytics</mat-icon>
            <h4>{{ 'textInsights.textStats' | translate }}</h4>
          </div>
          <div class="stats-grid">
            <div class="stat-item">
              <span class="stat-number">{{ analysisData()!.stats.total_texts | number }}</span>
              <span class="stat-desc">{{ 'textInsights.totalTexts' | translate }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-number">{{ analysisData()!.stats.unique_words | number }}</span>
              <span class="stat-desc">{{ 'textInsights.uniqueWords' | translate }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-number">{{
                analysisData()!.stats.avg_text_length | number: '1.0-0'
              }}</span>
              <span class="stat-desc">{{ 'textInsights.avgLength' | translate }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-number">{{ analysisData()!.stats.bigrams_found | number }}</span>
              <span class="stat-desc">{{ 'textInsights.phrasesFound' | translate }}</span>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .insights-panel {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      .insights-loading {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 24px;
        justify-content: center;
        color: var(--text-secondary);
      }

      .insight-card {
        background: var(--surface-card, #fff);
        border-radius: 12px;
        border: 1px solid var(--border-color, #e0e0e0);
        overflow: hidden;
      }

      .card-header {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 12px 16px;
        border-bottom: 1px solid var(--border-color, #e0e0e0);
        background: var(--surface-hover, #fafafa);

        mat-icon {
          font-size: 20px;
          width: 20px;
          height: 20px;
          color: var(--primary);
        }

        h4 {
          margin: 0;
          font-size: 14px;
          font-weight: 600;
          flex: 1;
        }
      }

      /* Sentiment */
      .sentiment-body {
        padding: 16px;
      }

      .sentiment-gauge {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 16px;
        padding: 12px;
        border-radius: 8px;

        &.positive {
          background: rgba(76, 175, 80, 0.08);
          .gauge-icon mat-icon {
            color: #4caf50;
          }
          .gauge-label {
            color: #2e7d32;
          }
        }
        &.negative {
          background: rgba(244, 67, 54, 0.08);
          .gauge-icon mat-icon {
            color: #f44336;
          }
          .gauge-label {
            color: #c62828;
          }
        }
        &.neutral {
          background: rgba(158, 158, 158, 0.08);
          .gauge-icon mat-icon {
            color: #9e9e9e;
          }
          .gauge-label {
            color: #616161;
          }
        }
      }

      .gauge-icon mat-icon {
        font-size: 32px;
        width: 32px;
        height: 32px;
      }

      .gauge-info {
        display: flex;
        flex-direction: column;
      }

      .gauge-label {
        font-weight: 700;
        font-size: 16px;
        text-transform: capitalize;
      }

      .gauge-score {
        font-size: 12px;
        color: var(--text-secondary);
      }

      .sentiment-bars {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .bar-row {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .bar-label {
        display: flex;
        align-items: center;
        gap: 4px;
        min-width: 56px;
        font-size: 13px;
        font-weight: 500;

        mat-icon {
          font-size: 16px;
          width: 16px;
          height: 16px;
        }

        &.positive {
          color: #4caf50;
        }
        &.negative {
          color: #f44336;
        }
        &.neutral-label {
          color: #9e9e9e;
        }
      }

      .bar-track {
        flex: 1;
        height: 8px;
        background: var(--surface-hover, #f0f0f0);
        border-radius: 4px;
        overflow: hidden;
      }

      .bar-fill {
        height: 100%;
        border-radius: 4px;
        transition: width 0.5s ease-out;

        &.positive {
          background: #4caf50;
        }
        &.negative {
          background: #f44336;
        }
        &.neutral-fill {
          background: #bdbdbd;
        }
      }

      /* N-grams */
      .ngram-toggle {
        ::ng-deep .mat-button-toggle-group {
          height: 28px;
          border-radius: 6px;
        }
        ::ng-deep .mat-button-toggle {
          font-size: 12px;
        }
      }

      .ngrams-body {
        padding: 12px 16px;
        display: flex;
        flex-direction: column;
        gap: 6px;
        max-height: 240px;
        overflow-y: auto;
      }

      .ngram-row {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .ngram-phrase {
        min-width: 140px;
        font-size: 13px;
        font-weight: 500;
        color: var(--text-primary);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .ngram-bar-wrapper {
        flex: 1;
        height: 6px;
        background: var(--surface-hover, #f0f0f0);
        border-radius: 3px;
        overflow: hidden;
      }

      .ngram-bar {
        height: 100%;
        background: var(--primary);
        border-radius: 3px;
        transition: width 0.4s ease-out;
      }

      .ngram-count {
        min-width: 36px;
        text-align: right;
        font-size: 12px;
        color: var(--text-secondary);
        font-weight: 500;
      }

      .ngrams-empty {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 12px;
        color: var(--text-secondary);
        font-size: 13px;
      }

      /* Keywords */
      .keywords-body {
        padding: 12px 16px;
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      .keyword-chip {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 4px 10px;
        background: var(--primary-light, rgba(63, 81, 181, 0.08));
        border-radius: 16px;
        font-size: 13px;
        transition: transform 0.15s;

        &:hover {
          transform: scale(1.05);
        }
      }

      .keyword-rank {
        font-weight: 700;
        color: var(--primary);
        font-size: 11px;
      }

      .keyword-label {
        font-weight: 500;
        text-transform: capitalize;
      }

      .keyword-count {
        color: var(--text-secondary);
        font-size: 11px;
      }

      /* Stats */
      .stats-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 1px;
        background: var(--border-color, #e0e0e0);
      }

      .stat-item {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 12px 8px;
        background: var(--surface-card, #fff);
      }

      .stat-number {
        font-size: 20px;
        font-weight: 700;
        color: var(--primary);
      }

      .stat-desc {
        font-size: 11px;
        color: var(--text-secondary);
        text-align: center;
        margin-top: 2px;
      }
    `,
  ],
})
export class TextInsightsPanelComponent {
  // Inputs
  datasetId = input.required<string>();
  variableId = input.required<string>();
  isAdmin = input<boolean>(false);
  filters = input<ChartFilter[]>([]);

  // Services
  private readonly dashboardService = inject(DashboardService);

  // State
  loading = signal(false);
  analysisData = signal<TextAnalysisResponse | null>(null);
  ngramMode = signal<'bigrams' | 'trigrams'>('bigrams');

  // Computed
  sentimentClass = computed(() => this.analysisData()?.sentiment.overall ?? 'neutral');
  sentimentIcon = computed(() => {
    const s = this.analysisData()?.sentiment.overall;
    if (s === 'positive') return 'sentiment_very_satisfied';
    if (s === 'negative') return 'sentiment_very_dissatisfied';
    return 'sentiment_neutral';
  });
  sentimentLabel = computed(() => {
    const s = this.analysisData()?.sentiment.overall;
    if (s === 'positive') return 'Positivo';
    if (s === 'negative') return 'Negativo';
    return 'Neutral';
  });
  sentimentScoreText = computed(() => {
    const score = this.analysisData()?.sentiment.score ?? 0;
    return `Score: ${(score * 100).toFixed(1)}%`;
  });

  sentimentPct = computed(() => {
    const d = this.analysisData()?.sentiment.distribution;
    if (!d) return { positive: 0, negative: 0, neutral: 0 };
    const total = d.positive + d.negative + d.neutral || 1;
    return {
      positive: (d.positive / total) * 100,
      negative: (d.negative / total) * 100,
      neutral: (d.neutral / total) * 100,
    };
  });

  activeNgrams = computed((): NgramItem[] => {
    const data = this.analysisData();
    if (!data?.ngrams) return [];
    return this.ngramMode() === 'bigrams'
      ? (data.ngrams.bigrams ?? [])
      : (data.ngrams.trigrams ?? []);
  });

  topKeywords = computed(() => {
    const data = this.analysisData();
    if (!data?.keywords?.labels) return [];
    return data.keywords.labels
      .map((label, i) => ({
        label,
        count: data.keywords.values?.[i] ?? 0,
      }))
      .slice(0, 15);
  });

  // Max ngram value for bar width computation
  private maxNgramCount = computed(() => {
    const items = this.activeNgrams();
    return items.length > 0 ? Math.max(...items.map((i) => i.count)) : 1;
  });

  constructor() {
    // Auto-load when inputs change
    effect(() => {
      const dsId = this.datasetId();
      const varId = this.variableId();
      if (dsId && varId) {
        this.loadAnalysis();
      }
    });
  }

  ngramBarWidth(item: NgramItem): number {
    return (item.count / this.maxNgramCount()) * 100;
  }

  loadAnalysis(): void {
    this.loading.set(true);
    const request = {
      dataset_id: this.datasetId(),
      variable_id: this.variableId(),
      limit: 50,
      filters: this.filters().length > 0 ? this.filters() : undefined,
    };

    const obs = this.isAdmin()
      ? this.dashboardService.getTextAnalysis(request)
      : this.dashboardService.getPublicTextAnalysis(request);

    obs.subscribe({
      next: (data) => {
        this.analysisData.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }
}
