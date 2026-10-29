import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { Subject, of, throwError } from 'rxjs';
import { AuthService } from '@core/services/auth.service';
import { DepartamentoService } from '@core/services/departamento.service';
import { AtlasCategoriaService } from '@core/services/atlas-categoria.service';
import { SidebarComponent } from './sidebar.component';

describe('Atlas sidebar categories', () => {
  function setup(admin = true) {
    const changed = new Subject<void>();
    const service = {
      list: vi.fn(() => of([{ id: 'salud', nombre: 'Salud', descripcion: null }])),
      onCategoriasChanged$: changed,
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { isAdmin: () => admin, isEditor: () => !admin } },
        {
          provide: DepartamentoService,
          useValue: { getAll: () => of([]), onDepartamentosChanged$: new Subject<void>() },
        },
        { provide: AtlasCategoriaService, useValue: service },
      ],
    });
    const component = TestBed.runInInjectionContext(() => new SidebarComponent());
    component.ngOnInit();
    return { component, service, changed };
  }
  it('reloads the admin category list after changes', () => {
    const { component, service, changed } = setup();
    expect(component.atlasCategorias()[0].nombre).toBe('Salud');
    service.list.mockReturnValue(
      of([{ id: 'salud', nombre: 'Salud comunitaria', descripcion: null }]),
    );
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
  it('filters observatories by name without accents and keeps their original colors and data', () => {
    const { component } = setup();
    const items = [
      {
        id: 'eco',
        nombre: 'Vitalidad Ecológica',
        codigo_interno: 'ECO',
        publico: true,
        created_at: '',
        updated_at: '',
      },
      {
        id: 'social',
        nombre: 'Economía del Cuidado',
        codigo_interno: 'SOC',
        publico: false,
        created_at: '',
        updated_at: '',
      },
    ];
    component.departamentos.set(items);
    const color = component.getDeptoColor(items[1]);
    component.observatorioSearch.set('  ECONOMIA ');
    expect(component.filteredDepartamentos()).toEqual([items[1]]);
    expect(component.getDeptoColor(items[1])).toBe(color);
    component.observatorioSearch.set('no coincide');
    expect(component.filteredDepartamentos()).toEqual([]);
    component.observatorioSearch.set('');
    expect(component.filteredDepartamentos()).toEqual(items);
    expect(component.departamentos()).toEqual(items);
  });
  it('renders asynchronously loaded category icons and updates after category changes', async () => {
    const response = new Subject<any>();
    const changed = new Subject<void>();
    TestBed.configureTestingModule({
      imports: [SidebarComponent],
      providers: [
        provideRouter([]),
        provideTranslateService({ fallbackLang: 'es' }),
        { provide: AuthService, useValue: { isAdmin: () => true, isEditor: () => false } },
        {
          provide: DepartamentoService,
          useValue: { getAll: () => of([]), onDepartamentosChanged$: new Subject<void>() },
        },
        {
          provide: AtlasCategoriaService,
          useValue: { list: () => response, onCategoriasChanged$: changed },
        },
      ],
    });
    const fixture = TestBed.createComponent(SidebarComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Cargando categorías');
    response.next([{ id: 'salud', nombre: 'Salud', descripcion: null }]);
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.atlas-category-search')).not.toBeNull();
    const gear = fixture.nativeElement.querySelector('a[href="/admin/departamentos"]');
    expect(gear?.querySelector('mat-icon')?.textContent).toBe('settings');
    expect(fixture.nativeElement.querySelector('.observatorio-search')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.deptos-list .atlas-category-search')).toBeNull();
    expect(fixture.nativeElement.querySelector('.atlas-nav-actions a')?.textContent).toContain(
      'Todos los archivos',
    );
    expect(fixture.nativeElement.querySelector('.atlas-category-icon mat-icon').textContent).toBe(
      'health_and_safety',
    );
    changed.next();
    response.next([{ id: 'ambiente', nombre: 'Ambiente', descripcion: null }]);
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.atlas-category-icon mat-icon').textContent).toBe(
      'eco',
    );
    changed.next();
    response.next([
      { id: 'ambiente', nombre: 'Ambiente', descripcion: null, icono: 'science', publico: false },
    ]);
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.atlas-category-icon mat-icon').textContent).toBe(
      'science',
    );
    fixture.destroy();
  });
  it('keeps administrative management links hidden for editors while retaining observatory search', async () => {
    TestBed.configureTestingModule({
      imports: [SidebarComponent],
      providers: [
        provideRouter([]),
        provideTranslateService({ fallbackLang: 'es' }),
        { provide: AuthService, useValue: { isAdmin: () => false, isEditor: () => true } },
        {
          provide: DepartamentoService,
          useValue: { getAll: () => of([]), onDepartamentosChanged$: new Subject<void>() },
        },
        {
          provide: AtlasCategoriaService,
          useValue: { list: vi.fn(), onCategoriasChanged$: new Subject<void>() },
        },
      ],
    });
    const fixture = TestBed.createComponent(SidebarComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('a[href="/admin/departamentos"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('a[href="/admin/departamentos/nuevo"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('.observatorio-search')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.atlas-nav-actions')).toBeNull();
    fixture.destroy();
  });
});
