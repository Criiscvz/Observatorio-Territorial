import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { AuthService } from '@core/services/auth.service';
import { DepartamentoService } from '@core/services/departamento.service';
import { PublicacionService } from '@core/services/publicacion.service';
import { AtlasCategoriaService } from '@core/services/atlas-categoria.service';
import { AtlasEnlaceService } from '@core/services/atlas-enlace.service';
import { PermisosService } from '@core/services/permisos.service';
import { UserService } from '@core/services/user.service';
import { User } from '@core/models';
import { PublicationDestinationFacade } from './publication-destination.facade';
import { AtlasDestinationFacade } from '../public/public-atlas/atlas-destination.facade';
import { PermissionsWorkspaceFacade } from '../permisos/permissions-workspace.facade';

@Component({standalone:true,template:'',providers:[PublicationDestinationFacade,AtlasDestinationFacade,PermissionsWorkspaceFacade]})
class FacadeHost {}

describe('Coordinación de destinos y accesos por pantalla',()=>{
  const caps={can_view_access:true,can_manage_access:true,can_assign_editors:true,can_revoke_access:true};
  const user:User={id:2,name:'Editora',email:'editor@example.test',rol:'EDITOR',access_capabilities:caps};
  const list=(items:User[]=[user],pages=1,assign=true)=>({data:items,meta:{last_page:pages,access_capabilities:{can_assign_editors:assign}}});
  function setup(){
    const auth={isAdmin:vi.fn(()=>true),user:vi.fn(()=>({rol:'ADMIN'})),canReviewObservatory:vi.fn(()=>true)};
    const departments={getAll:vi.fn(()=>of([{id:'salud',nombre:'Salud'},{id:'laboral',nombre:'Laboral'}]))};
    const publications={create:vi.fn((_id:string,_data:FormData)=>of({id:'saved',codigo:'REP-1'} as any))};
    const categories={list:vi.fn(()=>of([{id:'ambiente',nombre:'Ambiente'},{id:'ciencia',nombre:'Ciencia'}]))};
    const links={save:vi.fn((_data:unknown)=>of({id:'atlas',codigo:'ATL-1'} as any))};
    const users={getUsers:vi.fn(()=>of(list()))};
    const permissions={syncFromBackend:vi.fn((_id:number)=>of([])),saveUserPermisos:vi.fn((_id:number,_data:unknown)=>of({user,permisos:[],message:'ok'})),getUserPermisos:()=>[]};
    TestBed.configureTestingModule({imports:[FacadeHost],providers:[
      {provide:AuthService,useValue:auth},{provide:DepartamentoService,useValue:departments},
      {provide:PublicacionService,useValue:publications},{provide:AtlasCategoriaService,useValue:categories},
      {provide:AtlasEnlaceService,useValue:links},{provide:UserService,useValue:users},{provide:PermisosService,useValue:permissions},
    ]});
    const fixture=TestBed.createComponent(FacadeHost);fixture.detectChanges();
    return{fixture,auth,departments,publications,categories,links,users,permissions,
      pub:fixture.debugElement.injector.get(PublicationDestinationFacade),
      atlas:fixture.debugElement.injector.get(AtlasDestinationFacade),
      access:fixture.debugElement.injector.get(PermissionsWorkspaceFacade)};
  }
  function report(state:PublicationDestinationFacade){
    state.start({tipo:'REPORTE',departamento:'salud'});state.openForm();
    state.publicationForm.patchValue({titulo:'Reporte',fecha_publicacion:'2026-10-30',link_url:'https://app.powerbi.com/view?r=report'});
    state.submit();
  }
  function atlasDraft(state:AtlasDestinationFacade){
    state.start('ambiente');state.openForm();
    state.form.patchValue({titulo:'Atlas ambiental',link_url:'https://app.powerbi.com/view?r=atlas'});
  }

  it('una recarga de observatorios cancela la anterior y no acepta sus destinos tardíos',()=>{
    const {pub,departments}=setup();const old=new Subject<any>();departments.getAll.mockReturnValueOnce(old);
    pub.start({tipo:'ARTICULO',departamento:null});pub.load();expect(old.observed).toBe(false);
    old.next([{id:'ajeno',nombre:'Anterior'}]);
    pub.form.controls.departamento.setValue('ajeno');expect(pub.openForm()).toBe(false);
    expect(pub.observatories().map(item=>item.id)).toEqual(['salud','laboral']);
  });
  it('dos pantallas de creación no comparten destino, archivo ni borrador',()=>{
    const {pub}=setup();pub.start({tipo:'ARTICULO',departamento:'salud'});pub.openForm();
    pub.publicationForm.controls.titulo.setValue('Borrador personal');pub.selectFile(new File(['%PDF'],'borrador.pdf',{type:'application/pdf'}));
    const second=TestBed.createComponent(FacadeHost);const other=second.debugElement.injector.get(PublicationDestinationFacade);
    other.start({tipo:'LIBRO',departamento:'laboral'});other.openForm();
    expect(other.destination()?.departamento.id).toBe('laboral');expect(other.selectedFile()).toBeNull();expect(other.publicationForm.controls.titulo.value).toBe('');
    expect(pub.destination()?.departamento.id).toBe('salud');expect(pub.selectedFile()?.name).toBe('borrador.pdf');
  });
  it('el editor conserva el envío a revisión aunque manipule estado y acceso en el formulario',()=>{
    const {pub,auth,publications}=setup();auth.canReviewObservatory.mockReturnValue(false);report(pub);
    pub.publicationForm.patchValue({estado:'PUBLICACION',solo_suscriptores:true,observacion_revision:'Texto manipulado'});pub.submit();
    const data=publications.create.mock.calls[0][1];expect(data.get('estado')).toBe('EN_REVISION');expect(data.get('solo_suscriptores')).toBe('0');expect(data.has('observacion_revision')).toBe(false);
  });
  it('un guardado pendiente bloquea reinicio y duplicados, y destruir la pantalla termina la suscripción',()=>{
    const {pub,fixture,publications}=setup();report(pub);const pending=new Subject<any>();publications.create.mockReturnValue(pending);
    pub.submit();pub.resetEditor();pub.closeForm();pub.submit();
    expect(publications.create).toHaveBeenCalledOnce();expect(pub.publicationForm.controls.titulo.value).toBe('Reporte');expect(pub.destination()).not.toBeNull();
    fixture.destroy();expect(pending.observed).toBe(false);pending.next({id:'late'});expect(pub.savedPublication()).toBeNull();
  });
  it('el importador conserva el borrador, no se duplica y libera su estado al destruir la vista',()=>{
    const {pub,fixture}=setup();report(pub);pub.publicationForm.markAsDirty();const result=new Subject<any>();
    expect(pub.beginImport()?.target).toBe('reportes');expect(pub.beginImport()).toBeNull();pub.observeImport(result);
    pub.closeForm();expect(pub.hasUnsavedChanges()).toBe(true);fixture.destroy();
    expect(result.observed).toBe(false);expect(pub.importing()).toBe(false);
    result.next({totals:{imported:10,errors:0,rejected:0,duplicates:0}});expect(pub.importMessage()).toBe('');
  });
  it('la recarga de categorías de Atlas descarta respuestas antiguas',()=>{
    const {atlas,categories}=setup();const old=new Subject<any>();categories.list.mockReturnValueOnce(old);
    atlas.start('ambiente');atlas.load();expect(old.observed).toBe(false);old.next([{id:'vieja'}]);
    expect(atlas.openForm()).toBe(true);expect(atlas.destination()?.id).toBe('ambiente');
  });
  it('Atlas usa la categoría fijada, bloquea reinicio durante el envío y no aplica respuestas tras destruirse',()=>{
    const {atlas,links,fixture}=setup();atlasDraft(atlas);atlas.destinationForm.controls.categoria.setValue('ciencia');
    const pending=new Subject<any>();links.save.mockReturnValue(pending);atlas.submit();atlas.submit();atlas.resetForm();
    expect(links.save).toHaveBeenCalledOnce();expect(links.save.mock.calls[0][0]).toEqual(expect.objectContaining({atlas_categoria_id:'ambiente'}));
    expect(atlas.form.controls.titulo.value).toBe('Atlas ambiental');fixture.destroy();expect(pending.observed).toBe(false);pending.next({id:'late'});expect(atlas.saved()).toBeNull();
  });
  it('las pantallas de Atlas mantienen sus borradores por separado',()=>{
    const {atlas}=setup();atlasDraft(atlas);const second=TestBed.createComponent(FacadeHost);
    const other=second.debugElement.injector.get(AtlasDestinationFacade);other.start('ciencia');other.openForm();
    expect(other.form.controls.titulo.value).toBe('');expect(other.destination()?.id).toBe('ciencia');expect(atlas.form.controls.titulo.value).toBe('Atlas ambiental');
  });
  it('una recarga de permisos cancela las páginas anteriores y no recupera capacidades obsoletas',()=>{
    const {access,users}=setup();const oldPage=new Subject<any>();users.getUsers.mockReturnValueOnce(of(list([user],2))).mockReturnValueOnce(oldPage);
    access.loadUsers();users.getUsers.mockReturnValue(of(list([{...user,id:3}],1,false)));access.loadUsers();
    expect(oldPage.observed).toBe(false);oldPage.next(list([user]));
    expect(access.users().map(row=>row.id)).toEqual([3]);expect(access.canAssignEditors()).toBe(false);
  });
  it('un fallo al recargar limpia acciones antiguas y permite reintentar sin confiar en el rol local',()=>{
    const {access,users,permissions}=setup();access.loadUsers();access.resetConfirmationId.set(user.id);
    users.getUsers.mockReturnValueOnce(throwError(()=>new Error('offline')));access.loadUsers();
    expect(access.users()).toEqual([]);expect(access.canAssignEditors()).toBe(false);expect(access.resetConfirmationId()).toBeNull();
    access.saveAccess({...user,access_capabilities:undefined},[]).subscribe();expect(permissions.saveUserPermisos).not.toHaveBeenCalled();
    access.loadUsers();expect(access.users()).toHaveLength(1);
  });
  it('guardar accesos cancela la sincronización visual anterior y evita envíos simultáneos',()=>{
    const {access,permissions}=setup();const stale=new Subject<any>(),pending=new Subject<any>();permissions.syncFromBackend.mockReturnValueOnce(stale);
    access.loadUsers();permissions.saveUserPermisos.mockReturnValueOnce(pending);
    access.saveAccess(user,[]).subscribe({error:()=>{}});access.saveAccess(user,[]).subscribe();
    expect(stale.observed).toBe(false);expect(permissions.saveUserPermisos).toHaveBeenCalledOnce();
    pending.error(new Error('offline'));expect(access.savingUserId()).toBeNull();expect(access.saveStatus()).toContain('intentar');
    access.saveAccess(user,[]).subscribe();expect(permissions.saveUserPermisos).toHaveBeenCalledTimes(2);
  });
  it('quitar accesos exige confirmación y capacidad, y destruir la lista cancela la respuesta pendiente',()=>{
    const {access,permissions,fixture}=setup();access.loadUsers();
    access.saveAccess(user,[],true).subscribe();expect(permissions.saveUserPermisos).not.toHaveBeenCalled();
    access.resetConfirmationId.set(user.id);const pending=new Subject<any>();permissions.saveUserPermisos.mockReturnValue(pending);
    access.saveAccess(user,[],true).subscribe();fixture.destroy();expect(pending.observed).toBe(false);
    pending.next({user:{...user,name:'Respuesta tardía'},permisos:[]});expect(access.users()[0].name).toBe('Editora');
  });
});
