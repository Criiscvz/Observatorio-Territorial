import { CommonModule } from '@angular/common';
import { Component, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DashboardService } from '@core/services/dashboard.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-stopwords-manager',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatChipsModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatTooltipModule,
    TranslateModule,
  ],
  template: `
    <div class="stopwords-panel">
      <div class="panel-header">
        <div class="header-title">
          <mat-icon>block</mat-icon>
          <h4>{{ 'stopwords.title' | translate }}</h4>
        </div>
        <span class="count-badge">{{ stopwords().length }}</span>
      </div>

      <p class="panel-description">{{ 'stopwords.description' | translate }}</p>

      @if (loading()) {
        <div class="loading-state">
          <mat-spinner diameter="24"></mat-spinner>
        </div>
      } @else {
        <!-- Add new stopword -->
        <div class="add-row">
          <mat-form-field appearance="outline" class="add-field">
            <mat-icon matPrefix>add</mat-icon>
            <input
              matInput
              [(ngModel)]="newWord"
              [placeholder]="'stopwords.addPlaceholder' | translate"
              (keyup.enter)="addWord()"
            />
          </mat-form-field>
          <button
            mat-flat-button
            color="primary"
            [disabled]="!newWord.trim() || saving()"
            (click)="addWord()"
          >
            {{ 'stopwords.add' | translate }}
          </button>
        </div>

        <!-- Stopwords chips -->
        @if (stopwords().length > 0) {
          <div class="chips-container">
            @for (word of stopwords(); track word) {
              <span class="stopword-chip">
                {{ word }}
                <button
                  class="chip-remove"
                  (click)="removeWord(word)"
                  [matTooltip]="'common.buttons.delete' | translate"
                >
                  <mat-icon>close</mat-icon>
                </button>
              </span>
            }
          </div>
        } @else {
          <p class="empty-message">{{ 'stopwords.empty' | translate }}</p>
        }
      }
    </div>
  `,
  styles: [
    `
      .stopwords-panel {
        border: 1px solid var(--card-border);
        border-radius: var(--radius-lg);
        padding: 1rem 1.25rem;
        background: var(--card-bg);
      }

      .panel-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 0.25rem;
      }

      .header-title {
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }

      .header-title mat-icon {
        color: var(--primary-600);
        font-size: 20px;
        width: 20px;
        height: 20px;
      }

      .header-title h4 {
        margin: 0;
        font-size: 0.9375rem;
        font-weight: 600;
        color: var(--text-primary);
      }

      .count-badge {
        font-size: 0.75rem;
        font-weight: 600;
        padding: 0.125rem 0.5rem;
        background: var(--primary-50);
        color: var(--primary-700);
        border-radius: 999px;
      }

      .panel-description {
        font-size: 0.8125rem;
        color: var(--text-secondary);
        margin: 0 0 0.75rem;
        line-height: 1.4;
      }

      .add-row {
        display: flex;
        gap: 0.5rem;
        align-items: flex-start;
        margin-bottom: 0.75rem;
      }

      .add-field {
        flex: 1;
        font-size: 0.875rem;
      }

      .add-field ::ng-deep .mat-mdc-form-field-subscript-wrapper {
        display: none;
      }

      .chips-container {
        display: flex;
        flex-wrap: wrap;
        gap: 0.375rem;
      }

      .stopword-chip {
        display: inline-flex;
        align-items: center;
        gap: 0.25rem;
        padding: 0.25rem 0.375rem 0.25rem 0.625rem;
        background: var(--surface-variant, rgba(0, 0, 0, 0.04));
        border: 1px solid var(--card-border);
        border-radius: 999px;
        font-size: 0.8125rem;
        color: var(--text-primary);
      }

      .chip-remove {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 18px;
        height: 18px;
        border: none;
        background: transparent;
        cursor: pointer;
        border-radius: 50%;
        padding: 0;
        color: var(--text-tertiary);
        transition: all 0.15s ease;
      }

      .chip-remove:hover {
        background: rgba(239, 68, 68, 0.1);
        color: #ef4444;
      }

      .chip-remove mat-icon {
        font-size: 14px;
        width: 14px;
        height: 14px;
      }

      .loading-state {
        display: flex;
        justify-content: center;
        padding: 1rem;
      }

      .empty-message {
        font-size: 0.8125rem;
        color: var(--text-tertiary);
        text-align: center;
        padding: 1rem 0;
        margin: 0;
      }

      :host-context(.dark) .count-badge {
        background: rgba(99, 102, 241, 0.15);
        color: var(--primary-400);
      }
    `,
  ],
})
export class StopwordsManagerComponent {
  private dashboardService = inject(DashboardService);
  private snackBar = inject(MatSnackBar);
  private translate = inject(TranslateService);

  datasetId = input.required<string>();

  stopwords = signal<string[]>([]);
  loading = signal(true);
  saving = signal(false);
  newWord = '';

  constructor() {
    effect(() => {
      const id = this.datasetId();
      if (id) {
        this.loadStopwords(id);
      }
    });
  }

  private loadStopwords(datasetId: string): void {
    this.loading.set(true);
    this.dashboardService.getDatasetStopwords(datasetId).subscribe({
      next: (res) => {
        this.stopwords.set(res.stopwords || []);
        this.loading.set(false);
      },
      error: () => {
        this.stopwords.set([]);
        this.loading.set(false);
      },
    });
  }

  addWord(): void {
    const word = this.newWord.trim().toLowerCase();
    if (!word || word.length < 2) return;

    const current = this.stopwords();
    if (current.includes(word)) {
      this.newWord = '';
      return;
    }

    this.saving.set(true);
    const updated = [...current, word];
    this.dashboardService.updateDatasetStopwords(this.datasetId(), updated).subscribe({
      next: (res) => {
        this.stopwords.set(res.stopwords);
        this.newWord = '';
        this.saving.set(false);
      },
      error: () => {
        this.saving.set(false);
        this.snackBar.open(
          this.translate.instant('common.messages.error'),
          this.translate.instant('common.buttons.close'),
          { duration: 3000 },
        );
      },
    });
  }

  removeWord(word: string): void {
    const updated = this.stopwords().filter((w) => w !== word);
    this.saving.set(true);
    this.dashboardService.updateDatasetStopwords(this.datasetId(), updated).subscribe({
      next: (res) => {
        this.stopwords.set(res.stopwords);
        this.saving.set(false);
      },
      error: () => {
        this.saving.set(false);
      },
    });
  }
}
