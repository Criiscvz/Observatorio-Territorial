import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { of, Subject, throwError } from 'rxjs';
import { AtlasCategoria, AtlasCategoriaService } from '@core/services/atlas-categoria.service';
import { ObservatorioPublicacion } from '@core/models/publicacion/publicacion.interface';
import { PublicacionService } from '@core/services/publicacion.service';
import { PublicationViewerService } from '../components/publication-viewer.service';
import { PublicAtlasComponent } from './public-atlas.component';

describe('Directorio público compacto de Atlas', () => {
  const category: AtlasCategoria = {id: 'salud', nombre: 'Salud', descripcion: 'Descripción territorial', publico: true, icono: 'home', publicacion_destacada_id: 'selected'};
  const publication = (extra: Partial<ObservatorioPublicacion> = {}): ObservatorioPublicacion => ({
    id: 'selected', tipo: 'ATLAS', estado: 'PUBLICACION', solo_suscriptores: false,
    titulo: 'Indicadores de atención médica', codigo: 'ATL-0010', fuente: 'ULEAM',
    fecha_publicacion: '2026-10-20', created_at: '2026-10-20', updated_at: '2026-10-21',
    link_url: 'https://app.powerbi.com/view?r=atlas-publico',
    atlas_categoria: {id: 'salud', nombre: 'Salud', descripcion: null},
    ...extra,
  });
  let fixture: ComponentFixture<PublicAtlasComponent>;
  let component: PublicAtlasComponent;
  let categories: {list: ReturnType<typeof vi.fn>};
  let publications: {getPublicAtlas: ReturnType<typeof vi.fn>};
  let viewer: {open: ReturnType<typeof vi.fn>};
  const element = () => fixture.nativeElement as HTMLElement;
  const rows = () => element().querySelectorAll('.directory-row');

  beforeEach(() => {
    categories = {list: vi.fn(() => of([category, ...Array.from({length: 6}, (_, n) => ({id: `empty-${n}`, nombre: `Categoría ${n}`, descripcion: null, publico: true}))]))};
    publications = {getPublicAtlas: vi.fn(() => of([publication()]))};
    viewer = {open: vi.fn()};
    TestBed.configureTestingModule({providers: [
      {provide: AtlasCategoriaService, useValue: categories},
      {provide: PublicacionService, useValue: publications},
      {provide: PublicationViewerService, useValue: viewer},
    ]});
    fixture = TestBed.createComponent(PublicAtlasComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('muestra cinco categorías por página, icono guardado y disponibilidad real con sus metadatos', () => {
    expect(categories.list).toHaveBeenCalledWith(true);
    expect(rows()).toHaveLength(5);
    expect(rows()[0].textContent).toContain('Indicadores de atención médica');
    expect(rows()[0].textContent).toContain('Atlas disponible');
    expect(rows()[0].textContent).toContain('21/10/2026');
    expect(rows()[0].textContent).toContain('Fuente: ULEAM');
    expect(rows()[0].querySelector('.category-icon')?.textContent).toContain('home');
    expect((rows()[1].querySelector('.view-atlas') as HTMLButtonElement).disabled).toBe(true);
    expect(element().textContent).not.toContain('Ver PDF');
    expect(element().textContent).not.toContain('Importar');
  });

  it('Ver Atlas abre el visor integrado con contexto Atlas y no abre pestañas ni descarga PDF', () => {
    const external = vi.spyOn(window, 'open').mockImplementation(() => null);
    (rows()[0].querySelector('.view-atlas') as HTMLButtonElement).click();
    expect(viewer.open).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      id: 'selected', title: 'Indicadores de atención médica', reportUrl: 'https://app.powerbi.com/view?r=atlas-publico',
      locked: false, download_url: null, sharepoint_url: null,
    }), 'Salud', 'report', 'atlas');
    expect(external).not.toHaveBeenCalled();
    external.mockRestore();
  });

  it('pagina sin exceder los límites y reinicia la página al buscar o filtrar', () => {
    component.changePage(1); fixture.detectChanges();
    expect(rows()).toHaveLength(2);
    expect(element().textContent).toContain('6–7 de 7 categorías');
    component.changePage(1); expect(component.currentPage()).toBe(1);
    const input = element().querySelector('input[type=search]') as HTMLInputElement;
    input.value = 'ATENCION MEDICA'; input.dispatchEvent(new Event('input')); fixture.detectChanges();
    expect(component.currentPage()).toBe(0); expect(rows()).toHaveLength(1);
    component.search(''); component.changePage(1); component.filterAvailable(true); fixture.detectChanges();
    expect(component.currentPage()).toBe(0); expect(rows()).toHaveLength(1);
    component.changePage(-1); expect(component.currentPage()).toBe(0);
  });

  it('distingue una búsqueda vacía de un directorio sin categorías', () => {
    component.search('inexistente'); fixture.detectChanges();
    expect(element().textContent).toContain('No encontramos categorías');
    expect(element().querySelector('.public-pagination')).toBeNull();
    component.categorias.set([]); fixture.detectChanges();
    expect(element().textContent).toContain('Aún no hay categorías públicas');
  });

  it('usa solo el registro seleccionado en su categoría, preservando fuera de la vista enlaces anteriores y PDF antiguos', () => {
    component.atlas.set([publication({id: 'previous', titulo: 'Anterior'}), publication(), publication({id: 'legacy', atlas_categoria: null, link_url: null, download_url: '/api/legacy.pdf'})]);
    expect(component.entries()[0].publication?.id).toBe('selected');
    component.categorias.set([{...category, publicacion_destacada_id: 'previous'}, {id: 'other', nombre: 'Otra', descripcion: null, publicacion_destacada_id: 'selected'}]);
    expect(component.entries()[0].publication?.id).toBe('previous');
    expect(component.entries()[1].available).toBe(false);
    component.categorias.set([{...category, publicacion_destacada_id: null}]);
    expect(component.entries()[0].publication).toBeNull();
  });

  it.each([
    {link_url: 'javascript:alert(1)'}, {link_url: 'https://example.test/atlas'},
    {link_url: 'https://app.powerbi.com.evil.test/view?r=x'}, {link_url: null},
    {bloqueado: true}, {solo_suscriptores: true},
  ])('no integra enlaces incompatibles ni contenido restringido: %j', extra => {
    component.atlas.set([publication(extra)]); fixture.detectChanges();
    expect(component.entries()[0].available).toBe(false);
    expect((rows()[0].querySelector('.view-atlas') as HTMLButtonElement).disabled).toBe(true);
    component.openAtlas(component.entries()[0]);
    expect(viewer.open).not.toHaveBeenCalled();
    component.filterAvailable(true); expect(component.filtered()).toEqual([]);
  });

  it('refresca selecciones y categorías sin perder filtros ni abrir una selección obsoleta', () => {
    const old = component.entries()[0];
    categories.list.mockReturnValue(of([{...category, publicacion_destacada_id: null}]));
    publications.getPublicAtlas.mockReturnValue(of([]));
    component.search('salud'); component.loadData(); component.openAtlas(old);
    expect(component.query()).toBe('salud');
    expect(component.entries()[0].available).toBe(false);
    expect(viewer.open).not.toHaveBeenCalled();
  });

  it('distingue fallo de API de lista vacía y permite reintentar', () => {
    publications.getPublicAtlas.mockReturnValue(throwError(() => new Error('offline')));
    component.loadData(); fixture.detectChanges();
    expect(component.loading()).toBe(false);
    expect(element().querySelector('[role=alert]')?.textContent).toContain('No se pudo cargar');
    publications.getPublicAtlas.mockReturnValue(of([publication()]));
    (element().querySelector('[role=alert] button') as HTMLButtonElement).click(); fixture.detectChanges();
    expect(component.loadError()).toBe(false); expect(component.availableCount()).toBe(1);
  });

  it('evita cargas duplicadas y cancela la petición al salir', () => {
    const pending = new Subject<ObservatorioPublicacion[]>();
    publications.getPublicAtlas.mockReturnValue(pending);
    component.loadData(); component.loadData(); fixture.detectChanges();
    expect(publications.getPublicAtlas).toHaveBeenCalledTimes(2);
    expect(element().querySelector('[aria-busy=true]')).toBeTruthy();
    fixture.destroy(); expect(pending.observed).toBe(false);
  });

  it('no carga APIs durante el renderizado del servidor', () => {
    fixture.destroy(); TestBed.resetTestingModule();
    TestBed.configureTestingModule({providers: [
      {provide: PLATFORM_ID, useValue: 'server'},
      {provide: AtlasCategoriaService, useValue: categories},
      {provide: PublicacionService, useValue: publications},
      {provide: PublicationViewerService, useValue: viewer},
    ]});
    publications.getPublicAtlas.mockClear();
    const server = TestBed.createComponent(PublicAtlasComponent); server.detectChanges();
    expect(publications.getPublicAtlas).not.toHaveBeenCalled(); server.destroy();
  });
});
