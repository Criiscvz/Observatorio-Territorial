import { TestBed } from '@angular/core/testing';
import { FormBuilder } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';
import { DatasetUploadFacade } from './dataset-upload.facade';
import { DatasetService } from '@core/services/dataset.service';
import { DepartamentoService } from '@core/services/departamento.service';

describe('DatasetUploadFacade', () => {
  let facade: DatasetUploadFacade;
  let datasetServiceSpy: any;
  let deptoServiceSpy: any;
  let routerSpy: any;
  let translateSpy: any;

  beforeEach(() => {
    datasetServiceSpy = {
      create: vi.fn(),
      analizar: vi.fn(),
      confirmar: vi.fn()
    };
    deptoServiceSpy = {
      getAll: vi.fn().mockReturnValue(of([]))
    };
    routerSpy = {
      navigate: vi.fn()
    };
    translateSpy = {
      instant: vi.fn().mockImplementation((key: string) => key)
    };

    TestBed.configureTestingModule({
      providers: [
        DatasetUploadFacade,
        FormBuilder,
        { provide: DatasetService, useValue: datasetServiceSpy },
        { provide: DepartamentoService, useValue: deptoServiceSpy },
        { provide: Router, useValue: routerSpy },
        { provide: TranslateService, useValue: translateSpy }
      ]
    });

    facade = TestBed.inject(DatasetUploadFacade);
  });

  it('should be created', () => {
    expect(facade).toBeTruthy();
  });

  it('should load departamentos on loadDepartamentos', () => {
    const mockDeptos = [{ id: '1', nombre: 'Dep1' }];
    deptoServiceSpy.getAll.mockReturnValue(of(mockDeptos));

    facade.loadDepartamentos();
    expect(deptoServiceSpy.getAll).toHaveBeenCalled();
    expect(facade.departamentos()).toEqual(mockDeptos);
  });

  describe('uploadAndAnalyze', () => {
    it('should do nothing if no file is selected', () => {
      facade.selectedFile.set(null);
      facade.uploadAndAnalyze({});
      expect(facade.uploading()).toBe(false);
      expect(datasetServiceSpy.create).not.toHaveBeenCalled();
    });

    it('should upload, analyze and advance stepper on success', () => {
      const mockFile = new File([''], 'test.csv');
      const mockDataset = { id: 'd1' };
      const mockAnalisis = { columnas: [{ nombre_columna: 'col1' }], total_filas: 10 };
      
      facade.selectedFile.set(mockFile);
      facade.uploadForm.setValue({ departamento_id: 'dep1', nombre: 'Test', descripcion: 'Desc' });
      
      datasetServiceSpy.create.mockReturnValue(of(mockDataset));
      datasetServiceSpy.analizar.mockReturnValue(of(mockAnalisis));
      
      const stepperSpy = { next: vi.fn() };

      facade.uploadAndAnalyze(stepperSpy);

      expect(datasetServiceSpy.create).toHaveBeenCalledWith('dep1', 'Test', 'Desc', mockFile);
      expect(datasetServiceSpy.analizar).toHaveBeenCalledWith('d1');
      expect(facade.datasetId()).toBe('d1');
      expect(facade.totalFilas()).toBe(10);
      expect(facade.columnas()[0].excluida).toBe(false);
      expect(facade.columnas()[0].nombre_columna).toBe('col1');
      expect(facade.uploading()).toBe(false);
      expect(stepperSpy.next).toHaveBeenCalled();
    });

    it('should handle error during upload', () => {
      const mockFile = new File([''], 'test.csv');
      facade.selectedFile.set(mockFile);
      facade.uploadForm.setValue({ departamento_id: 'dep1', nombre: 'Test', descripcion: 'Desc' });
      
      datasetServiceSpy.create.mockReturnValue(throwError(() => ({ error: { message: 'Upload Failed' } })));
      
      facade.uploadAndAnalyze({});

      expect(facade.uploading()).toBe(false);
      expect(facade.error()).toBe('Upload Failed');
    });
  });

  describe('confirmImport', () => {
    it('should not proceed if no datasetId', () => {
      facade.datasetId.set(null);
      facade.confirmImport({});
      expect(datasetServiceSpy.confirmar).not.toHaveBeenCalled();
    });

    it('should not proceed if no active columns', () => {
      facade.datasetId.set('d1');
      facade.columnas.set([]); // no columns
      facade.confirmImport({});
      expect(facade.error()).toBe('datasets.upload.errors.noColumns');
      expect(datasetServiceSpy.confirmar).not.toHaveBeenCalled();
    });

    it('should confirm import and advance stepper on success', () => {
      facade.datasetId.set('d1');
      facade.columnas.set([{ nombre_columna: 'col1', excluida: false } as any]);
      
      datasetServiceSpy.confirmar.mockReturnValue(of({ total_registros: 10 }));
      
      const stepperSpy = { next: vi.fn() };
      facade.confirmImport(stepperSpy);

      expect(facade.processing()).toBe(false);
      expect(facade.importedCount()).toBe(10);
      expect(stepperSpy.next).toHaveBeenCalled();
    });

    it('should handle error during import confirmation', () => {
      facade.datasetId.set('d1');
      facade.columnas.set([{ nombre_columna: 'col1', excluida: false } as any]);
      
      datasetServiceSpy.confirmar.mockReturnValue(throwError(() => ({ error: { message: 'Import Error' } })));
      
      facade.confirmImport({});

      expect(facade.processing()).toBe(false);
      expect(facade.error()).toBe('Import Error');
    });
  });

  describe('toggleExcluir', () => {
    it('should toggle excluida status of column', () => {
      const col = { nombre_columna: 'col1', excluida: false } as any;
      facade.columnas.set([col]);
      
      facade.toggleExcluir(col);
      
      expect(col.excluida).toBe(true);
      expect(facade.columnas()[0].excluida).toBe(true);
    });
  });

  describe('navigateToList', () => {
    it('should navigate to datasets list', () => {
      facade.navigateToList();
      expect(routerSpy.navigate).toHaveBeenCalledWith(['/admin/datasets']);
    });
  });
});
