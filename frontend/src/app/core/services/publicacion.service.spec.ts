import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../environments/environment';
import { ApiService } from './api.service';
import { PublicacionService } from './publicacion.service';

describe('PublicacionService SharePoint imports', () => {
  let service: PublicacionService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        PublicacionService,
        ApiService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(PublicacionService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('requests management library pages, totals and server search without fetching the complete array', () => {
    service.libraryPage('dep-1',{tipo:'LIBRO',q:'Ana Pérez',page:3}).subscribe();
    const request=httpMock.expectOne(r=>r.url===`${environment.apiUrl}/departamentos/dep-1/biblioteca/publicaciones`);
    expect(request.request.params.get('per_page')).toBe('20');expect(request.request.params.get('page')).toBe('3');
    expect(request.request.params.get('q')).toBe('Ana Pérez');expect(request.request.params.get('tipo')).toBe('LIBRO');
    request.flush({data:[],meta:{total:0,current_page:3,last_page:1,per_page:20},counts:{LIBRO:0},review_total:0});
  });

  it.each([false,true])('uses the %s Atlas library contract and category filter', management => {
    service.atlasPage('category-1',2,'Salud',management).subscribe();
    const endpoint=management?'/departamentos/publicaciones/atlas-biblioteca':'/publico/atlas/biblioteca';
    const request=httpMock.expectOne(r=>r.url===`${environment.apiUrl}${endpoint}`);
    expect(request.request.params.get('categoria_id')).toBe('category-1');expect(request.request.params.get('page')).toBe('2');expect(request.request.params.get('per_page')).toBe('20');
    request.flush({data:[],meta:{total:0,current_page:2,last_page:1,per_page:20}});
  });

  it('persists the selected category when importing global Atlas files', () => {
    service.importManyGlobalAtlasSharePoint(['pdf-1'], 'category-1').subscribe();
    const request = httpMock.expectOne(`${environment.apiUrl}/departamentos/publicaciones/atlas-global/sharepoint/import-many`);
    expect(request.request.body).toEqual({ sharepoint_file_ids: ['pdf-1'], atlas_categoria_id: 'category-1' });
    request.flush({ data: { imported: [], duplicates: [], rejected: [], errors: [] }, totals: { imported: 0, duplicates: 0, rejected: 0, errors: 0 } });
  });

  it.each([
    ['atlas', '/departamentos/dep-1/publicaciones/atlas/sharepoint/browse'],
    ['articulos', '/departamentos/dep-1/publicaciones/articulos/sharepoint/browse'],
    ['reportes', '/departamentos/dep-1/publicaciones/reportes/sharepoint/browse'],
  ] as const)('uses the %s browse endpoint', (target, endpoint) => {
    service.browseSharePointFolder('dep-1', target, 'folder-1').subscribe();

    const request = httpMock.expectOne(
      `${environment.apiUrl}${endpoint}?item_id=folder-1`,
    );
    expect(request.request.method).toBe('GET');
    request.flush({ data: { items: [] } });
  });

  it.each([
    ['atlas', '/departamentos/dep-1/publicaciones/atlas/sharepoint/import-many'],
    ['articulos', '/departamentos/dep-1/publicaciones/articulos/sharepoint/import-many'],
    ['reportes', '/departamentos/dep-1/publicaciones/reportes/sharepoint/import-many'],
  ] as const)('uses the %s multiple import endpoint', (target, endpoint) => {
    service.importManySharePoint('dep-1', target, ['pdf-1', 'pdf-2']).subscribe();

    const request = httpMock.expectOne(`${environment.apiUrl}${endpoint}`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ sharepoint_file_ids: ['pdf-1', 'pdf-2'] });
    request.flush({
      data: { imported: [], duplicates: [], rejected: [], errors: [] },
      totals: { imported: 0, duplicates: 0, rejected: 0, errors: 0 },
    });
  });
});
