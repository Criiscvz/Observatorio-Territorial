import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { RouterLink } from '@angular/router';
import { Departamento } from '@core/models';
import { DepartamentoService } from '@core/services/departamento.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import {
  ConfirmDialogComponent,
  ConfirmDialogData,
} from '@shared/components/confirm-dialog/confirm-dialog.component';
import { tap } from 'rxjs';

@Component({
  selector: 'app-departamento-list',
  standalone: true,
  imports: [
    RouterLink,
    TranslateModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './departamento-list.component.html',
  styleUrl: './departamento-list.component.scss',
})
export class DepartamentoListComponent implements OnInit {
  private readonly service = inject(DepartamentoService);
  private readonly dialog = inject(MatDialog);
  private readonly snackbar = inject(MatSnackBar);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);
  readonly departamentos = signal<Departamento[]>([]);
  readonly search = signal('');
  readonly loading = signal(false);
  readonly deleting = signal(false);
  readonly error = signal('');
  readonly filteredDepartamentos = computed(() => {
    const normalize = (value: string) =>
      value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLocaleLowerCase('es')
        .trim();
    const query = normalize(this.search());
    return this.departamentos().filter((item) =>
      normalize(`${item.nombre} ${item.codigo_interno} ${item.descripcion ?? ''}`).includes(query),
    );
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    if (this.loading()) return;
    this.loading.set(true);
    this.error.set('');
    this.service
      .getAll()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (items) => {
          this.departamentos.set(items ?? []);
          this.loading.set(false);
        },
        error: (error) => {
          this.error.set(this.message(error));
          this.loading.set(false);
        },
      });
  }

  datasetCount(item: Departamento): number | undefined {
    return item.datasets_count ?? item.datasets?.length;
  }

  remove(item: Departamento): void {
    if (this.deleting() || this.loading()) return;
    this.deleting.set(true);
    const data: ConfirmDialogData = {
      title: this.translate.instant('departamentos.management.deleteTitle'),
      message: this.translate.instant('departamentos.management.deleteMessage', {
        name: item.nombre,
      }),
      confirmText: this.translate.instant('departamentos.management.deleteConfirm'),
      cancelText: this.translate.instant('common.buttons.cancel'),
      processingText: this.translate.instant('common.messages.deleting'),
      confirmColor: 'warn',
      icon: 'delete_forever',
      confirmAction: () =>
        this.service.delete(item.id).pipe(
          tap(() => {
            this.load();
            this.snackbar.open(
              this.translate.instant('departamentos.management.deleted'),
              this.translate.instant('common.buttons.close'),
              { duration: 4000 },
            );
          }),
        ),
      onError: (error) => {
        const message = this.message(error);
        this.error.set(message);
        this.snackbar.open(message, this.translate.instant('common.buttons.close'), {
          duration: 7000,
        });
      },
    };
    this.dialog
      .open(ConfirmDialogComponent, {
        width: 'min(540px, calc(100vw - 32px))',
        maxWidth: 'calc(100vw - 32px)',
        panelClass: 'app-confirm-dialog-panel',
        backdropClass: 'app-confirm-dialog-backdrop',
        data,
      })
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.deleting.set(false));
  }

  private message(error: unknown): string {
    const apiError = error as { status?: number; error?: { message?: unknown } } | null;
    if (apiError?.status === 401 || apiError?.status === 403) {
      return this.translate.instant('common.messages.permissionDenied');
    }
    return typeof apiError?.error?.message === 'string' && apiError.error.message
      ? apiError.error.message
      : this.translate.instant('departamentos.management.operationError');
  }
}
