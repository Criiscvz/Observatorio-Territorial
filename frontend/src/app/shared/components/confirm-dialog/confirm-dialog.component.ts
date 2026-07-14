import { CommonModule } from '@angular/common';
import { Component, ViewEncapsulation, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';

export interface ConfirmDialogData {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmColor?: 'primary' | 'accent' | 'warn';
  icon?: string;
}

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatDialogModule, MatIconModule],
  encapsulation: ViewEncapsulation.None,
  template: `
    <section class="confirm-dialog" [class.confirm-dialog--danger]="data.confirmColor === 'warn'">
      <div class="confirm-dialog__icon">
        <mat-icon>{{ data.icon || 'help' }}</mat-icon>
      </div>

      <h2 mat-dialog-title>{{ data.title }}</h2>
      <mat-dialog-content>
        <p>{{ data.message }}</p>
      </mat-dialog-content>

      <mat-dialog-actions align="end">
        <button mat-stroked-button class="confirm-dialog__cancel" (click)="onCancel()">
          {{ data.cancelText || 'Cancelar' }}
        </button>
        <button
          mat-flat-button
          class="confirm-dialog__confirm"
          [color]="data.confirmColor || 'primary'"
          (click)="onConfirm()"
        >
          {{ data.confirmText || 'Confirmar' }}
        </button>
      </mat-dialog-actions>
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .app-confirm-dialog-panel {
        max-width: calc(100vw - 32px) !important;
      }

      .app-confirm-dialog-panel .mat-mdc-dialog-container {
        --mdc-dialog-container-color: transparent;
        padding: 0 !important;
        border-radius: 22px !important;
        overflow: hidden !important;
      }

      .app-confirm-dialog-panel .mat-mdc-dialog-surface,
      .app-confirm-dialog-panel .mdc-dialog__surface {
        background: transparent !important;
        box-shadow: none !important;
        border-radius: 22px !important;
        overflow: hidden !important;
      }

      .app-confirm-dialog-backdrop {
        background: rgba(2, 6, 23, 0.68) !important;
        backdrop-filter: blur(4px);
      }

      .confirm-dialog {
        box-sizing: border-box;
        width: 100%;
        padding: 2rem 2.125rem 1.75rem;
        border: 1px solid rgba(148, 163, 184, 0.22);
        border-radius: 22px;
        background: var(--card-bg, #ffffff);
        color: var(--text-primary, #0f172a);
        box-shadow: 0 24px 70px rgba(15, 23, 42, 0.24);
      }

      .confirm-dialog__icon {
        width: 68px;
        height: 68px;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 1.15rem;
        border-radius: 20px;
        background: rgba(99, 102, 241, 0.12);
        color: #4f46e5;
      }

      .confirm-dialog--danger .confirm-dialog__icon {
        background: rgba(239, 68, 68, 0.14);
        color: #ef4444;
      }

      .confirm-dialog__icon mat-icon {
        width: 32px;
        height: 32px;
        font-size: 32px;
      }

      h2 {
        margin: 0 0 0.75rem;
        padding: 0;
        color: inherit;
        font-size: 1.55rem;
        font-weight: 800;
        letter-spacing: 0;
        line-height: 1.18;
      }

      .confirm-dialog .mat-mdc-dialog-title {
        color: inherit !important;
      }

      mat-dialog-content {
        display: block;
        margin: 0;
        padding: 0;
        color: var(--text-secondary, #475569);
      }

      mat-dialog-content p {
        margin: 0;
        color: inherit;
        font-size: 1rem;
        line-height: 1.65;
      }

      mat-dialog-actions {
        padding: 1.75rem 0 0;
        gap: 0.75rem;
        flex-wrap: wrap;
      }

      .confirm-dialog button {
        min-height: 44px;
        border-radius: 12px;
        font-weight: 800;
      }

      .confirm-dialog__cancel {
        border-color: rgba(148, 163, 184, 0.42);
        color: inherit !important;
      }

      .confirm-dialog__confirm,
      .confirm-dialog--danger .confirm-dialog__confirm {
        background: linear-gradient(135deg, #ef4444, #f97316);
        color: #ffffff !important;
        box-shadow: 0 16px 34px rgba(239, 68, 68, 0.24);
      }

      html.dark .confirm-dialog,
      body.dark .confirm-dialog,
      .dark .confirm-dialog {
        background: #1e293b;
        border-color: rgba(148, 163, 184, 0.2);
        color: #f8fafc;
        box-shadow: 0 28px 80px rgba(0, 0, 0, 0.45);
      }

      html.dark .confirm-dialog .mat-mdc-dialog-title,
      body.dark .confirm-dialog .mat-mdc-dialog-title,
      .dark .confirm-dialog .mat-mdc-dialog-title {
        color: #f8fafc !important;
      }

      html.dark .confirm-dialog mat-dialog-content,
      body.dark .confirm-dialog mat-dialog-content,
      .dark .confirm-dialog mat-dialog-content {
        color: #cbd5e1;
      }

      html.dark .confirm-dialog .confirm-dialog__cancel,
      body.dark .confirm-dialog .confirm-dialog__cancel,
      .dark .confirm-dialog .confirm-dialog__cancel {
        color: #f8fafc !important;
        border-color: rgba(148, 163, 184, 0.28);
      }

      html.dark .confirm-dialog--danger .confirm-dialog__icon,
      body.dark .confirm-dialog--danger .confirm-dialog__icon,
      .dark .confirm-dialog--danger .confirm-dialog__icon {
        background: rgba(239, 68, 68, 0.18);
        color: #fecaca;
      }

      @media (max-width: 520px) {
        .confirm-dialog {
          padding: 1.5rem;
        }

        mat-dialog-actions {
          align-items: stretch;
          flex-direction: column-reverse;
        }

        .confirm-dialog button {
          width: 100%;
        }
      }
    `,
  ],
})
export class ConfirmDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<ConfirmDialogComponent>);
  readonly data = inject<ConfirmDialogData>(MAT_DIALOG_DATA);

  onCancel(): void {
    this.dialogRef.close(false);
  }

  onConfirm(): void {
    this.dialogRef.close(true);
  }
}
