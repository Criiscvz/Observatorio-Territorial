import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { BreakpointObserver } from '@angular/cdk/layout';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { of, Subject, throwError } from 'rxjs';
import { PublicacionService } from '@core/services/publicacion.service';
import { PdfEngineService } from './pdf-engine.service';
import { powerBiEmbedUrl, PublicationViewerComponent } from './publication-viewer.component';
import { toPublicLibraryItem } from './public-library-publication';

describe('Visor superpuesto de publicaciones', () => {
  function setup(options: {mobile?:boolean; status?:number; mode?:'pdf'|'report'; report?:string; pending?:Subject<ArrayBuffer>; locked?:boolean; context?:'atlas'} = {}) {
    const item=toPublicLibraryItem({id:'lib',tipo:'LIBRO',titulo:'Libro real',autores:['Ana'],codigo:'LIB-1',download_url:'/api/departamentos/publicaciones/lib/download',bloqueado:options.locked} as any,'LIBRO',true);
    if(options.report) item.reportUrl=options.report;
    const loadPdf=vi.fn(() => options.pending || (options.status ? throwError(() => new HttpErrorResponse({status:options.status})) : of(new ArrayBuffer(8))));
    const render=vi.fn(() => ({promise:Promise.resolve(),cancel:vi.fn()}));
    const pdf={numPages:3,getPage:vi.fn(async () => ({getViewport:({scale}:any)=>({width:600*scale,height:800*scale}),render})),getOutline:vi.fn(async()=>[{title:'Contenido',dest:[1],items:[]}])};
    const task={promise:Promise.resolve(pdf),destroy:vi.fn(async()=>undefined)};
    const engine={open:vi.fn(async()=>task)}; const ref={updateSize:vi.fn(),close:vi.fn(),addPanelClass:vi.fn(),removePanelClass:vi.fn(),disableClose:false};
    TestBed.configureTestingModule({providers:[{provide:MAT_DIALOG_DATA,useValue:{item,departmentName:'Salud',mode:options.mode||'pdf',context:options.context}},
      {provide:PublicacionService,useValue:{loadPdf}}, {provide:PdfEngineService,useValue:engine}, {provide:MatDialogRef,useValue:ref},
      {provide:BreakpointObserver,useValue:{observe:()=>of({matches:!!options.mobile})}}]});
    const fixture=TestBed.createComponent(PublicationViewerComponent); fixture.detectChanges();
    return {fixture,component:fixture.componentInstance,element:fixture.nativeElement as HTMLElement,loadPdf,engine,task,pdf,render,ref,item};
  }
  it('carga el PDF por la API, pagina, valida límites, cambia zoom y libera el documento al cerrar',async()=>{
    const {fixture,component,loadPdf,item,pdf,task,render,element}=setup();
    await vi.waitFor(()=>expect(component.total()).toBe(3));
    await fixture.whenStable();
    expect(loadPdf).toHaveBeenCalledWith(item); expect(element.querySelector('canvas')).toBeTruthy();
    component.go(2); await vi.waitFor(()=>expect(pdf.getPage).toHaveBeenCalledWith(2));
    for(const n of [0,4,'mal','1.5']) component.go(n); expect(component.page()).toBe(2);
    component.setZoom('125'); await fixture.whenStable(); expect(component.zoom()).toBe('125');
    expect(render).toHaveBeenCalled();
    await vi.waitFor(()=>expect(component.outline()).toEqual([{title:'Contenido',page:2}]));
    fixture.destroy(); expect(task.destroy).toHaveBeenCalled();
  });
  it('usa pantalla completa en móvil y conserva la ficha plegada para dar espacio al documento',()=>{
    const {component,ref}=setup({mobile:true}); expect(ref.updateSize).toHaveBeenCalledWith('100vw','100dvh');
    expect(component.info()).toBe(false); component.toggleInfo(); expect(component.info()).toBe(true);
  });
  it.each([403,404,409,500])('presenta el error HTTP %s con reintento y no intenta renderizar el archivo',async(status)=>{
    const {component,fixture,element,engine}=setup({status}); await vi.waitFor(()=>expect(component.error()).not.toBe('')); fixture.detectChanges();
    expect(engine.open).not.toHaveBeenCalled(); expect(element.querySelector('[role="alert"]')).toBeTruthy(); expect(element.textContent).toContain('Reintentar');
  });
  it('cancela una descarga en curso al cerrar y no crea el worker después',async()=>{
    const pending=new Subject<ArrayBuffer>(); const {fixture,engine}=setup({pending}); expect(pending.observed).toBe(true);
    fixture.destroy(); expect(pending.observed).toBe(false); pending.next(new ArrayBuffer(4)); await Promise.resolve(); expect(engine.open).not.toHaveBeenCalled();
  });
  it('bloquea un recurso restringido aunque se abra el componente directamente',()=>{
    const {loadPdf,element}=setup({locked:true}); expect(loadPdf).not.toHaveBeenCalled(); expect(element.querySelector('iframe')).toBeNull();
  });
  it('integra solo un enlace público de Power BI y no descarga PDF mientras se visualiza el reporte',()=>{
    const {element,loadPdf}=setup({mode:'report',report:'https://app.powerbi.com/view?r=publico'});
    expect(element.querySelector('iframe')?.getAttribute('src')).toBe('https://app.powerbi.com/view?r=publico');
    expect(loadPdf).not.toHaveBeenCalled(); expect(element.textContent).not.toContain('Abrir aparte'); expect(element.querySelector('[aria-label="Pantalla completa"]')).toBeTruthy();
  });
  it('rechaza enlaces de iframe ajenos a Power BI y protocolos peligrosos',()=>{
    for(const value of ['javascript:alert(1)','http://app.powerbi.com/view?r=x','https://app.powerbi.com.evil.test/view?r=x','https://app.powerbi.com/groups/x','https://app.powerbi.com/view','https://user:pass@app.powerbi.com/view?r=x']) expect(powerBiEmbedUrl(value)).toBeNull();
    const {element}=setup({mode:'report',report:'https://example.test/report'}); expect(element.querySelector('iframe')).toBeNull(); expect(element.textContent).toContain('no admite visualización integrada');
  });
  it('reutiliza el visor y pantalla completa con las etiquetas y ficha del Atlas',()=>{
    const {element,component,fixture,loadPdf}=setup({mode:'report',report:'https://app.powerbi.com/view?r=atlas',context:'atlas'});
    expect(element.querySelector('[aria-label="Atlas Power BI"] iframe')).toBeTruthy();
    expect(element.textContent).toContain('Atlas interactivo');
    expect(element.textContent).not.toContain('Reporte Power BI');
    expect(element.querySelector('[aria-label="Pantalla completa"]')).toBeTruthy();
    component.toggleInfo(); fixture.detectChanges();
    expect(element.querySelector('#reader-info')?.textContent).toContain('Categoría');
    expect(loadPdf).not.toHaveBeenCalled();
  });

  const originalFullscreen = Object.getOwnPropertyDescriptor(document,'fullscreenElement');
  const originalExit = Object.getOwnPropertyDescriptor(document,'exitFullscreen');
  afterEach(()=>{
    if(originalFullscreen) Object.defineProperty(document,'fullscreenElement',originalFullscreen); else Reflect.deleteProperty(document,'fullscreenElement');
    if(originalExit) Object.defineProperty(document,'exitFullscreen',originalExit); else Reflect.deleteProperty(document,'exitFullscreen');
  });
  function nativeFullscreen(element:HTMLElement) {
    let active:Element|null=null;
    const setActive=(value:Element|null)=>{active=value;document.dispatchEvent(new Event('fullscreenchange'));};
    Object.defineProperty(document,'fullscreenElement',{configurable:true,get:()=>active});
    const exit=vi.fn(async()=>setActive(null)); Object.defineProperty(document,'exitFullscreen',{configurable:true,value:exit});
    const enter=vi.fn(async()=>setActive(element)); element.requestFullscreen=enter;
    return {enter,exit,setActive};
  }
  it('amplía el PDF, conserva página y zoom, y restaura el visor al salir',async()=>{
    const {component,fixture,element,ref}=setup(); const native=nativeFullscreen(element);
    await vi.waitFor(()=>expect(component.total()).toBe(3));
    component.go(2);component.setZoom('125');component.toggleInfo();
    await component.toggleFullscreen();fixture.detectChanges();
    expect(native.enter).toHaveBeenCalledOnce();expect(component.fullscreen()).toBe(true);
    expect(element.classList.contains('reader-fullscreen')).toBe(true);
    expect(ref.addPanelClass).toHaveBeenCalledWith('publication-reader-expanded');expect(ref.disableClose).toBe(true);
    expect(ref.updateSize).toHaveBeenLastCalledWith('100vw','100dvh');
    expect(element.querySelector('[aria-label="Salir de pantalla completa"]')).toBeTruthy();
    await component.leaveFullscreen();fixture.detectChanges();
    expect(native.exit).toHaveBeenCalledOnce();expect(component.fullscreen()).toBe(false);
    expect(ref.updateSize).toHaveBeenLastCalledWith('calc(100vw - 40px)','calc(100dvh - 32px)');
    expect(ref.disableClose).toBe(false);expect(component.page()).toBe(2);expect(component.zoom()).toBe('125');expect(component.info()).toBe(true);
  });
  it('usa toda la ventana cuando el navegador rechaza pantalla completa y Escape regresa al visor',async()=>{
    const {component,element,ref}=setup({mode:'report',report:'https://app.powerbi.com/view?r=publico'});
    element.requestFullscreen=vi.fn(async()=>{throw new Error('Unavailable');});
    await component.toggleFullscreen();expect(component.fullscreen()).toBe(true);
    const event=new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true});document.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);expect(component.fullscreen()).toBe(false);expect(ref.close).not.toHaveBeenCalled();
  });
  it('responde a la salida nativa por Escape sin cerrar la biblioteca ni recargar Power BI',async()=>{
    const {component,fixture,element,ref}=setup({mode:'report',report:'https://app.powerbi.com/view?r=publico'});
    const frame=element.querySelector('iframe');const native=nativeFullscreen(element);
    await component.toggleFullscreen();fixture.detectChanges();expect(element.querySelector('iframe')).toBe(frame);
    native.setActive(null);fixture.detectChanges();expect(component.fullscreen()).toBe(false);
    expect(ref.close).not.toHaveBeenCalled();expect(element.querySelector('iframe')).toBe(frame);
  });
  it('libera pantalla completa al destruir el lector y conserva el tamaño móvil al volver',async()=>{
    const {component,fixture,element,ref}=setup({mobile:true});const native=nativeFullscreen(element);
    await component.toggleFullscreen();await component.leaveFullscreen();
    expect(ref.updateSize).toHaveBeenLastCalledWith('100vw','100dvh');
    await component.toggleFullscreen();fixture.destroy();expect(native.exit).toHaveBeenCalledTimes(2);
  });
});
