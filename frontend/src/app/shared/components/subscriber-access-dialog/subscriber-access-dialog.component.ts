import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';

export interface SubscriberAccessDialogData {
  title?: string;
  message?: string;
  icon?: string;
  closeText?: string;
}

@Component({
  selector: 'app-subscriber-access-dialog',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatDialogModule, MatIconModule],
  template: `
    <section class="subscriber-dialog">
      <div class="dialog-icon">
        <mat-icon>{{ data.icon || 'lock' }}</mat-icon>
      </div>

      <h2 mat-dialog-title>
        {{ data.title || 'Contenido exclusivo para suscriptores' }}
      </h2>

      <mat-dialog-content>
        <p>
          {{
            data.message ||
              'Este contenido está disponible exclusivamente para usuarios suscriptores. Inicie sesión con una cuenta suscriptora o suscríbase para obtener acceso.'
          }}
        </p>
      </mat-dialog-content>

      <mat-dialog-actions align="center">
        <button mat-flat-button color="primary" type="button" (click)="close()">
          {{ data.closeText || 'Entendido' }}
        </button>
      </mat-dialog-actions>
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
        width: 100%;
      }

      .subscriber-dialog {
        width: 100%;
        box-sizing: border-box;
        overflow: hidden;
        padding: 2.4rem 2.15rem 1.65rem;
        text-align: center;
        background:
          radial-gradient(circle at top, rgba(245, 158, 11, 0.18), transparent 36%),
          #1f2a3d;
        border: 1px solid rgba(148, 163, 184, 0.22);
        border-radius: 20px;
        color: #f8fafc;
      }

      .dialog-icon {
        width: 68px;
        height: 68px;
        margin: 0 auto 1rem;
        border-radius: 20px;
        display: grid;
        place-items: center;
        background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
        box-shadow: 0 16px 34px rgba(245, 158, 11, 0.24);
      }

      .dialog-icon mat-icon {
        width: 34px;
        height: 34px;
        font-size: 34px;
        color: #111827;
      }

      h2[mat-dialog-title] {
        margin: 0 0 0.65rem;
        padding: 0;
        font-size: 1.25rem;
        font-weight: 800;
        line-height: 1.25;
        color: #f8fafc;
      }

      mat-dialog-content {
        padding: 0;
        margin: 0;
        color: #cbd5e1;
      }

      mat-dialog-content p {
        margin: 0;
        font-size: 0.93rem;
        line-height: 1.6;
      }

      mat-dialog-actions {
        padding: 1.35rem 0 0;
        margin: 0;
      }

      button {
        min-width: 132px;
        min-height: 42px;
        border-radius: 10px;
        font-weight: 700;
      }

      @media (max-width: 480px) {
        .subscriber-dialog {
          padding: 2rem 1.35rem 1.35rem;
        }
      }
    `,
  ],
})
export class SubscriberAccessDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<SubscriberAccessDialogComponent>);
  readonly data = inject<SubscriberAccessDialogData>(MAT_DIALOG_DATA);

  close(): void {
    this.dialogRef.close();
  }
}
