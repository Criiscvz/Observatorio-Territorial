import { TestBed } from '@angular/core/testing';
import { ActivatedRoute,convertToParamMap,provideRouter,Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { of,Subject,throwError } from 'rxjs';
import { AtlasCategoriaService } from '@core/services/atlas-categoria.service';
import { AtlasEnlaceService } from '@core/services/atlas-enlace.service';
import { PublicationViewerService } from '../components/publication-viewer.service';
import { AtlasDestinationComponent } from './atlas-destination.component';

describe('Crear Atlas desde el inicio',()=>{
  const categories=[{id:'ambiente',nombre:'Ambiente',descripcion:'Territorio'},{id:'ciencia',nombre:'Ciencia y Tecnología',descripcion:null}];
  function setup(query:Record<string,string>={}){
    const api={list:vi.fn(()=>of(categories))};
    const links={save:vi.fn((_data?:unknown)=>of({id:'nuevo',titulo:'Atlas ambiental',codigo:'ATL-0012'} as any))};
    const viewer={open:vi.fn()};const dialog={open:vi.fn(()=>({afterClosed:()=>of(false)}))};
    TestBed.configureTestingModule({providers:[provideRouter([]),{provide:ActivatedRoute,useValue:{snapshot:{queryParamMap:convertToParamMap(query)}}},
      {provide:AtlasCategoriaService,useValue:api},{provide:AtlasEnlaceService,useValue:links},{provide:PublicationViewerService,useValue:viewer},{provide:MatDialog,useValue:dialog}]});
    const fixture=TestBed.createComponent(AtlasDestinationComponent);fixture.detectChanges();const component=fixture.componentInstance;
    const open=()=>{component.destinationForm.controls.categoria.setValue('ambiente');component.openForm();fixture.detectChanges();};
    const fill=()=>component.form.patchValue({titulo:' Atlas ambiental ',fecha_publicacion:'2026-10-28',link_url:' https://app.powerbi.com/view?r=ambiental ',fuente:' ULEAM ',descripcion:' Indicadores ambientales '});
    return {fixture,component,api,links,viewer,dialog,open,fill};
  }
  it('exige categoría disponible, muestra solo Atlas y abre el formulario con el destino en grande',()=>{
    const {fixture,component,open}=setup();const el=fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.fixed-type')?.textContent).toContain('Atlas');expect(el.querySelector('.editor')).toBeNull();
    expect(el.querySelector('.form-footer button')?.hasAttribute('disabled')).toBe(true);
    component.destinationForm.controls.categoria.setValue('ajena');component.openForm();expect(component.destination()).toBeNull();
    open();expect(el.querySelector('#atlas-editor-title')?.textContent).toBe('Ambiente');
    expect(component.destinationForm.disabled).toBe(true);expect(el.querySelector('.creation-grid.editor-open')).toBeTruthy();
    expect(el.querySelector('input[type=file]')).toBeNull();expect(el.querySelector('[name=estado]')).toBeNull();
  });
  it('respeta una categoría preseleccionada y descarta categorías inexistentes de la URL',()=>{
    const {component}=setup({categoria:'ciencia'});expect(component.destinationForm.controls.categoria.value).toBe('ciencia');
    component.openForm();expect(component.destination()?.nombre).toBe('Ciencia y Tecnología');
    component.closeForm();component.destinationForm.controls.categoria.setValue('eliminada');component.load();expect(component.destinationForm.controls.categoria.value).toBe('');
  });
  it('permite reintentar la carga sin abrir un destino incompleto',()=>{
    const {component,api}=setup();api.list.mockReturnValueOnce(throwError(()=>new Error('offline')));component.load();
    component.destinationForm.controls.categoria.setValue('ambiente');component.openForm();expect(component.destination()).toBeNull();expect(component.loadError()).toBe(true);
    component.load();expect(component.loadError()).toBe(false);component.openForm();expect(component.destination()?.id).toBe('ambiente');
  });
  it.each(['javascript:alert(1)','http://app.powerbi.com/view?r=x','https://app.powerbi.com.evil.test/view?r=x','https://example.test/atlas'])('no guarda ni previsualiza un enlace incompatible: %s',url=>{
    const {component,links,viewer,open,fill}=setup();open();fill();component.form.controls.link_url.setValue(url);component.submit();component.preview();
    expect(links.save).not.toHaveBeenCalled();expect(viewer.open).not.toHaveBeenCalled();expect(component.fieldError('link_url')).toContain('Power BI');
  });
  it('valida obligatorios y límites antes de guardar',()=>{
    const {component,links,open,fill}=setup();open();component.submit();expect(component.fieldError('titulo')).toBeTruthy();expect(links.save).not.toHaveBeenCalled();
    fill();component.form.patchValue({titulo:'x'.repeat(256),descripcion:'x'.repeat(3001),fuente:'x'.repeat(256)});component.submit();expect(links.save).not.toHaveBeenCalled();
  });
  it('guarda el enlace en la categoría elegida y muestra el código y acceso a su biblioteca',()=>{
    const {fixture,component,links,open,fill}=setup();open();fill();component.submit();fixture.detectChanges();
    expect(links.save).toHaveBeenCalledWith({atlas_categoria_id:'ambiente',titulo:'Atlas ambiental',fecha_publicacion:'2026-10-28',link_url:'https://app.powerbi.com/view?r=ambiental',fuente:'ULEAM',descripcion:'Indicadores ambientales'});
    expect(fixture.nativeElement.querySelector('.success').textContent).toContain('ATL-0012');
    expect(fixture.nativeElement.querySelector('.success a').getAttribute('href')).toBe('/admin/atlas/categorias/ambiente');
    component.submit();expect(links.save).toHaveBeenCalledOnce();expect(component.canLeave()).toBe(true);
    component.createAnother();expect(component.saved()).toBeNull();expect(component.form.pristine).toBe(true);expect(component.destination()?.id).toBe('ambiente');
  });
  it('conserva los datos y los errores del servidor al fallar el guardado',()=>{
    const {component,links,open,fill}=setup();open();fill();links.save.mockReturnValueOnce(throwError(()=>({error:{errors:{link_url:['Enlace no válido']}}})));
    component.submit();expect(component.saving()).toBe(false);expect(component.fieldError('link_url')).toBe('Enlace no válido');expect(component.form.controls.titulo.value).toContain('Atlas ambiental');expect(component.saved()).toBeNull();
    component.form.controls.link_url.setValue('https://app.powerbi.com/view?r=corregido');expect(component.fieldError('link_url')).toBe('');component.submit();expect(component.saved()).toBeTruthy();
  });
  it('evita duplicados y salir durante un guardado pendiente',()=>{
    const {component,links,open,fill}=setup();open();fill();const pending=new Subject<any>();links.save.mockReturnValue(pending);
    component.submit();component.submit();component.requestClose();component.closeForm();expect(links.save).toHaveBeenCalledOnce();expect(component.canLeave()).toBe(false);expect(component.destination()).toBeTruthy();
    pending.next({id:'nuevo',titulo:'Atlas',codigo:'ATL-0012'});expect(component.saving()).toBe(false);
  });
  it('permite modificar destino sin perder el borrador hasta confirmar que se descarta',()=>{
    const {component,dialog,open,fill}=setup();open();fill();component.form.markAsDirty();component.requestClose();expect(component.confirmClose()).toBe(true);expect(component.destination()).toBeTruthy();
    expect(component.canLeave()).not.toBe(true);expect(dialog.open).toHaveBeenCalledOnce();
    component.closeForm();expect(component.destination()).toBeNull();expect(component.destinationForm.enabled).toBe(true);expect(component.form.controls.titulo.value).toBe('');
    component.destinationForm.controls.categoria.setValue('ciencia');component.openForm();expect(component.destination()?.nombre).toBe('Ciencia y Tecnología');
  });
  it('prueba el enlace con el visor real, la categoría y los datos escritos, sin guardar',()=>{
    const {component,links,viewer,open,fill}=setup();open();fill();component.preview();
    expect(viewer.open).toHaveBeenCalledWith(expect.objectContaining({title:'Atlas ambiental',code:'Sin guardar',reportUrl:'https://app.powerbi.com/view?r=ambiental',description:'Indicadores ambientales'}),'Ambiente','report','atlas');
    expect(links.save).not.toHaveBeenCalled();
  });
});
