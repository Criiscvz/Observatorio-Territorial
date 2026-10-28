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
  function setup(options: {mobile?:boolean; status?:number; mode?:'pdf'|'report'; report?:string; pending?:Subject<ArrayBuffer>; locked?:boolean; context?:'atlas'; localPdf?:File; description?:string; emptyOutline?:boolean; outlineFailure?:boolean} = {}) {
    const item=toPublicLibraryItem({id:'lib',tipo:'LIBRO',titulo:'Libro real',autores:['Ana'],codigo:'LIB-1',descripcion:options.description,fecha_publicacion:'2026-10-20',fuente:'ULEAM',download_url:'/api/departamentos/publicaciones/lib/download',bloqueado:options.locked} as any,'LIBRO',true);
    if(options.report) item.reportUrl=options.report;
    if(options.localPdf){item.download_url=null;item.sharepoint_url=null;}
    const loadPdf=vi.fn(() => options.pending || (options.status ? throwError(() => new HttpErrorResponse({status:options.status})) : of(new ArrayBuffer(8))));
    const render=vi.fn(() => ({promise:Promise.resolve(),cancel:vi.fn()}));
    const pdf={numPages:3,getPage:vi.fn(async () => ({getViewport:({scale}:any)=>({width:600*scale,height:800*scale}),render})),getOutline:vi.fn(async()=>{if(options.outlineFailure)throw new Error('Unreadable outline');return options.emptyOutline?null:[{title:'Contenido',dest:[1],items:[]}];})};
    const task={promise:Promise.resolve(pdf),destroy:vi.fn(async()=>undefined)};
    const engine={open:vi.fn(async()=>task)}; const ref={updateSize:vi.fn(),close:vi.fn(),addPanelClass:vi.fn(),removePanelClass:vi.fn(),disableClose:false};
    TestBed.configureTestingModule({providers:[{provide:MAT_DIALOG_DATA,useValue:{item,departmentName:'Salud',mode:options.mode||'pdf',context:options.context,localPdf:options.localPdf}},
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
  it('usa toda la ventana móvil con ficha e índice abiertos y sin un botón para desplegarlos',()=>{
    const {element,ref}=setup({mobile:true}); expect(ref.updateSize).toHaveBeenCalledWith('100vw','100dvh');
    expect(element.querySelector('#reader-info')).toBeTruthy();
    expect(element.querySelector('.reader-index')).toBeTruthy();
    expect(element.querySelector('[aria-label="Ficha e índice"]')).toBeNull();
  });
  it.each([390, 1366, 1920])('ajusta el PDF al ancho disponible de %s px al navegar en pantalla completa', async width => {
    const {component,fixture,element}=setup({mobile:width<680});
    await vi.waitFor(()=>expect(component.total()).toBe(3));
    const area=element.querySelector<HTMLElement>('.reader-document')!;
    Object.defineProperty(area,'clientWidth',{configurable:true,value:width});
    nativeFullscreen(element);
    await component.toggleFullscreen();fixture.detectChanges();
    await component.render();
    const canvas=element.querySelector('canvas')!;
    expect(element.querySelector('#reader-info')).toBeNull();
    expect(parseFloat(canvas.style.width)).toBe(width);
    component.go(2);await component.render();
    expect(component.page()).toBe(2);
    expect(parseFloat(canvas.style.width)).toBe(width);
    component.setZoom('125');await component.render();
    expect(parseFloat(canvas.style.width)).toBe(750);
    component.setZoom('fit');await component.render();
    expect(parseFloat(canvas.style.width)).toBe(width);
    expect(canvas.width*canvas.height).toBeLessThanOrEqual(16_000_000);
    expect(area.tabIndex).toBe(0);
    await component.leaveFullscreen();fixture.detectChanges();await component.render();
    expect(parseFloat(canvas.style.width)).toBe(width-32);
  });
  it('muestra primero la descripción completa y los metadatos que llegan del formulario', () => {
    const description='Objetivos y metodología del estudio.\n'+ 'Resultados y recomendaciones del observatorio. '.repeat(25);
    const {element,component}=setup({description});
    expect(element.querySelector('.reader-description p')?.textContent).toBe(description.trim());
    expect(element.querySelector('.reader-description')!.compareDocumentPosition(element.querySelector('.reader-metadata')!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const values=Array.from(element.querySelectorAll('.reader-metadata dd')).map(el=>el.textContent?.trim());
    expect(values).toEqual(['Salud','Ana','20/10/2026','ULEAM']);
    component.selectMode('report');
    expect(element.querySelector('#reader-info')).toBeTruthy();
  });
  it('explica la ausencia de descripción y usa el índice real para ir a otra página', async () => {
    const {fixture,element,component}=setup();
    await vi.waitFor(()=>expect(component.outline()).toHaveLength(1));fixture.detectChanges();
    expect(element.querySelector('.reader-description p')?.textContent).toContain('Sin descripción registrada.');
    element.querySelector<HTMLButtonElement>('.reader-index li button')!.click();fixture.detectChanges();
    expect(component.page()).toBe(2);
    expect(element.querySelector('.reader-index [aria-current="page"]')?.textContent).toContain('Contenido');
  });
  it('no inventa un índice si el PDF no tiene marcadores', async () => {
    const {fixture,component,element,pdf}=setup({emptyOutline:true});
    await vi.waitFor(()=>{expect(pdf.getOutline).toHaveBeenCalled();expect(component.outlineLoading()).toBe(false);});fixture.detectChanges();
    expect(component.outline()).toEqual([]);
    expect(element.querySelector('.reader-index')?.textContent).toContain('no incluye marcadores');
    expect(element.querySelector('.reader-index ol')).toBeNull();
  });
  it('distingue un índice ausente de un fallo de lectura sin impedir leer el PDF', async () => {
    const {fixture,component,element}=setup({outlineFailure:true});
    await vi.waitFor(()=>expect(component.outlineError()).toBe(true));fixture.detectChanges();
    expect(component.total()).toBe(3);expect(component.error()).toBe('');
    expect(element.querySelector('.reader-index')?.textContent).toContain('No se pudo cargar el índice');
  });
  it.each([403,404,409,500])('presenta el error HTTP %s con reintento y no intenta renderizar el archivo',async(status)=>{
    const {component,fixture,element,engine}=setup({status}); await vi.waitFor(()=>expect(component.error()).not.toBe('')); fixture.detectChanges();
    expect(engine.open).not.toHaveBeenCalled(); expect(element.querySelector('[role="alert"]')).toBeTruthy(); expect(element.textContent).toContain('Reintentar');
  });
  it('cancela una descarga en curso al cerrar y no crea el worker después',async()=>{
    const pending=new Subject<ArrayBuffer>(); const {fixture,engine}=setup({pending}); expect(pending.observed).toBe(true);
    fixture.destroy(); expect(pending.observed).toBe(false); pending.next(new ArrayBuffer(4)); await Promise.resolve(); expect(engine.open).not.toHaveBeenCalled();
  });
  it('lee un archivo local con paginación sin solicitar la API y libera el documento al cerrar',async()=>{
    const bytes=new ArrayBuffer(12);const localPdf=new File(['%PDF-1.4'],'vista-previa.pdf',{type:'application/pdf'});
    Object.defineProperty(localPdf,'arrayBuffer',{value:vi.fn(async()=>bytes)});
    const {component,fixture,loadPdf,engine,element,task}=setup({localPdf});
    await vi.waitFor(()=>expect(component.total()).toBe(3));fixture.detectChanges();
    expect(loadPdf).not.toHaveBeenCalled();expect(engine.open).toHaveBeenCalledWith(bytes);
    expect(element.querySelector('.reader-status')?.textContent).toContain('Vista previa');
    component.go(2);expect(component.page()).toBe(2);
    fixture.destroy();expect(task.destroy).toHaveBeenCalledOnce();
  });
  it('descarta una lectura local pendiente si el visor se cierra antes de terminar',async()=>{
    let finish!:(bytes:ArrayBuffer)=>void;
    const localPdf=new File(['%PDF-1.4'],'pendiente.pdf',{type:'application/pdf'});
    Object.defineProperty(localPdf,'arrayBuffer',{value:()=>new Promise<ArrayBuffer>(resolve=>finish=resolve)});
    const {fixture,engine,loadPdf}=setup({localPdf});fixture.destroy();finish(new ArrayBuffer(8));await Promise.resolve();
    expect(engine.open).not.toHaveBeenCalled();expect(loadPdf).not.toHaveBeenCalled();
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
    fixture.detectChanges();
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
    component.go(2);component.setZoom('125');
    const canvas=element.querySelector('canvas');
    await component.toggleFullscreen();fixture.detectChanges();
    expect(native.enter).toHaveBeenCalledOnce();expect(component.fullscreen()).toBe(true);
    expect(element.classList.contains('reader-fullscreen')).toBe(true);
    expect(ref.addPanelClass).toHaveBeenCalledWith('publication-reader-expanded');expect(ref.disableClose).toBe(true);
    expect(ref.updateSize).toHaveBeenLastCalledWith('100vw','100dvh');
    expect(element.querySelector('[aria-label="Salir de pantalla completa"]')).toBeTruthy();
    expect(element.querySelector('#reader-info')).toBeNull();
    expect(element.querySelector('canvas')).toBe(canvas);
    await component.leaveFullscreen();fixture.detectChanges();
    expect(native.exit).toHaveBeenCalledOnce();expect(component.fullscreen()).toBe(false);
    expect(ref.updateSize).toHaveBeenLastCalledWith('calc(100vw - 40px)','calc(100dvh - 32px)');
    expect(ref.disableClose).toBe(false);expect(component.page()).toBe(2);expect(component.zoom()).toBe('125');expect(element.querySelector('#reader-info')).toBeTruthy();
    expect(element.querySelector('canvas')).toBe(canvas);
    expect(element.querySelector('.reader-index')).toBeTruthy();
  });
  it('usa toda la ventana cuando el navegador rechaza pantalla completa y Escape regresa al visor',async()=>{
    const {component,fixture,element,ref}=setup({mode:'report',report:'https://app.powerbi.com/view?r=publico'});
    element.requestFullscreen=vi.fn(async()=>{throw new Error('Unavailable');});
    await component.toggleFullscreen();expect(component.fullscreen()).toBe(true);
    fixture.detectChanges();expect(element.querySelector('#reader-info')).toBeNull();
    const event=new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true});document.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);expect(component.fullscreen()).toBe(false);expect(ref.close).not.toHaveBeenCalled();
    fixture.detectChanges();expect(element.querySelector('#reader-info')).toBeTruthy();
  });
  it('responde a la salida nativa por Escape sin cerrar la biblioteca ni recargar Power BI',async()=>{
    const {component,fixture,element,ref}=setup({mode:'report',report:'https://app.powerbi.com/view?r=publico'});
    const frame=element.querySelector('iframe');const native=nativeFullscreen(element);
    await component.toggleFullscreen();fixture.detectChanges();expect(element.querySelector('iframe')).toBe(frame);
    expect(element.querySelector('#reader-info')).toBeNull();
    native.setActive(null);fixture.detectChanges();expect(component.fullscreen()).toBe(false);
    expect(ref.close).not.toHaveBeenCalled();expect(element.querySelector('iframe')).toBe(frame);
    expect(element.querySelector('#reader-info')).toBeTruthy();
  });
  it('libera pantalla completa al destruir el lector y conserva el tamaño móvil al volver',async()=>{
    const {component,fixture,element,ref}=setup({mobile:true});const native=nativeFullscreen(element);
    await component.toggleFullscreen();fixture.detectChanges();
    expect(element.querySelector('#reader-info')).toBeNull();
    await component.leaveFullscreen();fixture.detectChanges();
    expect(element.querySelector('#reader-info')).toBeTruthy();
    expect(ref.updateSize).toHaveBeenLastCalledWith('100vw','100dvh');
    await component.toggleFullscreen();fixture.destroy();expect(native.exit).toHaveBeenCalledTimes(2);
  });
});
