import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { DepartamentoService } from './departamento.service';
import { ApiService } from './api.service';
import { environment } from '../../../environments/environment';
import { Departamento } from '../models';

describe('DepartamentoService', () => {
  let service: DepartamentoService;
  let httpMock: HttpTestingController;

  const mockDepartamento: Departamento = {
    id: 'dep1',
    nombre: 'Departamento Test',
    codigo_interno: 'DEP-01',
    descripcion: 'Descripción',
    publico: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        DepartamentoService,
        ApiService,
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    });
    service = TestBed.inject(DepartamentoService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('getAll()', () => {
    it('should GET /departamentos', () => {
      service.getAll().subscribe(res => expect(res).toEqual([mockDepartamento]));
      const req = httpMock.expectOne(`${environment.apiUrl}/departamentos`);
      expect(req.request.method).toBe('GET');
      req.flush([mockDepartamento]);
    });
  });

  describe('getById()', () => {
    it('should GET /departamentos/:id', () => {
      service.getById('dep1').subscribe(res => expect(res).toEqual(mockDepartamento));
      const req = httpMock.expectOne(`${environment.apiUrl}/departamentos/dep1`);
      expect(req.request.method).toBe('GET');
      req.flush(mockDepartamento);
    });
  });

  describe('create()', () => {
    it('should POST and notify change via Subject', () => {
      const notifySpy = vi.spyOn(service, 'notifyChange');
      const data = { nombre: 'Nuevo', descripcion: 'Desc', publico: false };

      service.create(data).subscribe(res => expect(res).toEqual(mockDepartamento));

      const req = httpMock.expectOne(`${environment.apiUrl}/departamentos`);
      expect(req.request.method).toBe('POST');
      req.flush(mockDepartamento);

      expect(notifySpy).toHaveBeenCalled();
    });

    it('should emit on onDepartamentosChanged$ after create', () => {
      let changeEmitted = false;
      service.onDepartamentosChanged$.subscribe(() => (changeEmitted = true));

      service.create({ nombre: 'X' }).subscribe();
      httpMock.expectOne(`${environment.apiUrl}/departamentos`).flush(mockDepartamento);

      expect(changeEmitted).toBe(true);
    });
  });

  describe('update()', () => {
    it('should PUT and notify change', () => {
      const notifySpy = vi.spyOn(service, 'notifyChange');
      service.update('dep1', { nombre: 'Updated' }).subscribe();

      const req = httpMock.expectOne(`${environment.apiUrl}/departamentos/dep1`);
      expect(req.request.method).toBe('PUT');
      req.flush(mockDepartamento);

      expect(notifySpy).toHaveBeenCalled();
    });
  });

  describe('delete()', () => {
    it('should DELETE and notify change', () => {
      const notifySpy = vi.spyOn(service, 'notifyChange');
      service.delete('dep1').subscribe();

      const req = httpMock.expectOne(`${environment.apiUrl}/departamentos/dep1`);
      expect(req.request.method).toBe('DELETE');
      req.flush({ message: 'Eliminado' });

      expect(notifySpy).toHaveBeenCalled();
    });
  });

  describe('Public endpoints', () => {
    it('getPublicos() should GET /publico/departamentos', () => {
      service.getPublicos().subscribe();
      const req = httpMock.expectOne(`${environment.apiUrl}/publico/departamentos`);
      expect(req.request.method).toBe('GET');
      req.flush([mockDepartamento]);
    });

    it('getPublicById() should GET /publico/departamentos/:id', () => {
      service.getPublicById('dep1').subscribe();
      const req = httpMock.expectOne(`${environment.apiUrl}/publico/departamentos/dep1`);
      expect(req.request.method).toBe('GET');
      req.flush(mockDepartamento);
    });
  });
});
