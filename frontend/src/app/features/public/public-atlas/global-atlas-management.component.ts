import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { RouterLink } from '@angular/router';
import { ObservatorioPublicacion } from '@core/models/publicacion/publicacion.interface';
import { PublicacionService } from '@core/services/publicacion.service';
import {
  ConfirmDialogComponent,
  ConfirmDialogData,
} from '@shared/components/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-global-atlas-management',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatMenuModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
  ],
  templateUrl: './global-atlas-management.component.html',
  styleUrl: './global-atlas-management.component.scss',
})
export class GlobalAtlasManagementComponent implements OnInit {
  private readonly publicacionService = inject(PublicacionService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  readonly atlas = signal<ObservatorioPublicacion[]>([]);
  readonly searchTerm = signal('');
  readonly loading = signal(true);
  readonly deletingId = signal<string | null>(null);

  readonly filteredAtlas = computed(() => {
    const query = this.normalize(this.searchTerm());
    if (!query) return this.atlas();

    return this.atlas().filter((item) =>
      [item.codigo, item.titulo, item.fuente, item.estado, item.creador?.name]
        .filter(Boolean)
        .some((value) => this.normalize(String(value)).includes(query)),
    );
  });

  ngOnInit(): void {
    this.loadAtlas();
  }

  loadAtlas(): void {
    this.loading.set(true);
    this.publicacionService
      .getGlobalAtlas()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (items) => {
          this.atlas.set(items);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.snackBar.open('No se pudo cargar la gestión de Atlas.', 'Cerrar', { duration: 4500 });
        },
      });
  }

  updateSearch(event: Event): void {
    this.searchTerm.set((event.target as HTMLInputElement).value);
  }

  openPdf(item: ObservatorioPublicacion): void {
    this.publicacionService
      .openPdf(item)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((opened) => {
        if (!opened) {
          this.snackBar.open('El PDF de este Atlas no está disponible.', 'Cerrar', { duration: 4000 });
        }
      });
  }

  confirmDelete(item: ObservatorioPublicacion): void {
    const data: ConfirmDialogData = {
      title: 'Eliminar Atlas',
      message:
        'Esta acción eliminará permanentemente el Atlas y su archivo asociado. No se puede deshacer.',
      cancelText: 'Cancelar',
      confirmText: 'Eliminar definitivamente',
      confirmColor: 'warn',
      icon: 'delete_forever',
    };

    this.dialog
      .open(ConfirmDialogComponent, {
        width: 'min(540px, calc(100vw - 32px))',
        maxWidth: 'calc(100vw - 32px)',
        panelClass: 'app-confirm-dialog-panel',
        backdropClass: 'app-confirm-dialog-backdrop',
        autoFocus: false,
        restoreFocus: false,
        data,
      })
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((confirmed) => {
        if (confirmed) this.deleteAtlas(item);
      });
  }

  statusLabel(status: string): string {
    return (
      {
        PUBLICACION: 'Publicación',
        EN_REVISION: 'En revisión',
        SUSPENDIDO: 'Suspendido',
        ARCHIVADO: 'Archivado',
      }[status] ?? status
    );
  }

  statusIcon(status: string): string {
    return (
      {
        PUBLICACION: 'visibility',
        EN_REVISION: 'pending_actions',
        SUSPENDIDO: 'pause_circle',
        ARCHIVADO: 'inventory_2',
      }[status] ?? 'info'
    );
  }

  private deleteAtlas(item: ObservatorioPublicacion): void {
    this.deletingId.set(item.id);
    this.publicacionService
      .delete(item.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.atlas.update((items) => items.filter((candidate) => candidate.id !== item.id));
          this.deletingId.set(null);
          this.snackBar.open('Atlas eliminado correctamente.', 'Cerrar', { duration: 4000 });
        },
        error: (error) => {
          this.deletingId.set(null);
          this.snackBar.open(error?.error?.message || 'No se pudo eliminar el Atlas.', 'Cerrar', {
            duration: 4500,
          });
        },
      });
  }

  private normalize(value: string): string {
    return value
      .trim()
      .toLocaleLowerCase('es')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }
}
