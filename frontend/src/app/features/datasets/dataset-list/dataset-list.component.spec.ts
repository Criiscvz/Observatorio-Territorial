import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Pipe, PipeTransform } from '@angular/core';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterModule } from '@angular/router';
import { of, throwError } from 'rxjs';
import { DatasetListComponent } from './dataset-list.component';
import { DatasetService } from '@core/services/dataset.service';
import { TranslateService } from '@ngx-translate/core';
import { Dataset } from '@core/models';

@Pipe({ name: 'translate', standalone: true })
class MockTranslatePipe implements PipeTransform {
  transform(value: string): string { return value; }
}

describe('DatasetListComponent', () => {
  let component: DatasetListComponent;
  let fixture: ComponentFixture<DatasetListComponent>;
  let datasetServiceSpy: any;
  let translateSpy: any;

  const mockDatasets: Dataset[] = [
    {
      id: 'd1', nombre: 'Dataset A', nombre_archivo: 'a.csv',
      estado: 'COMPLETADO', departamento_id: 'dep1', subido_por: 1,
      fecha_carga: '2024-01-01', created_at: '2024-01-01', updated_at: '2024-01-01', total_registros: 100
    },
    {
      id: 'd2', nombre: 'Dataset B', nombre_archivo: 'b.csv',
      estado: 'PROCESANDO', departamento_id: 'dep1', subido_por: 1,
      fecha_carga: '2024-01-02', created_at: '2024-01-02', updated_at: '2024-01-02', total_registros: 50
    }
  ];

  beforeEach(async () => {
    datasetServiceSpy = {
      getAll: vi.fn().mockReturnValue(of({ data: mockDatasets, total: 2 })),
      delete: vi.fn().mockReturnValue(of({ message: 'Eliminado' }))
    };
    translateSpy = { instant: vi.fn().mockImplementation((k) => k) };

    TestBed.overrideComponent(DatasetListComponent, {
      remove: { imports: [] },
      add: { imports: [MockTranslatePipe] }
    });
    TestBed.overrideProvider(DatasetService, { useValue: datasetServiceSpy });
    TestBed.overrideProvider(TranslateService, { useValue: translateSpy });

    await TestBed.configureTestingModule({
      imports: [
        DatasetListComponent,
        NoopAnimationsModule,
        RouterModule.forRoot([])
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(DatasetListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load datasets on init', () => {
    expect(datasetServiceSpy.getAll).toHaveBeenCalled();
    expect(component.datasets()).toHaveLength(2);
    expect(component.loading()).toBe(false);
  });

  it('should set empty datasets array on load error', () => {
    datasetServiceSpy.getAll.mockReturnValue(throwError(() => new Error('Network error')));
    component.loadDatasets();
    expect(component.datasets()).toHaveLength(0);
    expect(component.loading()).toBe(false);
  });

  describe('getEstadoColor()', () => {
    it('should return primary for COMPLETADO', () => {
      expect(component.getEstadoColor('COMPLETADO')).toBe('primary');
    });

    it('should return accent for PROCESANDO', () => {
      expect(component.getEstadoColor('PROCESANDO')).toBe('accent');
    });

    it('should return warn for any other status', () => {
      expect(component.getEstadoColor('ERROR')).toBe('warn');
      expect(component.getEstadoColor('PENDIENTE')).toBe('warn');
    });
  });

  describe('deleteDataset()', () => {
    it('should call delete and reload datasets on confirm', () => {
      vi.stubGlobal('confirm', vi.fn().mockReturnValue(true));
      const reloadSpy = vi.spyOn(component, 'loadDatasets');

      component.deleteDataset(mockDatasets[0]);

      expect(datasetServiceSpy.delete).toHaveBeenCalledWith('d1');
      expect(reloadSpy).toHaveBeenCalled();

      vi.unstubAllGlobals();
    });

    it('should NOT call delete if user cancels', () => {
      vi.stubGlobal('confirm', vi.fn().mockReturnValue(false));

      component.deleteDataset(mockDatasets[0]);

      expect(datasetServiceSpy.delete).not.toHaveBeenCalled();

      vi.unstubAllGlobals();
    });
  });
});
