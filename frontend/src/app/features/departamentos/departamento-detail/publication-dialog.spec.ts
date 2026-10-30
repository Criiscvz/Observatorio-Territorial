import { publicationPage } from '../../../testing/publication-page.fixture';
import { TestBed } from '@angular/core/testing';
import { OverlayContainer } from '@angular/cdk/overlay';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { of, Subject, throwError } from 'rxjs';
import { AuthService } from '@core/services/auth.service';
import { DatasetService } from '@core/services/dataset.service';
import { DepartamentoService } from '@core/services/departamento.service';
import { PublicacionService } from '@core/services/publicacion.service';
import { ObservatorioPublicacion } from '@core/models/publicacion/publicacion.interface';
import { DepartamentoDetailComponent } from './departamento-detail.component';
import { PublicationViewerService } from '@features/public/components/publication-viewer.service';
import { PdfEngineService } from '@features/public/components/pdf-engine.service';

describe('Ventana central de revisión y edición', () => {
  const publication = (id='rep-1', extra: Partial<ObservatorioPublicacion> = {}): ObservatorioPublicacion => ({
    capabilities:{can_view:true,can_edit:true,can_delete:true,can_review:true}, id, departamento_id:'salud', creado_por:1, creador:{id:1,name:'Administrador',email:'qa@example.test',rol:'ADMIN'},
    tipo:'REPORTE', codigo:'REP-0016', titulo:'Diabetes Mellitus', fecha_publicacion:'2026-09-23',
    estado:'EN_REVISION', solo_suscriptores:false, descripcion:'Descripción actual', fuente:'ULEAM', autores:['Ana Pérez'],
    link_url:'https://app.powerbi.com/view?r=ejemplo', download_url:'/api/publicaciones/'+id+'/download', nombre_archivo_original:'diabetes.pdf', created_at:'',updated_at:'',...extra,
  });
  async function setup(admin=true, supervisor=false) {
    let items: ObservatorioPublicacion[]=[publication(),publication('art-2',{tipo:'ARTICULO',codigo:'ART-0002',titulo:'Atención primaria'})].map(item=>({...item,capabilities:{...item.capabilities!,can_review:admin||supervisor}}));
    const service={
      libraryPage:vi.fn((_id:string,filters:any)=>of(publicationPage(items,filters))),libraryById:vi.fn((_id:string,id:string)=>of(items.find(x=>x.id===id)!)),
      canUpload:vi.fn(()=>of({can_upload:true})),openPdf:vi.fn(()=>of(true)),loadPdf:vi.fn(()=>of(new ArrayBuffer(8))),
      update:vi.fn((id:string, data:FormData)=>{
        const updated={...items.find(x=>x.id===id)!,titulo:String(data.get('titulo')),estado:data.get('estado') as ObservatorioPublicacion['estado'],solo_suscriptores:data.get('solo_suscriptores')==='1'};
        items=items.map(x=>x.id===id?updated:x);return of(updated);
      }),
    };
    const pdfTask={promise:Promise.resolve({numPages:1,getPage:async()=>({getViewport:()=>({width:600,height:800}),render:()=>({promise:Promise.resolve(),cancel:vi.fn()})}),getOutline:async()=>null}),destroy:vi.fn(async()=>undefined)};
    const engine={open:vi.fn(async()=>pdfTask)};
    TestBed.configureTestingModule({imports:[DepartamentoDetailComponent],providers:[
      provideRouter([]),provideTranslateService({fallbackLang:'es'}),
      {provide:ActivatedRoute,useValue:{snapshot:{queryParamMap:convertToParamMap({})},params:of({id:'salud'}),queryParamMap:of(convertToParamMap({}))}},
      {provide:DepartamentoService,useValue:{getById:()=>of({id:'salud',nombre:'Observatorio de la Salud',publico:true,datasets:[]})}},
      {provide:DatasetService,useValue:{}},{provide:PublicacionService,useValue:service},
      {provide:PdfEngineService,useValue:engine},
      {provide:AuthService,useValue:{isAdmin:()=>admin,isEditor:()=>!admin && !supervisor,canReviewObservatory:()=>admin || supervisor,user:()=>({id:1}),hasRoleInDepartamento:()=>true}},
      {provide:MatSnackBar,useValue:{open:vi.fn()}},
    ]});
    const fixture=TestBed.createComponent(DepartamentoDetailComponent);fixture.detectChanges();await fixture.whenStable();
    const component=fixture.componentInstance;
    const container=TestBed.inject(OverlayContainer).getContainerElement();
    const refresh=async()=>{fixture.detectChanges();await fixture.whenStable();};
    const overlay=()=>container.querySelector<HTMLElement>('.publication-dialog')!;
    const click=async(selector:string)=>{const button=overlay().querySelector<HTMLButtonElement>(selector)!;expect(button).not.toBeNull();button.click();await refresh();};
    const change=async(name:string,value:string)=>{const input=overlay().querySelector<HTMLInputElement>(`[name=${name}]`)!;input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}));await refresh();};
    const review=async()=>{component.openReviewPanel();await refresh();};
    const edit=async(item=publication())=>{component.editPublication(item);await refresh();};
    return {fixture,component,service,container,overlay,click,change,refresh,review,edit,engine,setItems:(value:ObservatorioPublicacion[])=>items=value};
  }

  it.each(['ARTICULO','LIBRO'] as const)('abre el visor para el PDF de %s en revisión y conserva el formulario al cerrarlo',async(tipo)=>{
    const {component,container,click,change,refresh,overlay,service,engine}=await setup();
    const url='/api/departamentos/publicaciones/doc/download?context=management';
    component.editPublication(publication('doc',{tipo,download_url:url,solo_suscriptores:true}));await refresh();
    await change('titulo','Cambios pendientes de revisión');await click('.dialog-footer button[type=submit]');
    const form=overlay().querySelector('.dialog-form');
    const external=vi.spyOn(window,'open').mockReturnValue(null);
    try{
      await click('.editor-preview-pdf');
      await vi.waitFor(()=>expect(engine.open).toHaveBeenCalledOnce());
      expect(service.loadPdf).toHaveBeenCalledWith(expect.objectContaining({type:tipo,title:'Cambios pendientes de revisión',download_url:url,locked:false}));
      expect(container.querySelectorAll('.publication-reader-panel')).toHaveLength(1);
      expect(container.querySelectorAll('.publication-workspace-dialog')).toHaveLength(1);
      expect(service.update).not.toHaveBeenCalled();expect(external).not.toHaveBeenCalled();
      container.querySelector<HTMLButtonElement>('[aria-label="Cerrar visor"]')!.click();await refresh();
      await vi.waitFor(()=>expect(container.querySelector('.publication-reader-panel')).toBeNull());
      expect(overlay().querySelector('.dialog-form')).toBe(form);expect(component.editorStep()).toBe(2);
      expect(component.publicationForm.controls.titulo.value).toBe('Cambios pendientes de revisión');
      expect(component.publicationForm.dirty).toBe(true);
    }finally{external.mockRestore();}
  });

  it('visualiza el reemplazo local sin descargar el anterior ni subirlo antes de guardar',async()=>{
    const {component,container,refresh,click,service,engine}=await setup();
    component.editPublication(publication('doc',{tipo:'LIBRO'}));component.editorStep.set(2);await refresh();
    const bytes=new ArrayBuffer(12);const file=new File(['%PDF-1.4'],'nuevo-libro.pdf',{type:'application/pdf'});
    Object.defineProperty(file,'arrayBuffer',{value:vi.fn(async()=>bytes)});
    component.onFileSelected({target:{files:[file]}} as any);await refresh();
    await click('.editor-preview-pdf');await vi.waitFor(()=>expect(engine.open).toHaveBeenCalledWith(bytes));
    expect(service.loadPdf).not.toHaveBeenCalled();expect(service.update).not.toHaveBeenCalled();
    expect(container.querySelector('.reader-footer')?.textContent).toContain('Vista previa local');
    container.querySelector<HTMLButtonElement>('[aria-label="Cerrar visor"]')!.click();await refresh();
    expect(component.selectedFile()).toBe(file);
    await click('.dialog-footer button[type=submit]');
    expect(service.update.mock.calls[0][1].get('archivo')).toBe(file);
  });

  it('no ofrece vista previa sin PDF, para reportes ni para un recurso bloqueado',async()=>{
    const {component,refresh,overlay,service,engine}=await setup();
    for(const extra of [{tipo:'ARTICULO',download_url:null,sharepoint_url:null},{tipo:'REPORTE'},{tipo:'LIBRO',bloqueado:true}] as Partial<ObservatorioPublicacion>[]){
      component.editPublication(publication('doc',extra));component.editorStep.set(2);await refresh();
      expect(overlay().querySelector('.editor-preview-pdf')).toBeNull();component.previewEditorPdf();
    }
    expect(service.loadPdf).not.toHaveBeenCalled();expect(engine.open).not.toHaveBeenCalled();
  });

  it('abre la revisión fuera de la página y pasa a edición en el mismo diálogo sin mover la biblioteca', async()=>{
    const {fixture,container,overlay,review,click,component}=await setup();
    const library=fixture.nativeElement.querySelector('app-observatory-library');await review();
    expect(container.querySelectorAll('.publication-workspace-dialog')).toHaveLength(1);
    expect(fixture.nativeElement.querySelector('.publication-dialog')).toBeNull();
    expect(fixture.nativeElement.querySelector('app-observatory-library')).toBe(library);
    expect(overlay().querySelectorAll('.review-queue-item')).toHaveLength(2);
    await click('.review-title button');expect(component.editingPublication()?.id).toBe('rep-1');
    expect(container.querySelectorAll('.publication-workspace-dialog')).toHaveLength(1);
    await click('.editor-steps button:nth-child(2)');
    expect(overlay().querySelector('.subscriber-option input[type=checkbox]')).not.toBeNull();
    expect(overlay().querySelector('input[type=file]')).not.toBeNull();
    await click('.dialog-back');expect(overlay().querySelector('.review-queue')).not.toBeNull();
  });

  it('valida título, URL, límites y archivo antes de actualizar y conserva el PDF actual si no se reemplaza', async()=>{
    const {edit,component,service,change,click,overlay}=await setup();await edit();
    await change('titulo','   ');await click('.dialog-footer button[type=submit]');expect(component.editorStep()).toBe(1);expect(service.update).not.toHaveBeenCalled();
    await change('titulo','Título corregido');await change('link_url','javascript:alert(1)');await click('.dialog-footer button[type=submit]');expect(overlay().textContent).toContain('URL válida');
    await change('link_url','https://app.powerbi.com/view?r=valido');await click('.dialog-footer button[type=submit]');expect(component.editorStep()).toBe(2);
    component.onFileSelected({target:{files:[new File(['csv'],'archivo.csv',{type:'text/csv'})],value:''}} as any);
    component.savePublication();expect(service.update).not.toHaveBeenCalled();expect(component.fileError()).toContain('PDF');
    component.removeSelectedFile({value:''} as HTMLInputElement,new Event('click'));component.savePublication();
    expect(service.update).toHaveBeenCalledOnce();const data=service.update.mock.calls[0][1];
    expect(data.get('titulo')).toBe('Título corregido');expect(data.has('archivo')).toBe(false);
    expect(data.getAll('autores[]')).toEqual(['Ana Pérez']);
  });

  it('mantiene los campos completos en la superficie del diálogo y conserva los últimos datos al cambiar de paso', async()=>{
    const {edit,overlay,component,refresh,change,click,service,container}=await setup();await edit();
    const form=overlay().querySelector('.dialog-form')!;
    const scroll=form.querySelector('.editor-scroll')!;
    expect(scroll.querySelector('fieldset')).not.toBeNull();
    for(const selector of ['[name=titulo]','[name=fecha_publicacion]','[name=link_url]','[formArrayName=autores]','[name=descripcion]'])expect(scroll.querySelector(selector)).not.toBeNull();
    expect(scroll.querySelector('.dialog-footer')).toBeNull();expect(form.querySelector(':scope > .dialog-footer')).not.toBeNull();
    expect(scroll.getAttribute('aria-label')).toBe('Campos de la publicación');
    expect(container.querySelector('.mat-mdc-dialog-surface')!.contains(scroll)).toBe(true);
    expect(container.querySelector<HTMLElement>('.publication-workspace-dialog')!.style.height).toBe('calc(100dvh - 24px)');
    await change('descripcion','Descripción al final del formulario');
    const author=scroll.querySelector<HTMLInputElement>('[formArrayName=autores] input')!;author.value='Autora del final';author.dispatchEvent(new Event('input',{bubbles:true}));await refresh();
    component.continuePublication();await refresh();
    expect(scroll.querySelector('input[type=file]')).not.toBeNull();expect(scroll.querySelector('[name=solo_suscriptores]')).not.toBeNull();
    expect(overlay().querySelector('.dialog-footer button[type=submit]')?.textContent).toContain('Guardar cambios');
    component.editorStep.set(1);await refresh();expect(scroll.querySelector<HTMLTextAreaElement>('[name=descripcion]')!.value).toBe('Descripción al final del formulario');
    component.continuePublication();await refresh();await click('.dialog-footer button[type=submit]');
    expect(service.update.mock.calls[0][1].get('descripcion')).toBe('Descripción al final del formulario');
    expect(service.update.mock.calls[0][1].getAll('autores[]')).toEqual(['Autora del final']);
  });

  it('guarda el checkbox de suscriptores y un PDF nuevo en la publicación correcta y devuelve la revisión actualizada', async()=>{
    const {review,click,change,component,service,overlay,refresh}=await setup();await review();await click('.review-title button');
    await change('titulo','Reporte actualizado');await click('.dialog-footer button[type=submit]');
    const input=overlay().querySelector<HTMLInputElement>('input[name=solo_suscriptores]')!;input.click();await refresh();
    const pdf=new File(['%PDF-1.4'],'reemplazo.pdf',{type:'application/pdf'});
    component.onFileSelected({target:{files:[pdf]}} as any);await refresh();await click('.dialog-footer button[type=submit]');
    expect(service.update).toHaveBeenCalledOnce();const [id,data]=service.update.mock.calls[0];
    expect(id).toBe('rep-1');expect(data.get('archivo')).toBe(pdf);expect(data.get('solo_suscriptores')).toBe('1');
    expect(component.showPublicationForm()).toBe(false);expect(component.showReviewPanel()).toBe(true);
    expect(overlay().textContent).toContain('Reporte actualizado');component.libraryFiltersChanged({tipo:'REPORTE',q:'',page:0});expect(component.publicaciones()[0].titulo).toBe('Reporte actualizado');
  });

  it('protege los cambios ante cerrar y volver, y permite continuar o descartarlos', async()=>{
    const {review,click,change,component,container,refresh,overlay}=await setup();await review();await click('.review-title button');await change('titulo','Borrador pendiente');
    await click('.dialog-header>.dialog-icon');expect(component.discardChanges()).toBe(true);
    await click('.discard-banner button:first-child');expect(component.discardChanges()).toBe(false);expect(component.publicationForm.controls.titulo.value).toBe('Borrador pendiente');
    await click('.dialog-back');expect(component.discardChanges()).toBe(true);await click('.discard-banner button:last-child');expect(component.showPublicationForm()).toBe(false);expect(overlay().querySelector('.review-queue')).not.toBeNull();
    await click('.dialog-header>.dialog-icon');await refresh();await vi.waitFor(()=>expect(container.querySelector('.publication-dialog')).toBeNull());
  });

  it('bloquea guardados y cierre duplicados y conserva los valores al recibir un error del servidor', async()=>{
    const {edit,component,service,container,refresh}=await setup();await edit();
    const pending=new Subject<ObservatorioPublicacion>();service.update.mockReturnValueOnce(pending as any);
    component.publicationForm.controls.titulo.setValue('Edición pendiente');component.editorStep.set(2);component.savePublication();component.savePublication();component.requestOverlayClose();await refresh();
    expect(service.update).toHaveBeenCalledOnce();expect(container.querySelector('.publication-dialog')).not.toBeNull();
    pending.error({error:{errors:{titulo:['Título rechazado']}}});await refresh();
    expect(component.savingPublication()).toBe(false);expect(component.editorStep()).toBe(1);expect(component.serverError()).toBe('Título rechazado');expect(component.publicationForm.controls.titulo.value).toBe('Edición pendiente');
  });

  it('pide confirmar al pulsar el fondo o Escape y cierra solo después de descartar', async()=>{
    const {edit,change,container,component,refresh,click,overlay}=await setup();await edit();await change('titulo','Cambios pendientes');
    container.querySelector<HTMLElement>('.cdk-overlay-backdrop')!.click();await refresh();expect(component.discardChanges()).toBe(true);
    await click('.discard-banner button:first-child');
    overlay().dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));await refresh();expect(component.discardChanges()).toBe(true);
    await click('.discard-banner button:last-child');await vi.waitFor(()=>expect(container.querySelector('.publication-dialog')).toBeNull());
  });

  it('publica solo una vez, actualiza la cola y la biblioteca y mantiene los recursos conectados', async()=>{
    const {review,component,service,overlay,click,refresh}=await setup();await review();
    await click('.review-resources button:first-child');expect(service.openPdf).toHaveBeenCalledOnce();
    const source=vi.spyOn(window,'open').mockReturnValue(null);await click('.review-resources button:last-child');expect(source).toHaveBeenCalledWith('https://app.powerbi.com/view?r=ejemplo','_blank','noopener,noreferrer');source.mockRestore();
    const pending=new Subject<ObservatorioPublicacion>();service.update.mockReturnValueOnce(pending as any);
    const item=component.selectedReview()!;component.changeReviewStatus(item,'PUBLICACION');component.changeReviewStatus(item,'PUBLICACION');await refresh();
    expect(service.update).toHaveBeenCalledOnce();expect(overlay().querySelector<HTMLButtonElement>('.publish-button')!.disabled).toBe(true);
    service.libraryPage.mockImplementation((_id:string,filters:any)=>of(publicationPage([publication('art-2',{tipo:'ARTICULO'})],filters)));pending.next({...item,estado:'PUBLICACION'});pending.complete();await refresh();
    expect(component.reviewPublicaciones().map(x=>x.id)).toEqual(['art-2']);expect(service.libraryPage).toHaveBeenCalledWith('salud',expect.objectContaining({tipo:'ARTICULO'}));
  });

  it('distingue errores de carga de una cola vacía y permite reintentar', async()=>{
    const {component,service,refresh,overlay}=await setup();service.libraryPage.mockReturnValueOnce(throwError(()=>new Error('offline')));component.openReviewPanel();await refresh();
    expect(overlay().textContent).toContain('Reintentar');expect(overlay().textContent).not.toContain('La biblioteca está al día');
    service.libraryPage.mockReturnValueOnce(of(publicationPage([])));component.loadReviewPublicaciones('salud');await refresh();expect(overlay().textContent).toContain('No hay publicaciones pendientes');
  });

  it('mantiene permisos del editor sin ofrecer publicar ni cambiar suscriptores', async()=>{
    const {review,overlay,click,component,service}=await setup(false);await review();
    expect(overlay().querySelector('.publish-button')).toBeNull();await click('.review-title button');await click('.dialog-footer button[type=submit]');
    expect(overlay().querySelector('.subscriber-option')).toBeNull();expect(overlay().querySelector('select[name=estado]')).toBeNull();
    component.changeReviewStatus(component.selectedReview()!,'PUBLICACION');expect(service.update).not.toHaveBeenCalled();
  });

  it.each(['SUSPENDIDO','ARCHIVADO','RECHAZADO'] as const)('exige y envía observación para %s sin ocultar el campo en el segundo paso', async estado => {
    const {component,service,overlay,edit,click,change,refresh}=await setup();
    await edit();await click('.dialog-footer button[type=submit]');
    component.publicationForm.controls.estado.setValue(estado);await refresh();
    expect(overlay().querySelector('[name=observacion_revision]')).toBeTruthy();
    await click('.dialog-footer button[type=submit]');
    expect(component.editorStep()).toBe(2);expect(service.update).not.toHaveBeenCalled();
    expect(overlay().textContent).toContain('Este campo es obligatorio.');
    await change('observacion_revision','Completa las referencias y la metodología.');
    await click('.dialog-footer button[type=submit]');
    const payload=service.update.mock.calls[0][1];
    expect(payload.get('estado')).toBe(estado);
    expect(payload.get('observacion_revision')).toBe('Completa las referencias y la metodología.');
  });
  it.each(['SUSPENDIDO','ARCHIVADO','RECHAZADO'] as const)('la acción rápida %s abre el formulario y pide motivo antes de guardar',async estado=>{
    const {component,service,review,refresh,overlay}=await setup(false,true);
    await review();component.changeReviewStatus(component.selectedReview()!,estado);await refresh();
    expect(component.editorStep()).toBe(2);expect(service.update).not.toHaveBeenCalled();
    expect(overlay().querySelector('[name=observacion_revision]')).toBeTruthy();
    expect(component.publicationForm.controls.estado.value).toBe(estado);
  });
  it('el editor no puede abrir edición ni guardar o eliminar una publicación rechazada',async()=>{
    const {component,service,refresh,overlay}=await setup(false);
    const rejected=publication('rejected',{capabilities:{can_view:true,can_edit:false,can_delete:false,can_review:false},estado:'RECHAZADO',observacion_revision:'No cumple los requisitos.'});
    expect(component.canEditPublication(rejected)).toBe(false);expect(component.canDeletePublication(rejected)).toBe(false);
    component.editPublication(rejected);await refresh();expect(overlay()).toBeNull();
    component.editingPublication.set(rejected);component.savePublication();expect(service.update).not.toHaveBeenCalled();
    expect(component.canEditPublication(publication('suspended',{estado:'SUSPENDIDO'}))).toBe(true);
  });
  it('separa editar, eliminar y revisar según la API, sin ampliarlos por ser administrador',async()=>{
    const {component,service,refresh,overlay}=await setup();
    const item=publication('limited',{capabilities:{can_view:true,can_edit:true,can_delete:false,can_review:false}});
    expect(component.canEditPublication(item)).toBe(true);expect(component.canDeletePublication(item)).toBe(false);
    component.editPublication(item);await refresh();
    expect(component.canChoosePublicationStatus).toBe(false);
    component.changeReviewStatus(item,'PUBLICACION');expect(service.update).not.toHaveBeenCalled();
    component.closePublicationForm();await refresh();
    component.editPublication(publication('missing',{capabilities:undefined}));await refresh();
    expect(component.showPublicationForm()).toBe(false);
    expect(component.editingPublication()).toBeNull();
  });
  afterEach(()=>{TestBed.inject(MatDialog).closeAll();});
});
