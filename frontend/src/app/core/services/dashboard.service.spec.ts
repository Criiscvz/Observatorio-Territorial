import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { DashboardService } from './dashboard.service';
import { ApiService } from './api.service';
import { environment } from '../../../environments/environment';

describe('DashboardService', () => {
  let service: DashboardService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        DashboardService,
        ApiService,
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    });
    service = TestBed.inject(DashboardService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('getUnivariableStats()', () => {
    it('should POST to /stats/univariable and normalize categories → labels', () => {
      const mockRequest = { dataset_id: 'd1', variable: 'edad' };
      const mockRawResponse = {
        tipo: 'NUMERICO',
        data: { categories: ['A', 'B'], values: [10, 20], labels: null }
      };

      service.getUnivariableStats(mockRequest as any).subscribe(res => {
        expect(res.data.labels).toEqual(['A', 'B']);
        expect(res.data.values).toEqual([10, 20]);
      });

      const req = httpMock.expectOne(`${environment.apiUrl}/stats/univariable`);
      expect(req.request.method).toBe('POST');
      req.flush(mockRawResponse);
    });

    it('should keep existing labels if present', () => {
      const mockRawResponse = {
        tipo: 'NUMERICO',
        data: { labels: ['X', 'Y'], values: [5, 15] }
      };

      service.getUnivariableStats({ dataset_id: 'd1', variable: 'x' } as any).subscribe(res => {
        expect(res.data.labels).toEqual(['X', 'Y']);
      });

      httpMock.expectOne(`${environment.apiUrl}/stats/univariable`).flush(mockRawResponse);
    });
  });

  describe('getBivariableStats()', () => {
    it('should POST to /stats/bivariable and map field aliases', () => {
      const mockRaw = {
        nombre_variable_x: 'edad',
        nombre_variable_y: 'ingreso',
        data: { categories: ['G1', 'G2'], labels: null, labels_x: null }
      };

      service.getBivariableStats({ dataset_id: 'd1', variable_x: 'edad', variable_y: 'ingreso' } as any).subscribe(res => {
        expect(res.variable_x).toBe('edad');
        expect(res.variable_y).toBe('ingreso');
        expect(res.data.labels).toEqual(['G1', 'G2']);
      });

      httpMock.expectOne(`${environment.apiUrl}/stats/bivariable`).flush(mockRaw);
    });
  });

  describe('getDatasetData()', () => {
    it('should GET /datasets/:id/data with pagination params', () => {
      service.getDatasetData('d1', 2, 25).subscribe();
      const req = httpMock.expectOne(r =>
        r.url === `${environment.apiUrl}/datasets/d1/data` &&
        r.params.get('page') === '2' &&
        r.params.get('per_page') === '25'
      );
      expect(req.request.method).toBe('GET');
      req.flush({ data: [], meta: {} });
    });
  });

  describe('Public methods', () => {
    it('getPublicUnivariableStats() should POST to /publico/stats/univariable', () => {
      const mockRaw = { data: { values: [], categories: [] } };
      service.getPublicUnivariableStats({ dataset_id: 'd1', variable: 'x' } as any).subscribe();
      const req = httpMock.expectOne(`${environment.apiUrl}/publico/stats/univariable`);
      expect(req.request.method).toBe('POST');
      req.flush(mockRaw);
    });

    it('getPublicBivariableStats() should POST to /publico/stats/bivariable', () => {
      const mockRaw = { data: {}, nombre_variable_x: 'x', nombre_variable_y: 'y' };
      service.getPublicBivariableStats({ dataset_id: 'd1', variable_x: 'x', variable_y: 'y' } as any).subscribe();
      const req = httpMock.expectOne(`${environment.apiUrl}/publico/stats/bivariable`);
      expect(req.request.method).toBe('POST');
      req.flush(mockRaw);
    });

    it('getPublicDatasetData() should GET /publico/datasets/:id/data', () => {
      service.getPublicDatasetData('d1').subscribe();
      const req = httpMock.expectOne(r => r.url === `${environment.apiUrl}/publico/datasets/d1/data`);
      expect(req.request.method).toBe('GET');
      req.flush({ data: [] });
    });
  });

  describe('Stopwords', () => {
    it('getDatasetStopwords() should GET /stats/datasets/:id/stopwords', () => {
      service.getDatasetStopwords('d1').subscribe();
      const req = httpMock.expectOne(`${environment.apiUrl}/stats/datasets/d1/stopwords`);
      expect(req.request.method).toBe('GET');
      req.flush({ stopwords: [], count: 0 });
    });

    it('updateDatasetStopwords() should PUT /stats/datasets/:id/stopwords', () => {
      service.updateDatasetStopwords('d1', ['stop1', 'stop2']).subscribe();
      const req = httpMock.expectOne(`${environment.apiUrl}/stats/datasets/d1/stopwords`);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual({ stopwords: ['stop1', 'stop2'] });
      req.flush({ stopwords: ['stop1', 'stop2'], count: 2 });
    });
  });
});
