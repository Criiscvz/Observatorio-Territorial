import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { CategoriaService } from './categoria.service';
import { ApiService } from './api.service';
import { environment } from '../../../environments/environment';

describe('CategoriaService', () => {
  let service: CategoriaService;
  let httpMock: HttpTestingController;

  const mockCategoria = { id: 'cat1', codigo: 'EDU', nombre: 'Educación', orden: 1, activo: true, created_at: '2024-01-01', updated_at: '2024-01-01' };
  const mockFuente = { id: 'f1', dataset_id: 'd1', titulo: 'INE', url: 'http://ine.es', orden: 1, created_at: '2024-01-01', updated_at: '2024-01-01' };
  const mockGrafico = { id: 'g1', dataset_id: 'd1', titulo: 'Gráfico', tipo_grafico: 'bar', tipo_analisis: 'univariable', variable_x_id: 'v1', orden: 1, activo: true, creado_por: 'u1', created_at: '2024-01-01', updated_at: '2024-01-01' };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        CategoriaService,
        ApiService,
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    });
    service = TestBed.inject(CategoriaService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('Categorías', () => {
    it('getCategorias() should GET /categorias', () => {
      service.getCategorias().subscribe(res => expect(res).toEqual([mockCategoria]));
      const req = httpMock.expectOne(`${environment.apiUrl}/categorias`);
      expect(req.request.method).toBe('GET');
      req.flush([mockCategoria]);
    });

    it('getCategoriaByCodigo() should GET /categorias/:codigo', () => {
      service.getCategoriaByCodigo('EDU').subscribe(res => expect(res).toEqual(mockCategoria));
      const req = httpMock.expectOne(`${environment.apiUrl}/categorias/EDU`);
      expect(req.request.method).toBe('GET');
      req.flush(mockCategoria);
    });

    it('getDatasetsByCategoria() should GET /categorias/:codigo/datasets', () => {
      service.getDatasetsByCategoria('EDU').subscribe();
      const req = httpMock.expectOne(`${environment.apiUrl}/categorias/EDU/datasets`);
      expect(req.request.method).toBe('GET');
      req.flush([]);
    });
  });

  describe('Fuentes', () => {
    it('getFuentes() should GET /datasets/:id/fuentes', () => {
      service.getFuentes('d1').subscribe(res => expect(res).toEqual([mockFuente]));
      const req = httpMock.expectOne(`${environment.apiUrl}/datasets/d1/fuentes`);
      expect(req.request.method).toBe('GET');
      req.flush([mockFuente]);
    });

    it('createFuente() should POST to /datasets/:id/fuentes', () => {
      service.createFuente('d1', { titulo: 'INE', url: 'http://ine.es', orden: 1 } as any).subscribe(res => expect(res).toEqual(mockFuente));
      const req = httpMock.expectOne(`${environment.apiUrl}/datasets/d1/fuentes`);
      expect(req.request.method).toBe('POST');
      req.flush(mockFuente);
    });

    it('updateFuente() should PUT to /fuentes/:id', () => {
      service.updateFuente('f1', { titulo: 'INE Updated' }).subscribe();
      const req = httpMock.expectOne(`${environment.apiUrl}/fuentes/f1`);
      expect(req.request.method).toBe('PUT');
      req.flush(mockFuente);
    });

    it('deleteFuente() should DELETE /fuentes/:id', () => {
      service.deleteFuente('f1').subscribe();
      const req = httpMock.expectOne(`${environment.apiUrl}/fuentes/f1`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
    });
  });

  describe('Gráficos Predeterminados', () => {
    it('getGraficosPredeterminados() should GET /datasets/:id/graficos-predeterminados', () => {
      service.getGraficosPredeterminados('d1').subscribe(res => expect(res).toEqual([mockGrafico]));
      const req = httpMock.expectOne(`${environment.apiUrl}/datasets/d1/graficos-predeterminados`);
      expect(req.request.method).toBe('GET');
      req.flush([mockGrafico]);
    });

    it('createGraficoPredeterminado() should POST', () => {
      service.createGraficoPredeterminado('d1', { titulo: 'G', tipo_grafico: 'bar', tipo_analisis: 'univariable', variable_x_id: 'v1', orden: 1, activo: true, creado_por: 'u1' } as any).subscribe();
      const req = httpMock.expectOne(`${environment.apiUrl}/datasets/d1/graficos-predeterminados`);
      expect(req.request.method).toBe('POST');
      req.flush(mockGrafico);
    });

    it('updateGraficoPredeterminado() should PUT to /graficos-predeterminados/:id', () => {
      service.updateGraficoPredeterminado('g1', { titulo: 'Nuevo título' }).subscribe();
      const req = httpMock.expectOne(`${environment.apiUrl}/graficos-predeterminados/g1`);
      expect(req.request.method).toBe('PUT');
      req.flush(mockGrafico);
    });

    it('deleteGraficoPredeterminado() should DELETE /graficos-predeterminados/:id', () => {
      service.deleteGraficoPredeterminado('g1').subscribe();
      const req = httpMock.expectOne(`${environment.apiUrl}/graficos-predeterminados/g1`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
    });
  });
});
