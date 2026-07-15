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

  it.each([
    ['atlas', '/departamentos/dep-1/publicaciones/atlas/sharepoint/browse'],
    ['articulos', '/departamentos/dep-1/publicaciones/articulos/sharepoint/browse'],
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
