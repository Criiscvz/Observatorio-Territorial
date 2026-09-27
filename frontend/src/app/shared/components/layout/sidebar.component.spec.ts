import { TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import { AuthService } from '@core/services/auth.service';
import { DepartamentoService } from '@core/services/departamento.service';
import { AtlasCategoriaService } from '@core/services/atlas-categoria.service';
import { SidebarComponent } from './sidebar.component';

describe('Atlas sidebar categories', () => {
  function setup(admin = true) {
    const changed = new Subject<void>();
    const service = { list: vi.fn(() => of([{ id: 'salud', nombre: 'Salud', descripcion: null }])), onCategoriasChanged$: changed };
    TestBed.configureTestingModule({ providers: [
      { provide: AuthService, useValue: { isAdmin: () => admin, isEditor: () => !admin } },
      { provide: DepartamentoService, useValue: { getAll: () => of([]), onDepartamentosChanged$: new Subject<void>() } },
      { provide: AtlasCategoriaService, useValue: service },
    ] });
    const component = TestBed.runInInjectionContext(() => new SidebarComponent());
    component.ngOnInit();
    return { component, service, changed };
  }
  it('reloads the admin category list after changes', () => {
    const { component, service, changed } = setup();
    expect(component.atlasCategorias()[0].nombre).toBe('Salud');
    service.list.mockReturnValue(of([{ id: 'salud', nombre: 'Salud comunitaria', descripcion: null }]));
    changed.next();
    expect(component.atlasCategorias()[0].nombre).toBe('Salud comunitaria');
    service.list.mockReturnValue(of([]));
    changed.next();
    expect(component.atlasCategorias()).toEqual([]);
  });
  it('recovers after a failed request and does not stop listening to changes', () => {
    const { component, service, changed } = setup();
    service.list.mockReturnValue(throwError(() => new Error('offline')));
    changed.next();
    expect(component.atlasError()).toBe(true);
    service.list.mockReturnValue(of([]));
    changed.next();
    expect(component.atlasError()).toBe(false);
    expect(component.atlasLoading()).toBe(false);
  });
  it('does not request administrative categories for editors', () => {
    const { service } = setup(false);
    expect(service.list).not.toHaveBeenCalled();
  });
});
