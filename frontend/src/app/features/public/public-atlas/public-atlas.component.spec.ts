import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { of, throwError } from 'rxjs';
import { AtlasCategoriaService } from '@core/services/atlas-categoria.service';
import { PublicacionService } from '@core/services/publicacion.service';
import { AuthService } from '@core/services/auth.service';
import { PermisosService } from '@core/services/permisos.service';
import { DepartamentoService } from '@core/services/departamento.service';
import { PublicAtlasComponent } from './public-atlas.component';

describe('Public Atlas categories', () => {
  let component: PublicAtlasComponent;
  let categories: any;
  let publications: any;
  beforeEach(() => {
    categories = { list: vi.fn(() => of([
      { id: 'salud', nombre: 'Salud', descripcion: 'Descripción' },
      { id: 'ambiente', nombre: 'Ambiente', descripcion: null },
    ])) };
    publications = { getPublicAtlas: vi.fn(() => of([
      { id: 'one', titulo: 'Atlas', atlas_categoria: { id: 'salud', nombre: 'Salud' } },
      { id: 'old', titulo: 'Atlas existente', atlas_categoria: null },
    ])) };
    TestBed.configureTestingModule({ providers: [
      { provide: AtlasCategoriaService, useValue: categories },
      { provide: PublicacionService, useValue: publications },
      { provide: AuthService, useValue: { isAdmin: () => false, isEditor: () => false } },
      { provide: PermisosService, useValue: {} },
      { provide: DepartamentoService, useValue: { getPublicos: () => of([]) } },
      { provide: MatDialog, useValue: {} },
      { provide: MatSnackBar, useValue: {} },
    ] });
    component = TestBed.runInInjectionContext(() => new PublicAtlasComponent());
    component.ngOnInit();
  });
  it('lists empty categories and filters by persistent id without categorizing old content', () => {
    expect(component.categorias()).toHaveLength(2);
    expect(component.filteredArticulos()).toHaveLength(2);
    component.selectCategory('salud');
    expect(component.filteredArticulos().map(item => item.id)).toEqual(['one']);
    expect(component.selectedDescription()).toBe('Descripción');
    component.selectCategory('ambiente');
    expect(component.filteredArticulos()).toEqual([]);
  });
  it('refreshes category changes from the API', () => {
    categories.list.mockReturnValue(of([{ id: 'new', nombre: 'Nueva', descripcion: null }]));
    component.selectCategory('salud');
    component.loadData();
    expect(component.categorias()[0].nombre).toBe('Nueva');
    expect(component.selectedCategory()).toBe('TODAS');
    expect(categories.list).toHaveBeenLastCalledWith(true);
  });
  it('shows counts including empty categories and opens uncategorized content without losing it', () => {
    expect(component.categoryCards().map(card => [card.nombre, card.total])).toEqual([['Salud', 1], ['Ambiente', 0]]);
    expect(component.uncategorizedCount()).toBe(1);
    component.selectCategory('SIN_CATEGORIA');
    expect(component.selectedCategoryName()).toBe('Sin categoría');
    expect(component.filteredArticulos().map(item => item.id)).toEqual(['old']);
    component.searchTerm.set('no coincide');
    component.selectCategory('TODAS');
    expect(component.searchTerm()).toBe('');
    expect(component.selectedCategory()).toBe('TODAS');
  });
  it('distinguishes API failure from an empty category', () => {
    publications.getPublicAtlas.mockReturnValue(throwError(() => new Error('offline')));
    component.loadData();
    expect(component.loading()).toBe(false);
    expect(component.loadError()).toContain('No se pudo cargar');
    expect(component.articulos()).toEqual([]);
  });
  it('searches names and descriptions without accents and combines the publication filter', () => {
    component.categorySearch.set('DESCRIPCION');
    expect(component.filteredCategoryCards().map(item => item.id)).toEqual(['salud']);
    expect(component.showUncategorized()).toBe(false);
    component.categorySearch.set('');
    component.onlyWithPublications.set(true);
    expect(component.filteredCategoryCards().map(item => item.id)).toEqual(['salud']);
    expect(component.showUncategorized()).toBe(true);
    component.categorySearch.set('sin categoria');
    expect(component.filteredCategoryCards()).toEqual([]);
    expect(component.showUncategorized()).toBe(true);
    component.categorySearch.set('inexistente');
    expect(component.showUncategorized()).toBe(false);
  });
});
