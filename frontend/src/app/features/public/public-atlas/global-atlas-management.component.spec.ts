import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { BehaviorSubject, of } from 'rxjs';
import { AtlasCategoriaService } from '@core/services/atlas-categoria.service';
import { PublicacionService } from '@core/services/publicacion.service';
import { GlobalAtlasManagementComponent } from './global-atlas-management.component';

describe('Atlas category files', () => {
  it('opens the selected category, keeps uncategorized files separate and responds to navigation', () => {
    const params = new BehaviorSubject(convertToParamMap({ categoria: 'salud' }));
    TestBed.configureTestingModule({ providers: [
      { provide: ActivatedRoute, useValue: { queryParamMap: params } },
      { provide: Router, useValue: { navigate: vi.fn() } },
      { provide: MatDialog, useValue: {} },
      { provide: MatSnackBar, useValue: { open: vi.fn() } },
      { provide: AtlasCategoriaService, useValue: { list: () => of([{ id: 'salud', nombre: 'Salud' }]) } },
      { provide: PublicacionService, useValue: { getGlobalAtlas: () => of([
        { id: 'one', titulo: 'Salud 2026', atlas_categoria_id: 'salud' },
        { id: 'two', titulo: 'Ambiente', atlas_categoria_id: 'ambiente' },
        { id: 'old', titulo: 'Anterior', atlas_categoria_id: null },
      ]) } },
    ] });
    const component = TestBed.runInInjectionContext(() => new GlobalAtlasManagementComponent());
    component.ngOnInit();
    expect(component.selectedCategoryName()).toBe('Salud');
    expect(component.filteredAtlas().map(item => item.id)).toEqual(['one']);
    component.searchTerm.set('ausente');
    expect(component.filteredAtlas()).toEqual([]);
    component.searchTerm.set('');
    params.next(convertToParamMap({ categoria: 'sin-categoria' }));
    expect(component.filteredAtlas().map(item => item.id)).toEqual(['old']);
    params.next(convertToParamMap({ categoria: '' }));
    expect(component.filteredAtlas()).toHaveLength(3);
  });
});
