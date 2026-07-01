import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal, DestroyRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { TranslateModule } from '@ngx-translate/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { AtlasService, PublicacionAtlas } from '@core/services/atlas.service';
import { AuthService } from '@core/services/auth.service';
import { PermisosService } from '@core/services/permisos.service';
import { ConfirmDialogComponent } from '@shared/components/confirm-dialog/confirm-dialog.component';
import { AtlasFormComponent } from './atlas-form.component';

@Component({
  selector: 'app-public-atlas',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatChipsModule,
    MatDialogModule,
    MatSnackBarModule,
    TranslateModule,
  ],
  templateUrl: './public-atlas.component.html',
  styleUrl: './public-atlas.component.scss',
})
export class PublicAtlasComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly atlasService = inject(AtlasService);
  private readonly authService = inject(AuthService);
  private readonly permisosService = inject(PermisosService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  searchTerm = signal('');
  selectedCategory = signal<string>('TODAS');
  publicaciones = signal<PublicacionAtlas[]>([]);

  // Computed properties for permissions
  canCreate = computed(() => {
    const user = this.authService.user();
    if (!user) return false;
    return this.permisosService.hasUserPermission(user.id, user.rol, 'create');
  });

  ngOnInit(): void {
    this.loadPublications();
  }

  loadPublications(): void {
    this.atlasService.getPublications()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((data) => {
        this.publicaciones.set(data);
      });
  }

  canEdit(pub: PublicacionAtlas): boolean {
    const user = this.authService.user();
    if (!user) return false;
    const isOwner = pub.creado_por_id === user.id;
    return this.permisosService.hasUserPermission(user.id, user.rol, 'edit', isOwner);
  }

  canDelete(pub: PublicacionAtlas): boolean {
    const user = this.authService.user();
    if (!user) return false;
    const isOwner = pub.creado_por_id === user.id;
    return this.permisosService.hasUserPermission(user.id, user.rol, 'delete', isOwner);
  }

  openCreateDialog(): void {
    const dialogRef = this.dialog.open(AtlasFormComponent, {
      width: '550px',
      data: null,
    });

    dialogRef.afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => {
        if (result) {
          const userId = this.authService.user()?.id || 1;
          this.atlasService.createPublication(result, userId).subscribe(() => {
            this.loadPublications();
            this.snackBar.open('Publicación agregada con éxito', 'Cerrar', { duration: 3000 });
          });
        }
      });
  }

  openEditDialog(pub: PublicacionAtlas): void {
    const dialogRef = this.dialog.open(AtlasFormComponent, {
      width: '550px',
      data: pub,
    });

    dialogRef.afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => {
        if (result) {
          this.atlasService.updatePublication(pub.id, result).subscribe(() => {
            this.loadPublications();
            this.snackBar.open('Publicación actualizada con éxito', 'Cerrar', { duration: 3000 });
          });
        }
      });
  }

  deletePublication(pub: PublicacionAtlas): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Confirmar Eliminación',
        message: `¿Estás seguro de que deseas eliminar la publicación "${pub.titulo}"?`,
        confirmText: 'Eliminar',
        cancelText: 'Cancelar',
        confirmColor: 'warn',
      },
    });

    dialogRef.afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((confirmed) => {
        if (confirmed) {
          this.atlasService.deletePublication(pub.id).subscribe(() => {
            this.loadPublications();
            this.snackBar.open('Publicación eliminada con éxito', 'Cerrar', { duration: 3000 });
          });
        }
      });
  }

  // Categorías únicas
  categorias = computed<string[]>(() => {
    const list = this.publicaciones().map((p) => p.categoria);
    return ['TODAS', ...Array.from(new Set(list))];
  });

  // Filtrado de publicaciones
  filteredPublicaciones = computed<PublicacionAtlas[]>(() => {
    const term = this.searchTerm().toLowerCase().trim();
    const cat = this.selectedCategory();
    let list = this.publicaciones();

    if (cat !== 'TODAS') {
      list = list.filter((p) => p.categoria === cat);
    }

    if (term) {
      list = list.filter(
        (p) =>
          p.titulo.toLowerCase().includes(term) ||
          p.descripcion.toLowerCase().includes(term) ||
          p.autor.toLowerCase().includes(term) ||
          p.categoria.toLowerCase().includes(term),
      );
    }

    return list;
  });

  onSearch(term: string): void {
    this.searchTerm.set(term);
  }

  clearSearch(): void {
    this.searchTerm.set('');
  }

  selectCategory(cat: string): void {
    this.selectedCategory.set(cat);
  }

  getCategoryIcon(cat: string): string {
    switch (cat) {
      case 'Economía':
        return 'trending_up';
      case 'Vitalidad Ecológica':
        return 'eco';
      case 'Gobernanza':
        return 'groups';
      case 'Cultura':
        return 'theater_comedy';
      default:
        return 'menu_book';
    }
  }

  getCategoryColor(cat: string): string {
    switch (cat) {
      case 'Economía':
        return '#C8102E'; // ULEAM Red
      case 'Vitalidad Ecológica':
        return '#10B981'; // Green
      case 'Gobernanza':
        return '#6366F1'; // Indigo
      case 'Cultura':
        return '#F59E0B'; // Amber
      default:
        return '#8B5CF6'; // Purple
    }
  }
}
