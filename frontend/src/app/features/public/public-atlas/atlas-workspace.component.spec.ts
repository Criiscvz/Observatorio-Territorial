import { publicationPage } from '../../../testing/publication-page.fixture';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { OverlayContainer } from '@angular/cdk/overlay';
import { MatSnackBar } from '@angular/material/snack-bar';
import { of, Subject, throwError } from 'rxjs';
import { AtlasCategoriaService } from '@core/services/atlas-categoria.service';
import { AtlasEnlaceService } from '@core/services/atlas-enlace.service';
import { PublicacionService } from '@core/services/publicacion.service';
import { AtlasWorkspaceComponent, atlasHttpUrl } from './atlas-workspace.component';
import { FormControl } from '@angular/forms';
import { PublicationViewerService } from '../components/publication-viewer.service';

describe('Gestión de Atlas por categorías',()=>{
  const categories=Array.from({length:12},(_,i)=>({id:`c${i+1}`,nombre:`Categoría ${i+1}`,descripcion:'Información territorial',publico:i!==1,publicacion_destacada_id:i===0?'p1':null}));
  const publications=Array.from({length:25},(_,i)=>({id:`p${i+1}`,atlas_categoria_id:'c1',tipo:'ATLAS',estado:'PUBLICACION',solo_suscriptores:false,titulo:`Atlas ${i+1}`,codigo:`ATL-${i+1}`,fecha_publicacion:'2026-10-20',link_url:`https://example.test/atlas/${i+1}`,fuente:'ULEAM'}));
  function setup(category='',items:any[]=publications){
    const links={save:vi.fn((_data?:unknown,_id?:string)=>of({...publications[0]}))};
    const categoryService={directory:vi.fn(()=>of({data:categories.map(c=>({...c,publicaciones_total:items.filter(p=>p.atlas_categoria_id===c.id).length})),unassigned_total:items.filter(p=>!p.atlas_categoria_id).length})),save:vi.fn(()=>of({data:categories[0],message:'Guardada'})),delete:vi.fn(()=>of({message:'Eliminada'}))};
    const pubService={atlasPage:vi.fn((categoryId:string,page:number,q:string)=>of(publicationPage(items.filter(item=>item.atlas_categoria_id===categoryId),{page,q}))),openPdf:vi.fn(()=>of(true)),delete:vi.fn(()=>of({message:'Eliminado'}))};
    const viewer={open:vi.fn()};const snackbar={open:vi.fn()};
    TestBed.configureTestingModule({providers:[provideRouter([]),{provide:ActivatedRoute,useValue:{paramMap:of(convertToParamMap(category?{categoria:category}:{})),queryParamMap:of(convertToParamMap({})),snapshot:{queryParamMap:convertToParamMap({}),url:[]}}},{provide:AtlasCategoriaService,useValue:categoryService},{provide:AtlasEnlaceService,useValue:links},{provide:PublicacionService,useValue:pubService},{provide:MatSnackBar,useValue:snackbar},{provide:PublicationViewerService,useValue:viewer}]});
    TestBed.overrideComponent(AtlasWorkspaceComponent,{add:{providers:[{provide:MatSnackBar,useValue:snackbar}]}});
    const fixture=TestBed.createComponent(AtlasWorkspaceComponent);fixture.detectChanges();
    return {fixture,component:fixture.componentInstance,links,categoryService,pubService,viewer,snackbar,overlay:TestBed.inject(OverlayContainer).getContainerElement()};
  }
  it('pagina categorías de diez en diez y mantiene gestionar, editar, eliminar y visibilidad',()=>{
    const {fixture,component}=setup();
    expect(fixture.nativeElement.querySelectorAll('.directory tbody tr').length).toBe(10);
    expect(fixture.nativeElement.querySelector('a.manage').getAttribute('href')).toBe('/admin/atlas/categorias/c1');
    expect(fixture.nativeElement.textContent).toContain('Privada');
    component.changePage(1);fixture.detectChanges();expect(fixture.nativeElement.querySelectorAll('.directory tbody tr').length).toBe(2);
    component.updateSearch('Categoría 12');fixture.detectChanges();expect(component.currentPage()).toBe(0);expect(component.total()).toBe(1);
  });
  it('preselecciona la categoría y pagina veinte registros sin selección exclusiva para el portal',()=>{
    const {component,fixture}=setup('c1');
    expect(fixture.nativeElement.querySelector('.atlas-current')).toBeNull();expect(fixture.nativeElement.querySelector('.show-button')).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('No seleccionado');
    expect(fixture.nativeElement.querySelectorAll('.library tbody tr').length).toBe(20);
    component.changePage(1);fixture.detectChanges();expect(fixture.nativeElement.querySelectorAll('.library tbody tr').length).toBe(5);
    component.openLink();expect(component.linkForm.controls.atlas_categoria_id.value).toBe('c1');expect(component.linkForm.contains('mostrar_en_portal')).toBe(false);
  });
  it('envía también el formulario de categoría desde la ventana',()=>{
    const {component,categoryService,overlay,fixture}=setup();component.openCategory();fixture.detectChanges();
    component.categoryForm.patchValue({nombre:' Categoría nueva ',publico:true});
    overlay.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
    expect(categoryService.save).toHaveBeenCalledWith(expect.objectContaining({nombre:'Categoría nueva',publico:true}),undefined);
  });
  it('valida URL, título y categoría antes de guardar sin pedir PDF',()=>{
    const {component,links,overlay,fixture}=setup('c1');component.openLink();fixture.detectChanges();
    component.linkForm.patchValue({titulo:' ',link_url:'javascript:alert(1)'});component.save();expect(links.save).not.toHaveBeenCalled();
    component.linkForm.patchValue({titulo:'Nuevo Atlas',link_url:'https://example.test/nuevo'});
    overlay.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
    expect(links.save).toHaveBeenCalledWith(expect.objectContaining({atlas_categoria_id:'c1',titulo:'Nuevo Atlas',link_url:'https://example.test/nuevo'}),undefined);
    expect(links.save.mock.calls[0][0]).not.toHaveProperty('mostrar_en_portal');
    expect(overlay.textContent).not.toContain('Mostrar este Atlas');
    expect(overlay.querySelector('input[type=file]')).toBeNull();
  });
  it('mantiene los datos al fallar el guardado y evita peticiones duplicadas',()=>{
    const {component,links}=setup('c1');component.openLink();component.linkForm.patchValue({titulo:'Atlas conservado',link_url:'https://example.test/a'});
    links.save.mockReturnValueOnce(throwError(()=>({error:{errors:{link_url:['Dirección no permitida']}}})) as any);
    component.save();expect(component.formError()).toBe('Dirección no permitida');expect(component.linkForm.controls.titulo.value).toBe('Atlas conservado');
    const pending=new Subject<any>();links.save.mockReturnValue(pending);component.save();component.save();expect(links.save).toHaveBeenCalledTimes(2);pending.complete();
  });
  it('conserva PDF anteriores y muestra el formulario en una ventana con contenido desplazable y pie separado',()=>{
    const legacy={...publications[0],link_url:null,download_url:'/api/departamentos/publicaciones/p1/download'};
    const {component,overlay,fixture}=setup('c1',[legacy]);component.openLink(legacy as any);fixture.detectChanges();
    expect(overlay.querySelector('mat-dialog-content')).not.toBeNull();expect(overlay.querySelector('.atlas-file-note')?.textContent).toContain('se conserva');
    expect(overlay.querySelector('mat-dialog-content .atlas-editor-footer')).toBeNull();expect(overlay.querySelector('.atlas-editor-footer')).not.toBeNull();
    component.linkForm.markAsDirty();component.closeEditor();fixture.detectChanges();expect(overlay.textContent).toContain('Hay cambios sin guardar');
  });
  it('Ver Atlas abre el visor superpuesto de Power BI con su categoría y ficha, sin abrir otra pestaña',()=>{
    const item={...publications[0],link_url:'https://app.powerbi.com/view?r=atlas-prueba',descripcion:'Indicadores de ambiente',autores:['Ana','Luis']};
    const {fixture,viewer,pubService}=setup('c1',[item]);const open=vi.spyOn(window,'open').mockImplementation(()=>null);
    fixture.nativeElement.querySelector('button[aria-label="Ver Atlas Atlas 1"]').click();
    expect(viewer.open).toHaveBeenCalledWith(expect.objectContaining({id:'p1',title:'Atlas 1',code:'ATL-1',reportUrl:item.link_url,description:item.descripcion,authors:'Ana, Luis',source:'ULEAM',locked:false}),'Categoría 1','report','atlas');
    expect(open).not.toHaveBeenCalled();expect(pubService.openPdf).not.toHaveBeenCalled();open.mockRestore();
  });
  it('abre PDF conservados en el mismo visor sin perder el contexto de gestión',()=>{
    const item={...publications[0],link_url:null,download_url:'/api/departamentos/publicaciones/p1/download?context=management'};
    const {component,viewer,pubService}=setup('c1',[item]);component.openAtlas(item as any);
    expect(viewer.open).toHaveBeenCalledWith(expect.objectContaining({download_url:item.download_url,reportUrl:null}),'Categoría 1','pdf','atlas');
    expect(pubService.openPdf).not.toHaveBeenCalled();
  });
  it.each(['javascript:alert(1)','https://app.powerbi.com.evil.test/view?r=x','https://example.test/atlas'])('avisa cuando el enlace no se puede visualizar: %s',link_url=>{
    const item={...publications[0],link_url};const {component,viewer,snackbar}=setup('c1',[item]);component.openAtlas(item as any);
    expect(viewer.open).not.toHaveBeenCalled();expect(snackbar.open).toHaveBeenCalledWith(expect.stringContaining('Power BI'),'Cerrar',expect.anything());
  });
  it('respeta el acceso y los datos vigentes aunque el botón conserve un objeto anterior',()=>{
    const item={...publications[0],link_url:'https://app.powerbi.com/view?r=actual'};
    const {component,viewer}=setup('c1',[item]);
    component.publications.set([{...item,bloqueado:true}] as any);component.openAtlas(item as any);expect(viewer.open).not.toHaveBeenCalled();
    component.publications.set([{...item,atlas_categoria_id:'c2'}] as any);component.openAtlas(item as any);expect(viewer.open).not.toHaveBeenCalled();
    component.publications.set([{...item,titulo:'Título actualizado'}] as any);component.openAtlas(item as any);
    expect(viewer.open).toHaveBeenCalledWith(expect.objectContaining({title:'Título actualizado'}),'Categoría 1','report','atlas');
    expect(atlasHttpUrl(new FormControl('ftp://example.test'))).toEqual({httpUrl:true});
  });
});
