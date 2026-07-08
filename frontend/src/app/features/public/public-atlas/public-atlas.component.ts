import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal, DestroyRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatChipsModule } from '@angular/material/chips';
import { MatTabsModule } from '@angular/material/tabs';
import { TranslateModule } from '@ngx-translate/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { ArticulosService, Articulo } from '@core/services/articulos.service';
import { ReportesService, Reporte } from '@core/services/reportes.service';
import { AuthService } from '@core/services/auth.service';
import { PermisosService } from '@core/services/permisos.service';

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
    TranslateModule,
  ],
  templateUrl: './public-atlas.component.html',
  styleUrl: './public-atlas.component.scss',
})
export class PublicAtlasComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly articulosService = inject(ArticulosService);
  private readonly reportesService = inject(ReportesService);
  private readonly authService = inject(AuthService);
  private readonly permisosService = inject(PermisosService);

  searchTerm = signal('');
  selectedCategory = signal<string>('TODAS');

  articulos = signal<Articulo[]>([]);
  reportes = signal<Reporte[]>([]);

  // Computed properties for permissions
  canCreate = computed(() => {
    const user = this.authService.user();
    if (!user) return false;
    return this.permisosService.puedeEditar(user.id, 'atlas');
  });

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    // Cargar todos los artículos (sin filtrar por departamento)
    this.articulosService.getAll()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((data) => this.articulos.set(data));

    // Cargar todos los reportes (sin filtrar por departamento)
    this.reportesService.getAll()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((data) => this.reportes.set(data));
  }

  canEdit(item: Articulo | Reporte): boolean {
    const user = this.authService.user();
    if (!user) return false;
    return this.permisosService.puedeEditar(user.id, 'atlas');
  }

  canDelete(item: Articulo | Reporte): boolean {
    const user = this.authService.user();
    if (!user) return false;
    return this.permisosService.esAdmin(user.id, 'atlas');
  }

  // ── Artículos (Publicaciones) ──

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

  // ── Reportes (PowerBI) ──

  reportesAgrupados = computed(() => {
    return this.reportesService.agruparPorCategoria(this.reportes());
  });

  // ── Interfaz ──

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
      case 'Economía': return 'trending_up';
      case 'Vitalidad Ecológica': return 'eco';
      case 'Gobernanza': return 'groups';
      case 'Cultura': return 'theater_comedy';
      default: return 'menu_book';
    }
  }

  getCategoryColor(cat: string): string {
    switch (cat) {
      case 'Economía': return '#C8102E'; // ULEAM Red
      case 'Vitalidad Ecológica': return '#10B981'; // Green
      case 'Gobernanza': return '#6366F1'; // Indigo
      case 'Cultura': return '#F59E0B'; // Amber
      default: return '#8B5CF6'; // Purple
    }
  }

  tieneAcceso(item: Articulo | Reporte): boolean {
    const vis = item.visibilidad || 'publico';
    if (vis === 'publico') return true;

    const user = this.authService.user();
    if (!user) return false;

    return ['ADMIN', 'EDITOR', 'SUBSCRIBER'].includes(user.rol);
  }

  sugerirSuscripcion(): void {
    alert('Esta publicación es exclusiva para suscriptores. Inicia sesión o suscríbete para acceder al contenido.');
  }
}
