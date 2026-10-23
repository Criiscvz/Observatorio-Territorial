import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { DepartamentoService } from '@core/services/departamento.service';
import { PublicDepartamentosComponent } from './public-departamentos.component';

describe('Directorio público institucional', () => {
  const items = Array.from({length: 12}, (_, id) => ({id: String(id), nombre: `Observatorio ${id}`, descripcion: id === 11 ? 'Análisis socioeconómico' : 'Investigación', icono: 'account_balance'}));
  function setup(fail = false) {
    const service = {getPublicos: vi.fn(() => fail ? throwError(() => new Error('offline')) : of(items))};
    TestBed.configureTestingModule({providers: [provideRouter([]), {provide: DepartamentoService, useValue: service}]});
    const fixture = TestBed.createComponent(PublicDepartamentosComponent); fixture.detectChanges();
    return {fixture, component: fixture.componentInstance, element: fixture.nativeElement as HTMLElement, service};
  }
  it('pagina cinco observatorios sin datasets ni datos inventados y enlaza el destino correcto', () => {
    const {fixture, component, element} = setup();
    expect(element.querySelectorAll('.directory-row')).toHaveLength(5);
    expect(element.querySelector('a[aria-label="Explorar Observatorio 0"]')?.getAttribute('href')).toBe('/publico/departamentos/0');
    expect(element.textContent).not.toContain('datasets');
    component.changePage(1); fixture.detectChanges(); expect(component.visible().map(x => x.id)).toEqual(['5','6','7','8','9']);
    component.changePage(1); fixture.detectChanges(); expect(element.querySelectorAll('.directory-row')).toHaveLength(2);
    expect(element.textContent).toContain('11–12 de 12');
    expect(element.querySelector<HTMLButtonElement>('[aria-label="Página siguiente"]')!.disabled).toBe(true);
  });
  it('busca por nombre o tema sin tildes y reinicia la página al filtrar y limpiar', () => {
    const {fixture, component, element} = setup(); component.changePage(2);
    component.searchTerm = 'SOCIOECONOMICO'; component.filterDepartamentos(); fixture.detectChanges();
    expect(component.visible().map(x => x.id)).toEqual(['11']); expect(component.currentPage()).toBe(0);
    component.searchTerm = 'inexistente'; component.filterDepartamentos(); fixture.detectChanges();
    expect(element.textContent).toContain('No encontramos observatorios'); expect(component.rangeStart()).toBe(0);
    component.clearSearch(); fixture.detectChanges(); expect(element.querySelectorAll('.directory-row')).toHaveLength(5);
  });
  it('distingue un fallo de red de un directorio vacío y permite reintentar', () => {
    const {fixture, component, element, service} = setup(true);
    expect(element.querySelector('[role="alert"]')).not.toBeNull(); expect(element.querySelector('.public-pagination')).toBeNull();
    service.getPublicos.mockReturnValue(of(items)); component.loadDepartamentos(); fixture.detectChanges();
    expect(component.loadError()).toBe(false); expect(component.visible()).toHaveLength(5);
  });
});
