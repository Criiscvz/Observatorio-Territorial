import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal, DestroyRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatChipsModule } from '@angular/material/chips';
import { MatTabsModule } from '@angular/material/tabs';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { Articulo } from '@core/services/articulos.service';
import { PublicacionService } from '@core/services/publicacion.service';
import { AuthService } from '@core/services/auth.service';
import { PermisosService } from '@core/services/permisos.service';
import { DepartamentoService } from '@core/services/departamento.service';
import { Departamento } from '@core/models';
import { SubscriberAccessDialogComponent } from '@shared/components/subscriber-access-dialog';
import { environment } from '../../../../environments/environment';
import { SharePointAtlasImportDialogComponent } from './sharepoint-atlas-import-dialog.component';

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
    MatTabsModule,
    MatDialogModule,
    MatSnackBarModule,
    RouterLink,
    TranslateModule,
  ],
  templateUrl: './public-atlas.component.html',
  styleUrl: './public-atlas.component.scss',
})
export class PublicAtlasComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly publicacionService = inject(PublicacionService);
  private readonly authService = inject(AuthService);
  private readonly permisosService = inject(PermisosService);
  private readonly departamentoService = inject(DepartamentoService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  searchTerm = signal('');
  selectedCategory = signal<string>('TODAS');

  articulos = signal<Articulo[]>([]);
  departamentos = signal<Departamento[]>([]);
  readonly showEditorPanelButton = computed(() => this.authService.isEditor());
  readonly canImportFromSharePoint = computed(() => this.authService.isAdmin());

  // Computed properties for permissions
  canCreate = computed(() => {
    const user = this.authService.user();
    if (!user) return false;
    return this.permisosService.puedeEditar(user.id, 'atlas');
  });

  ngOnInit(): void {
    this.loadData();
    this.loadDepartamentos();
  }

  loadData(): void {
    this.publicacionService.getPublicAtlas()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((data) =>
        this.articulos.set(
          data.map((item) => ({
            id: item.id,
            titulo: item.titulo,
            descripcion: item.descripcion,
            autor: item.autores,
            fuente: item.fuente,
            enlace: this.buildDownloadUrl(item.download_url),
            download_url: item.download_url,
            sharepoint_url: item.sharepoint_url,
            fecha_publicacion: item.fecha_publicacion,
            departamento_id: item.departamento_id,
            visibilidad: item.solo_suscriptores ? 'suscriptor' : 'publico',
            bloqueado: item.bloqueado,
            categoria: {
              id: 'atlas',
              nombre: 'Atlas ULEAM',
              codigo: 'ATLAS',
              color: '#6366F1',
              icono: 'picture_as_pdf',
            },
            created_at: item.created_at,
            updated_at: item.updated_at,
          })),
        ),
      );

  }

  loadDepartamentos(): void {
    this.departamentoService
      .getPublicos()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (departamentos) => this.departamentos.set(departamentos ?? []),
        error: () => this.departamentos.set([]),
      });
  }

  importarDesdeSharePoint(): void {
    const dialogRef = this.dialog.open(SharePointAtlasImportDialogComponent, {
      width: 'min(96vw, 980px)',
      maxWidth: '96vw',
      autoFocus: false,
      restoreFocus: false,
      data: {
        departamentos: this.departamentos(),
      },
    });

    dialogRef.afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => {
        if (!result) return;
        const totals = result.totals;
        const message = `${totals.imported} importados, ${totals.duplicates} duplicados, ${totals.rejected} rechazados, ${totals.errors} errores`;
        this.snackBar.open(message, 'Cerrar', { duration: 7000 });
        this.loadData();
      });
  }

  private buildDownloadUrl(downloadUrl?: string | null): string | null {
    if (!downloadUrl) return null;
    if (/^https?:\/\//i.test(downloadUrl)) return downloadUrl;
    return `${environment.apiUrl}${downloadUrl.replace(/^\/api/, '')}`;
  }

  canEdit(item: Articulo): boolean {
    const user = this.authService.user();
    if (!user) return false;
    return this.permisosService.puedeEditar(user.id, 'atlas');
  }

  canDelete(item: Articulo): boolean {
    const user = this.authService.user();
    if (!user) return false;
    return this.permisosService.esAdmin(user.id, 'atlas');
  }

  // Artículos (publicaciones)

  categoriasArticulos = computed<string[]>(() => {
    const list = this.articulos()
      .map((a) => a.categoria?.nombre)
      .filter((n): n is string => !!n);
    return ['TODAS', ...Array.from(new Set(list))];
  });

  filteredArticulos = computed<Articulo[]>(() => {
    const term = this.searchTerm().toLowerCase().trim();
    const cat = this.selectedCategory();
    let list = this.articulos();

    if (cat !== 'TODAS') {
      list = list.filter((a) => a.categoria?.nombre === cat);
    }

    if (term) {
      list = list.filter(
        (a) =>
          a.titulo.toLowerCase().includes(term) ||
          (a.descripcion?.toLowerCase() || '').includes(term) ||
          (a.autor?.toLowerCase() || '').includes(term) ||
          (a.categoria?.nombre?.toLowerCase() || '').includes(term),
      );
    }

    return list;
  });

  // Reportes (PDF)

  // Interfaz

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
      case 'Atlas ULEAM': return 'map';
      case 'Economía': return 'trending_up';
      case 'Vitalidad Ecológica': return 'eco';
      case 'Gobernanza': return 'groups';
      case 'Cultura': return 'theater_comedy';
      default: return 'menu_book';
    }
  }

  getCategoryColor(cat: string): string {
    switch (cat) {
      case 'Atlas ULEAM': return '#6366F1';
      case 'Economía': return '#C8102E'; // ULEAM Red
      case 'Vitalidad Ecológica': return '#10B981'; // Green
      case 'Gobernanza': return '#6366F1'; // Indigo
      case 'Cultura': return '#F59E0B'; // Amber
      default: return '#8B5CF6'; // Purple
    }
  }

  tieneAcceso(item: Articulo): boolean {
    if (item.bloqueado === true) return false;

    const vis = item.visibilidad || 'publico';
    if (vis === 'publico') return true;

    if (!this.authService.isAuthenticated()) return false;

    const user = this.authService.user();
    if (!user) return false;

    const role = String(user.rol ?? '').toUpperCase();
    return ['ADMIN', 'EDITOR', 'SUBSCRIBER', 'SUSCRIPTOR', 'SUBSCRIPTOR'].includes(role);
  }

  sugerirSuscripcion(): void {
    this.dialog.open(SubscriberAccessDialogComponent, {
      width: 'min(92vw, 460px)',
      maxWidth: '92vw',
      panelClass: 'subscriber-access-dialog-panel',
      backdropClass: 'subscriber-access-dialog-backdrop',
      autoFocus: false,
      restoreFocus: false,
      data: {
        title: 'Contenido exclusivo para suscriptores',
        message:
          'Este contenido está disponible exclusivamente para usuarios suscriptores. Inicie sesión con una cuenta suscriptora o suscríbase para obtener acceso.',
        icon: 'lock',
        closeText: 'Entendido',
      },
    });
  }

  visualizarPdf(item: Articulo): void {
    this.publicacionService
      .openPdf({
        download_url: item.download_url ?? null,
        sharepoint_url: item.sharepoint_url ?? null,
      })
      .subscribe((opened) => {
        if (!opened) {
          this.snackBar.open('No hay PDF disponible para esta publicación.', 'Cerrar', {
            duration: 3500,
          });
        }
      });
  }
}



