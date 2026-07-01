import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Pipe, PipeTransform } from '@angular/core';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterModule } from '@angular/router';
import { of, throwError } from 'rxjs';
import { DashboardComponent } from './dashboard.component';
import { DepartamentoService } from '@core/services/departamento.service';
import { AuthService } from '@core/services/auth.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Departamento } from '@core/models';
import { NGX_ECHARTS_CONFIG } from 'ngx-echarts';

@Pipe({ name: 'translate', standalone: true })
class MockTranslatePipe implements PipeTransform {
  transform(value: string): string { return value; }
}

describe('DashboardComponent', () => {
  let component: DashboardComponent;
  let fixture: ComponentFixture<DashboardComponent>;
  let deptoServiceSpy: any;
  let authServiceSpy: any;
  let translateSpy: any;

  const mockDepartamentos: Departamento[] = [
    {
      id: 'dep1', nombre: 'Dep 1', codigo_interno: 'D01', publico: true,
      created_at: '2024-01-01', updated_at: '2024-01-01',
      datasets: [
        { id: 'd1', estado: 'COMPLETADO', total_registros: 200, variables_metadatos: [{ id: 'v1' } as any] } as any,
        { id: 'd2', estado: 'PROCESANDO', total_registros: 100, variables_metadatos: [] } as any
      ]
    },
    {
      id: 'dep2', nombre: 'Dep 2', codigo_interno: 'D02', publico: false,
      created_at: '2024-01-01', updated_at: '2024-01-01',
      datasets: [
        { id: 'd3', estado: 'ERROR', total_registros: 0, variables_metadatos: [] } as any
      ]
    }
  ];

  beforeEach(async () => {
    vi.stubGlobal('ResizeObserver', class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    });

    deptoServiceSpy = {
      getAll: vi.fn().mockReturnValue(of(mockDepartamentos))
    };
    authServiceSpy = {
      user: vi.fn().mockReturnValue({ name: 'Test', rol: 'ADMIN' }),
      isAdmin: vi.fn().mockReturnValue(true)
    };
    translateSpy = {
      instant: vi.fn().mockImplementation((k) => k)
    };

    TestBed.overrideComponent(DashboardComponent, {
      remove: { imports: [TranslateModule] },
      add: { imports: [MockTranslatePipe] }
    });
    TestBed.overrideProvider(DepartamentoService, { useValue: deptoServiceSpy });
    TestBed.overrideProvider(AuthService, { useValue: authServiceSpy });
    TestBed.overrideProvider(TranslateService, { useValue: translateSpy });

    await TestBed.configureTestingModule({
      imports: [DashboardComponent, NoopAnimationsModule, RouterModule.forRoot([])],
      providers: [
        { provide: NGX_ECHARTS_CONFIG, useValue: { echarts: () => Promise.resolve() } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should create and load departamentos on init', () => {
    expect(component).toBeTruthy();
    expect(deptoServiceSpy.getAll).toHaveBeenCalled();
    expect(component.departamentos()).toHaveLength(2);
    expect(component.loading()).toBe(false);
  });

  it('should set empty array and stop loading on error', () => {
    deptoServiceSpy.getAll.mockReturnValue(throwError(() => new Error('Error')));
    component.loadDepartamentos();
    expect(component.departamentos()).toHaveLength(0);
    expect(component.loading()).toBe(false);
  });

  describe('Computed Signals', () => {
    it('totalDatasets() should count all datasets across departments', () => {
      expect(component.totalDatasets()).toBe(3); // d1 + d2 + d3
    });

    it('totalRegistros() should sum all total_registros', () => {
      expect(component.totalRegistros()).toBe(300); // 200 + 100 + 0
    });

    it('totalVariables() should count variables_metadatos', () => {
      expect(component.totalVariables()).toBe(1); // only d1 has 1
    });

    it('departamentosPublicos() should count public departments', () => {
      expect(component.departamentosPublicos()).toBe(1); // dep1 is public
    });

    it('completionRate() should calculate % of COMPLETADO', () => {
      // 1 COMPLETADO out of 3 = 33%
      expect(component.completionRate()).toBe(33);
    });

    it('datasetsByStatus() should group datasets by estado', () => {
      const status = component.datasetsByStatus();
      expect(status['COMPLETADO']).toBe(1);
      expect(status['PROCESANDO']).toBe(1);
      expect(status['ERROR']).toBe(1);
    });

    it('completionRate() should return 0 when no datasets', () => {
      component.departamentos.set([]);
      expect(component.completionRate()).toBe(0);
    });
  });

  describe('Helper methods', () => {
    it('getEstadoClass() should return correct CSS class', () => {
      expect(component.getEstadoClass('COMPLETADO')).toBe('text-success');
      expect(component.getEstadoClass('PROCESANDO')).toBe('text-warning');
      expect(component.getEstadoClass('ERROR')).toBe('text-error');
      expect(component.getEstadoClass('PENDIENTE')).toBe('text-[var(--text-secondary)]');
    });

    it('formatNumber() should format large numbers', () => {
      expect(component.formatNumber(500)).toBe('500');
      expect(component.formatNumber(1500)).toBe('1.5K');
      expect(component.formatNumber(2000000)).toBe('2.0M');
    });

    it('getDeptoColor() should cycle through color array', () => {
      const color0 = component.getDeptoColor(0);
      const color10 = component.getDeptoColor(10); // wraps around
      expect(color0).toBe(color10);
    });
  });
});
