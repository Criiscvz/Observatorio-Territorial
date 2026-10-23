import { AuthService } from '@core/services/auth.service';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AdminWorkspaceService } from '@core/services/admin-workspace.service';
import { DepartamentoService } from '@core/services/departamento.service';
import { WorkspacePublicationsComponent } from './admin-workspace.component';

describe('Lista editorial de publicaciones',()=>{
  const records=['ARTICULO','LIBRO','REPORTE'].map((type,i)=>({id:`p${i}`,departamento_id:'salud',departamento_nombre:'Salud',titulo:`Contenido ${type}`,tipo:type,estado:'PUBLICACION',codigo:`CODE-${i}`,fecha_publicacion:'2026-10-20'}));
  function setup(){
    const service={publications:vi.fn(()=>of({data:records,meta:{total:25,from:1,to:20,current_page:1,last_page:2,per_page:20}}))};
    TestBed.configureTestingModule({providers:[provideRouter([]),{provide:AdminWorkspaceService,useValue:service},{provide:DepartamentoService,useValue:{getAll:()=>of([{id:'salud',nombre:'Salud'}])}},{provide:ActivatedRoute,useValue:{queryParamMap:of(convertToParamMap({}))}}]});
    const fixture=TestBed.createComponent(WorkspacePublicationsComponent);fixture.detectChanges();return {fixture,component:fixture.componentInstance,service};
  }
  it('muestra artículos, libros y reportes en Todos los tipos y usa veinte por página',()=>{
    const {fixture,service}=setup();const text=fixture.nativeElement.textContent;
    expect(text).toContain('Artículo');expect(text).toContain('Libro PDF');expect(text).toContain('Reporte Power BI');expect(text).toContain('20 por página');
    expect(fixture.nativeElement.querySelectorAll('tbody tr')).toHaveLength(3);
    expect(service.publications).toHaveBeenCalledWith(expect.objectContaining({tipo:'',page:1}),false);
  });
  it('envía filtros combinados, vuelve a la primera página y permite limpiar el tipo',()=>{
    vi.useFakeTimers();
    try{
      const {component,fixture,service}=setup();component.changePage(1);
      component.form.patchValue({tipo:'LIBRO',departamento_id:'salud',q:'Manual'});vi.advanceTimersByTime(301);fixture.detectChanges();
      expect(service.publications).toHaveBeenLastCalledWith({tipo:'LIBRO',departamento_id:'salud',q:'Manual',estado:'',page:1},false);
      component.form.controls.tipo.setValue('');vi.advanceTimersByTime(301);
      expect(service.publications).toHaveBeenLastCalledWith(expect.objectContaining({tipo:'',departamento_id:'salud',q:'Manual',page:1}),false);
    }finally{vi.useRealTimers();}
  });
  it('presenta el botón Editar con engranaje y conserva el enlace al formulario de cada publicación',()=>{
    const {fixture}=setup();const button=fixture.nativeElement.querySelector('a.btn-publication-edit');
    expect(button.textContent).toContain('settings');expect(button.textContent).toContain('Editar');
    expect(button.getAttribute('aria-label')).toBe('Editar Contenido ARTICULO');
    expect(button.getAttribute('href')).toBe('/admin/departamentos/salud?editar_publicacion=p0');
  });
  it('mantiene el estado elegido al paginar y permite recuperar un error',()=>{
    const {component,service,fixture}=setup();component.setStatus('EN_REVISION');component.changePage(1);
    expect(service.publications).toHaveBeenLastCalledWith(expect.objectContaining({estado:'EN_REVISION',page:2}),false);
    service.publications.mockReturnValueOnce(throwError(()=>new Error('offline')) as any);component.load();fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role=alert]')).not.toBeNull();component.load();fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('table')).not.toBeNull();
  });
});

beforeEach(() => TestBed.configureTestingModule({providers:[{provide:AuthService,useValue:{isAdmin:()=>true,isEditor:()=>false}}]}));
