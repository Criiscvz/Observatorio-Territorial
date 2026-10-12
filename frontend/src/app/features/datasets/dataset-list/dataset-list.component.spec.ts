import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Pipe, PipeTransform, signal, WritableSignal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterModule } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { DatasetListComponent } from './dataset-list.component';
import { AuthService } from '@core/services/auth.service';
import { DepartamentoService } from '@core/services/departamento.service';
import { DatasetService } from '@core/services/dataset.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Dataset, Departamento } from '@core/models';
import { ConfirmDialogComponent } from '@shared/components/confirm-dialog/confirm-dialog.component';

@Pipe({ name: 'translate', standalone: true })
class MockTranslatePipe implements PipeTransform {
  transform(value: string): string { return value; }
}

describe('DatasetListComponent', () => {
  let component: DatasetListComponent;
  let fixture: ComponentFixture<DatasetListComponent>;
  let departamentoServiceSpy: { getAll: ReturnType<typeof vi.fn> };
  let datasetServiceSpy: { delete: ReturnType<typeof vi.fn> };
  let authServiceSpy: { isAdmin: WritableSignal<boolean> };
  let dialogSpy: { open: ReturnType<typeof vi.fn> };
  let snackBarSpy: { open: ReturnType<typeof vi.fn> };
  let dialogClosed: Subject<boolean | undefined>;
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

  const mockDepartamentos: Departamento[] = [
    {
      id: 'dep1', nombre: 'Observatorio A', codigo_interno: 'OBS-A', publico: true,
      created_at: '2024-01-01', updated_at: '2024-01-01', datasets: mockDatasets
    },
    {
      id: 'dep2', nombre: 'Observatorio vacío', codigo_interno: 'OBS-B', publico: false,
      created_at: '2024-01-01', updated_at: '2024-01-01', datasets: []
    },
    {
      id: 'dep3', nombre: 'Observatorio sin datasets', codigo_interno: 'OBS-C', publico: false,
      created_at: '2024-01-01', updated_at: '2024-01-01'
    }
  ];

  beforeEach(async () => {
    departamentoServiceSpy = {
      getAll: vi.fn().mockReturnValue(of(mockDepartamentos))
    };
    datasetServiceSpy = {
      delete: vi.fn().mockReturnValue(of({ message: 'Eliminado' }))
    };
    authServiceSpy = { isAdmin: signal(false) };
    dialogClosed = new Subject<boolean | undefined>();
    dialogSpy = {
      open: vi.fn().mockReturnValue({ afterClosed: () => dialogClosed.asObservable() })
    };
    snackBarSpy = { open: vi.fn() };
    translateSpy = { instant: vi.fn().mockImplementation((k) => k) };

    TestBed.overrideComponent(DatasetListComponent, {
      remove: { imports: [TranslateModule] },
      add: { imports: [MockTranslatePipe] }
    });
    TestBed.overrideProvider(AuthService, { useValue: authServiceSpy });
    TestBed.overrideProvider(DepartamentoService, { useValue: departamentoServiceSpy });
    TestBed.overrideProvider(DatasetService, { useValue: datasetServiceSpy });
    TestBed.overrideProvider(MatDialog, { useValue: dialogSpy });
    TestBed.overrideProvider(MatSnackBar, { useValue: snackBarSpy });
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

  it('should load and group datasets from their observatories on init', () => {
    expect(departamentoServiceSpy.getAll).toHaveBeenCalledTimes(1);
    const expectedDatasets = mockDatasets.map((dataset) => ({
      ...dataset, departamento: mockDepartamentos[0]
    }));
    expect(component.datasets()).toEqual(expectedDatasets);
    expect(component.datasetGroups()).toEqual([
      { departamento: mockDepartamentos[0], datasets: expectedDatasets }
    ]);
    expect(component.totalDatasets()).toBe(2);
    expect(component.loading()).toBe(false);
  });

  it('should clear existing datasets and groups on load error', () => {
    departamentoServiceSpy.getAll.mockReturnValue(throwError(() => new Error('Network error')));
    component.loadDatasets();
    expect(component.datasets()).toEqual([]);
    expect(component.datasetGroups()).toEqual([]);
    expect(component.totalDatasets()).toBe(0);
    expect(component.loading()).toBe(false);
  });

  it('should finish loading when no observatories are returned', () => {
    departamentoServiceSpy.getAll.mockReturnValue(of([]));
    component.loadDatasets();
    expect(component.datasets()).toEqual([]);
    expect(component.datasetGroups()).toEqual([]);
    expect(component.totalDatasets()).toBe(0);
    expect(component.loading()).toBe(false);
  });

  it('should remain loading until the observatory request responds', () => {
    const response = new Subject<Departamento[]>();
    departamentoServiceSpy.getAll.mockReturnValue(response);
    component.loadDatasets();
    expect(component.loading()).toBe(true);
    response.next(mockDepartamentos);
    response.complete();
    expect(component.loading()).toBe(false);
    expect(component.totalDatasets()).toBe(2);
  });

  it('should keep datasets in separate groups and fill in missing observatory IDs', () => {
    const departamentos: Departamento[] = [
      { ...mockDepartamentos[0], datasets: [mockDatasets[0]] },
      { ...mockDepartamentos[1], datasets: [{ ...mockDatasets[1], departamento_id: '' }] }
    ];
    departamentoServiceSpy.getAll.mockReturnValue(of(departamentos));
    component.loadDatasets();
    expect(component.datasetGroups().map((group) => group.departamento.id)).toEqual(['dep1', 'dep2']);
    expect(component.datasetGroups().map((group) => group.datasets.length)).toEqual([1, 1]);
    expect(component.datasets()[1].departamento_id).toBe('dep2');
    expect(component.datasets()[1].departamento).toBe(departamentos[1]);
    expect(component.totalDatasets()).toBe(2);
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
    it('should block deletion for a non-admin without opening a confirmation', () => {
      component.deleteDataset(mockDatasets[0]);
      expect(component.canDeleteDataset()).toBe(false);
      expect(dialogSpy.open).not.toHaveBeenCalled();
      expect(datasetServiceSpy.delete).not.toHaveBeenCalled();
      expect(snackBarSpy.open).toHaveBeenCalledWith(
        'No tienes permiso para eliminar datasets.', 'Cerrar', expect.anything()
      );
    });

    it('should delete and reload only after an admin confirms the dialog', () => {
      authServiceSpy.isAdmin.set(true);
      const reloadSpy = vi.spyOn(component, 'loadDatasets');

      component.deleteDataset(mockDatasets[0]);

      expect(component.canDeleteDataset()).toBe(true);
      expect(dialogSpy.open).toHaveBeenCalledExactlyOnceWith(
        ConfirmDialogComponent,
        expect.objectContaining({
          data: expect.objectContaining({ confirmColor: 'warn', confirmText: 'Eliminar definitivamente' })
        })
      );
      expect(datasetServiceSpy.delete).not.toHaveBeenCalled();
      expect(reloadSpy).not.toHaveBeenCalled();

      dialogClosed.next(true);
      dialogClosed.complete();

      expect(datasetServiceSpy.delete).toHaveBeenCalledExactlyOnceWith('d1');
      expect(reloadSpy).toHaveBeenCalledTimes(1);
      expect(departamentoServiceSpy.getAll).toHaveBeenCalledTimes(2);
      expect(snackBarSpy.open).toHaveBeenCalledWith(
        'Conjunto de datos eliminado correctamente.', 'Cerrar', expect.anything()
      );
    });

    it.each([false, undefined])('should not delete or reload when the dialog closes with %s', (confirmed) => {
      authServiceSpy.isAdmin.set(true);
      const reloadSpy = vi.spyOn(component, 'loadDatasets');

      component.deleteDataset(mockDatasets[0]);
      expect(dialogSpy.open).toHaveBeenCalledTimes(1);
      dialogClosed.next(confirmed);
      dialogClosed.complete();

      expect(datasetServiceSpy.delete).not.toHaveBeenCalled();
      expect(reloadSpy).not.toHaveBeenCalled();
      expect(snackBarSpy.open).not.toHaveBeenCalled();
    });

    it('should retain datasets and report a deletion error without reloading', () => {
      authServiceSpy.isAdmin.set(true);
      datasetServiceSpy.delete.mockReturnValue(throwError(() => ({ status: 403 })));
      const datasetsBeforeDelete = component.datasets();
      const reloadSpy = vi.spyOn(component, 'loadDatasets');

      component.deleteDataset(mockDatasets[0]);
      dialogClosed.next(true);
      dialogClosed.complete();

      expect(datasetServiceSpy.delete).toHaveBeenCalledExactlyOnceWith('d1');
      expect(component.datasets()).toEqual(datasetsBeforeDelete);
      expect(reloadSpy).not.toHaveBeenCalled();
      expect(snackBarSpy.open).toHaveBeenCalledWith(
        'No se pudo eliminar el conjunto de datos.', 'Cerrar', expect.anything()
      );
    });
  });
});
