import { Component, inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { AuthService } from '@core/services/auth.service';
import { DepartamentoService } from '@core/services/departamento.service';
import { PublicacionService } from '@core/services/publicacion.service';
import { ObservatorioPublicacion } from '@core/models/publicacion/publicacion.interface';
import { publicationPage } from '../../../testing/publication-page.fixture';
import { ObservatoryWorkspaceFacade } from './observatory-workspace.facade';
import { PublicationEditorFacade } from './publication-editor.facade';

@Component({standalone:true, template:'', providers:[ObservatoryWorkspaceFacade, PublicationEditorFacade]})
class ViewHost {
  readonly workspace = inject(ObservatoryWorkspaceFacade);
  readonly editor = inject(PublicationEditorFacade);
  ngOnInit() { this.workspace.start(); this.editor.start(); }
}

describe('Coordinación aislada de la vista del observatorio', () => {
  const publication = (extra: Partial<ObservatorioPublicacion> = {}) => ({
    id:'doc-1', departamento_id:'salud', tipo:'ARTICULO', estado:'EN_REVISION', titulo:'Trabajo original',
    fecha_publicacion:'2026-10-20', autores:['Ana'], fuente:'ULEAM', solo_suscriptores:false,
    capabilities:{can_view:true, can_edit:true, can_delete:true, can_review:true}, ...extra,
  } as ObservatorioPublicacion);

  function setup() {
    const departments = {getById:vi.fn((id:string) => of({id, nombre:id, datasets:[]}))};
    const api = {
      canUpload:vi.fn(() => of({can_upload:true})),
      libraryPage:vi.fn((_id:string, _filters:unknown) => of(publicationPage([]))),
      update:vi.fn((_id:string, _body:FormData) => of(publication())),
      create:vi.fn((_id:string, _body:FormData) => of(publication())),
      delete:vi.fn((_id:string) => of({message:'ok'})),
      syncSharePointReportes:vi.fn((_id:string) => of([publication()])),
      syncSharePointAtlas:vi.fn((_id:string) => of([publication()])),
    };
    TestBed.configureTestingModule({imports:[ViewHost], providers:[
      {provide:DepartamentoService, useValue:departments}, {provide:PublicacionService, useValue:api},
      {provide:AuthService, useValue:{isAdmin:()=>true, isEditor:()=>false, canReviewObservatory:()=>true, hasRoleInDepartamento:()=>false}},
    ]});
    const fixture = TestBed.createComponent(ViewHost); fixture.detectChanges();
    const {workspace, editor} = fixture.componentInstance;
    workspace.loadDepartamento('salud');
    return {fixture, workspace, editor, api, departments};
  }

  it('cada pantalla mantiene su observatorio, borrador y páginas sin compartir estado', () => {
    const {workspace, editor} = setup();
    editor.edit(publication()); editor.publicationForm.controls.titulo.setValue('Borrador local');
    workspace.libraryPage.set(3);
    const second = TestBed.createComponent(ViewHost); second.detectChanges();
    second.componentInstance.workspace.loadDepartamento('laboral');
    expect(second.componentInstance.workspace.departamento()?.id).toBe('laboral');
    expect(second.componentInstance.workspace.libraryPage()).toBe(0);
    expect(second.componentInstance.editor.publicationForm.controls.titulo.value).toBe('');
    expect(editor.publicationForm.controls.titulo.value).toBe('Borrador local');
    expect(workspace.departamento()?.id).toBe('salud'); expect(workspace.libraryPage()).toBe(3);
  });

  it('cancela metadatos y permisos antiguos al navegar; no reaparecen datos del destino anterior', () => {
    const {workspace, departments, api} = setup();
    const oldDepartment = new Subject<any>(), oldPermission = new Subject<any>();
    departments.getById.mockReturnValueOnce(oldDepartment);
    workspace.loadDepartamento('pendiente');
    api.canUpload.mockReturnValueOnce(oldPermission);
    workspace.loadDepartamento('otro'); expect(oldDepartment.observed).toBe(false);
    workspace.reviewPage.set(2); workspace.reviewLastPage.set(3);
    workspace.loadDepartamento('actual'); expect(oldPermission.observed).toBe(false);
    oldDepartment.next({id:'pendiente'}); oldPermission.next({can_upload:false});
    expect(workspace.departamento()?.id).toBe('actual'); expect(workspace.canUploadPublications()).toBe(true);
    expect(workspace.reviewPage()).toBe(0); expect(workspace.reviewLastPage()).toBe(1);
  });

  it('cancela la cola anterior y puede reintentar sin conservar errores ni filas de otro ámbito', () => {
    const {workspace, api} = setup(); const old = new Subject<any>();
    api.libraryPage.mockReturnValueOnce(old); workspace.loadReviewPublicaciones('salud');
    workspace.loadDepartamento('laboral'); expect(old.observed).toBe(false);
    old.next(publicationPage([publication()])); expect(workspace.reviewPublicaciones()).toEqual([]);
    api.libraryPage.mockReturnValueOnce(throwError(() => new Error('offline')));
    workspace.loadReviewPublicaciones('laboral'); expect(workspace.reviewError()).toContain('No se pudieron');
    workspace.loadReviewPublicaciones('laboral'); expect(workspace.reviewError()).toBe('');
    expect(workspace.loadingReviewPublicaciones()).toBe(false);
  });

  it('un guardado pendiente no cierra ni rellena el borrador del siguiente observatorio', () => {
    const {workspace, editor, api} = setup(); const pending = new Subject<ObservatorioPublicacion>();
    api.update.mockReturnValue(pending); editor.edit(publication());
    const completed = vi.fn(); editor.savePublication().subscribe(completed);
    expect(editor.savingPublication()).toBe(true);
    workspace.loadDepartamento('laboral');
    expect(pending.observed).toBe(false); expect(editor.savingPublication()).toBe(false);
    editor.edit(publication({id:'doc-2', departamento_id:'laboral', titulo:'Otro borrador'}));
    pending.next(publication()); pending.complete();
    expect(completed).not.toHaveBeenCalled(); expect(editor.publicationForm.controls.titulo.value).toBe('Otro borrador');
    expect(editor.editingPublication()?.id).toBe('doc-2');
  });

  it('conserva el PDF y el borrador tras un error 422 y permite reintentar una única vez', () => {
    const {editor, api} = setup(); editor.edit(publication());
    const pdf = new File(['%PDF-1.4'], 'correccion.pdf', {type:'application/pdf'});
    editor.onFileSelected({target:{files:[pdf]}} as unknown as Event);
    editor.publicationForm.controls.titulo.setValue('Corrección');
    api.update.mockReturnValueOnce(throwError(() => ({error:{errors:{archivo:['El archivo no es válido.']}}})));
    const saved = vi.fn(); editor.savePublication().subscribe(saved);
    expect(saved).not.toHaveBeenCalled(); expect(editor.serverError()).toBe('El archivo no es válido.');
    expect(editor.editorStep()).toBe(2); expect(editor.selectedFile()).toBe(pdf);
    expect(editor.publicationForm.controls.titulo.value).toBe('Corrección');
    const pending = new Subject<ObservatorioPublicacion>(); api.update.mockReturnValue(pending);
    editor.savePublication().subscribe(saved); editor.savePublication().subscribe(saved);
    expect(api.update).toHaveBeenCalledTimes(2);
    pending.next(publication()); expect(saved).toHaveBeenCalledOnce(); expect(editor.serverError()).toBe('');
  });

  it('deniega edición con capacidades ausentes aunque la sesión local diga Administrador', () => {
    const {editor, api} = setup();
    expect(editor.edit(publication({capabilities:undefined}))).toBe(false);
    editor.editingPublication.set(publication({capabilities:undefined}));
    editor.savePublication().subscribe(); expect(api.update).not.toHaveBeenCalled();
  });

  it('exige motivo para rechazar y conserva autores, acceso y PDF al serializar el guardado', () => {
    const {editor, api} = setup(); editor.edit(publication());
    editor.publicationForm.patchValue({estado:'RECHAZADO', solo_suscriptores:true});
    editor.publicationForm.controls.observacion_revision.setValue('   ');
    editor.savePublication().subscribe(); expect(api.update).not.toHaveBeenCalled();
    editor.publicationForm.controls.observacion_revision.setValue('Corregir la fuente.');
    editor.savePublication().subscribe();
    const body = api.update.mock.calls[0][1];
    expect(body.get('estado')).toBe('RECHAZADO'); expect(body.get('observacion_revision')).toBe('Corregir la fuente.');
    expect(body.get('solo_suscriptores')).toBe('1'); expect(body.getAll('autores[]')).toEqual(['Ana']);
    expect(body.has('archivo')).toBe(false);
  });

  it('destruir la pantalla cancela sus peticiones de lectura y escritura', () => {
    const {fixture, workspace, editor, api} = setup();
    const library = new Subject<any>(), review = new Subject<any>(), save = new Subject<ObservatorioPublicacion>();
    api.libraryPage.mockReturnValueOnce(library).mockReturnValueOnce(review);
    workspace.loadPublicaciones('salud'); workspace.loadReviewPublicaciones('salud');
    editor.edit(publication()); api.update.mockReturnValue(save); const saved = vi.fn(); editor.savePublication().subscribe(saved);
    expect(library.observed && review.observed && save.observed).toBe(true);
    fixture.destroy(); expect(library.observed || review.observed || save.observed).toBe(false);
    save.next(publication()); expect(saved).not.toHaveBeenCalled();
  });

  it('una confirmación antigua no elimina ni revisa archivos de otro observatorio', () => {
    const {workspace, editor, api} = setup(); workspace.loadDepartamento('laboral');
    workspace.remove(publication(), false).subscribe();
    workspace.review(publication(), 'PUBLICACION', new FormData(), false).subscribe();
    expect(editor.edit(publication())).toBe(false);
    expect(api.delete).not.toHaveBeenCalled(); expect(api.update).not.toHaveBeenCalled();
  });

  it('una recarga tardía de un importador anterior no consulta ni reemplaza la biblioteca actual', () => {
    const {workspace, api} = setup(); workspace.loadDepartamento('laboral');
    api.libraryPage.mockClear(); api.canUpload.mockClear();
    workspace.loadPublicaciones('salud'); workspace.loadReviewPublicaciones('salud'); workspace.loadCanUpload('salud');
    expect(api.libraryPage).not.toHaveBeenCalled(); expect(api.canUpload).not.toHaveBeenCalled();
    expect(workspace.departamento()?.id).toBe('laboral');
  });

  it('cancela una revisión anterior y libera su estado al cambiar de observatorio', () => {
    const {workspace, api} = setup(); const pending = new Subject<ObservatorioPublicacion>();
    api.update.mockReturnValue(pending); const reviewed = vi.fn();
    workspace.review(publication(), 'PUBLICACION', new FormData(), true).subscribe(reviewed);
    expect(workspace.changingReviewStatus()).toBe('doc-1:PUBLICACION');
    workspace.loadDepartamento('laboral');
    expect(pending.observed).toBe(false); expect(workspace.changingReviewStatus()).toBeNull();
    pending.next(publication()); expect(reviewed).not.toHaveBeenCalled();
  });

  it('libera una sincronización fallida para reintentar y no acepta respuestas de un destino anterior', () => {
    const {workspace, api} = setup();
    api.syncSharePointReportes.mockReturnValueOnce(throwError(() => new Error('offline')));
    workspace.sync('REPORTE').subscribe({error:()=>{}}); expect(workspace.syncingSharePoint()).toBeNull();
    const pending = new Subject<ObservatorioPublicacion[]>(); api.syncSharePointReportes.mockReturnValue(pending);
    const synced = vi.fn(); workspace.sync('REPORTE').subscribe(synced); workspace.sync('LIBRO').subscribe();
    expect(api.syncSharePointAtlas).not.toHaveBeenCalled();
    workspace.loadDepartamento('laboral'); expect(pending.observed).toBe(false);
    pending.next([publication()]); expect(synced).not.toHaveBeenCalled(); expect(workspace.syncingSharePoint()).toBeNull();
    workspace.sync('LIBRO').subscribe(); expect(api.syncSharePointAtlas).toHaveBeenCalledWith('laboral');
  });
});
