import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { tap } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ObservatorioPublicacion } from '@core/models/publicacion/publicacion.interface';
import { PublicacionService } from '@core/services/publicacion.service';
import { AtlasCategoria, AtlasCategoriaService } from '@core/services/atlas-categoria.service';
import {
  ConfirmDialogComponent,
  ConfirmDialogData,
} from '@shared/components/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-global-atlas-management',
  standalone: true,
  imports: [
    MatSelectModule,
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
  private readonly categoriaService = inject(AtlasCategoriaService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly categorias = signal<AtlasCategoria[]>([]);
  readonly selectedCategory = signal('');
  readonly selectedCategoryName = computed(() => this.categorias().find(c => c.id === this.selectedCategory())?.nombre);
  readonly loadError = signal('');
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
    const category = this.selectedCategory();
    const items = this.atlas().filter(item => !category || (category === 'sin-categoria' ? !item.atlas_categoria_id : item.atlas_categoria_id === category));
    if (!query) return items;

    return items.filter((item) =>
      [item.codigo, item.titulo, item.fuente, item.estado, item.creador?.name]
        .filter(Boolean)
        .some((value) => this.normalize(String(value)).includes(query)),
    );
  });

  ngOnInit(): void {
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => this.selectedCategory.set(params.get('categoria') ?? ''));
    this.categoriaService.list().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: items => this.categorias.set(items),
      error: () => this.snackBar.open('No se pudieron cargar las categorías. Recarga la página.', 'Cerrar', { duration: 5000 }),
    });
    this.loadAtlas();
  }

  selectCategory(id: string): void {
    this.router.navigate([], { relativeTo: this.route, queryParams: { categoria: id || null }, queryParamsHandling: 'merge' });
  }

  loadAtlas(): void {
    this.loadError.set('');
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
          this.loadError.set('No se pudieron cargar los archivos de Atlas.');
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
    if (this.deletingId()) return;
    this.deletingId.set(item.id);
    const data: ConfirmDialogData = {
      title: 'Eliminar Atlas',
      message:
        `¿Eliminar «${item.titulo}» (${item.codigo || 'Atlas'})? Se eliminará permanentemente su registro y el PDF almacenado en la plataforma. Esta acción no se puede deshacer.` +
        (item.sharepoint_url ? ' El archivo original de SharePoint no se eliminará.' : ''),
      cancelText: 'Cancelar',
      confirmText: 'Eliminar definitivamente',
      confirmColor: 'warn',
      icon: 'delete_forever',
      confirmAction: () => this.publicacionService.delete(item.id).pipe(tap(() => {
        this.atlas.update(items => items.filter(candidate => candidate.id !== item.id));
        this.snackBar.open('Atlas eliminado correctamente.', 'Cerrar', { duration: 4000 });
      })),
      onError: (error: any) => this.snackBar.open(error?.error?.message || 'No se pudo eliminar el Atlas. Inténtalo de nuevo.', 'Cerrar', { duration: 5000 }),
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
      .subscribe(() => this.deletingId.set(null));
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

  private normalize(value: string): string {
    return value
      .trim()
      .toLocaleLowerCase('es')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }
}
