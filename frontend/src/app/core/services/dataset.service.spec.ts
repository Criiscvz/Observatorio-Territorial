import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { DatasetService } from './dataset.service';
import { ApiService } from './api.service';
import { environment } from '../../../environments/environment';
import { Dataset } from '../models';

describe('DatasetService', () => {
  let service: DatasetService;
  let httpMock: HttpTestingController;

  const mockDataset: Dataset = {
    id: 'd1',
    nombre: 'Dataset Test',
    nombre_archivo: 'test.csv',
    descripcion: 'Test',
    estado: 'COMPLETADO',
    departamento_id: 'dep1',
    subido_por: 1,
    fecha_carga: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    total_registros: 100
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        DatasetService,
        ApiService,
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    });

    service = TestBed.inject(DatasetService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('getAll()', () => {
    it('should fetch datasets without department id', () => {
      const mockResponse = { data: [mockDataset], total: 1 };
      
      service.getAll().subscribe(response => {
        expect(response).toEqual(mockResponse);
      });

      const req = httpMock.expectOne(`${environment.apiUrl}/datasets`);
      expect(req.request.method).toBe('GET');
      req.flush(mockResponse);
    });

    it('should fetch datasets with department id', () => {
      const mockResponse = { data: [mockDataset], total: 1 };
      
      service.getAll('dep1').subscribe(response => {
        expect(response).toEqual(mockResponse);
      });

      const req = httpMock.expectOne(req => req.url === `${environment.apiUrl}/datasets` && req.params.get('departamento_id') === 'dep1');
      expect(req.request.method).toBe('GET');
      req.flush(mockResponse);
    });
  });

  describe('create()', () => {
    it('should construct FormData and upload file', () => {
      const dummyFile = new File([''], 'test.csv', { type: 'text/csv' });
      
      service.create('dep1', 'New Dataset', 'Desc', dummyFile).subscribe(response => {
        expect(response).toEqual(mockDataset);
      });

      const req = httpMock.expectOne(`${environment.apiUrl}/datasets`);
      expect(req.request.method).toBe('POST');
      
      const body = req.request.body as FormData;
      expect(body.has('archivo')).toBe(true);
      expect(body.get('departamento_id')).toBe('dep1');
      expect(body.get('nombre')).toBe('New Dataset');
      expect(body.get('descripcion')).toBe('Desc');
      
      req.flush(mockDataset);
    });
  });

  describe('analizar()', () => {
    it('should call analyze endpoint', () => {
      const mockAnalisis = { columnas: [], total_filas: 10 };
      
      service.analizar('d1').subscribe(response => {
        expect(response).toEqual(mockAnalisis);
      });

      const req = httpMock.expectOne(`${environment.apiUrl}/datasets/d1/analyze`);
      expect(req.request.method).toBe('POST');
      req.flush(mockAnalisis);
    });
  });
});
