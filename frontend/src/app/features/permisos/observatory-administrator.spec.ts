import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { provideTranslateService } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';
import { User } from '@core/models';
import { AuthService } from '@core/services/auth.service';
import { UserService } from '@core/services/user.service';
import { DepartamentoService } from '@core/services/departamento.service';
import { PermisosService } from '@core/services/permisos.service';
import { ObservatoryAccessService } from '@core/services/observatory-access.service';
import { PublicacionService } from '@core/services/publicacion.service';
import { AdminPermissionsComponent } from './admin-permissions.component';
import { UserPermissionsDialogComponent } from './user-permissions-dialog.component';
import { PublicationDestinationComponent } from '../admin-workspace/publication-destination.component';
import { WorkspaceSidebarComponent } from '@shared/components/layout/workspace-sidebar.component';

const manager: User = {id: 4, name: 'Responsable', email: 'responsable@example.test', rol: 'ADMIN_OBSERVATORIO', departamentos: [
  {id:'salud',nombre:'Salud',codigo_interno:'SAL',rol:'ADMIN',puede_revisar:true,puede_agregar_editores:false},
  {id:'laboral',nombre:'Laboral',codigo_interno:'LAB',rol:'ADMIN',puede_revisar:false,puede_agregar_editores:true},
]};
const departments = manager.departamentos!.map(d => ({...d}));
function auth(user: User = manager) {
  return {user:()=>user,isAdmin:()=>user.rol==='ADMIN',isEditor:()=>user.rol==='EDITOR',isObservatoryAdmin:()=>user.rol==='ADMIN_OBSERVATORIO',
    canReviewObservatory:(id?:string)=>user.rol==='ADMIN'||!!user.departamentos?.some(d=>(!id||d.id===id)&&d.puede_revisar),
    canAssignEditors:()=>!!user.departamentos?.some(d=>d.puede_agregar_editores)};
}

describe('Administrador de observatorio: permisos y formularios', () => {
  function permissionDialog(actor: User = {...manager,rol:'ADMIN'}, failure = false) {
    const permissions = [{modulo:'observatorios',nivel:'escritura',departamento_id:'salud',puede_revisar:true,puede_agregar_editores:false}];
    const close = vi.fn();
    TestBed.configureTestingModule({providers:[provideRouter([]),provideTranslateService(),
      {provide:AuthService,useValue:auth(actor)},{provide:MAT_DIALOG_DATA,useValue:manager},{provide:MatDialogRef,useValue:{close}},
      {provide:DepartamentoService,useValue:{getAll:()=>of(departments)}},
      {provide:ObservatoryAccessService,useValue:{context:()=>failure?throwError(()=>new Error('offline')):of({capabilities:{can_view_access:true,can_manage_access:true,can_assign_editors:true,can_revoke_access:true},observatorios:departments,permisos:permissions})}},
    ]});
    const fixture=TestBed.createComponent(UserPermissionsDialogComponent);fixture.detectChanges();
    return {fixture,component:fixture.componentInstance,close};
  }

  it('carga los dos permisos independientes por observatorio y conserva lo desactivado al guardar',async()=>{
    const {fixture,component,close}=permissionDialog();
    await fixture.whenStable(); fixture.detectChanges();
    expect(component.selectedDepartamentoIds).toEqual(['salud']);
    expect(fixture.nativeElement.querySelectorAll('.delegated-permissions input')).toHaveLength(2);
    const inputs=fixture.nativeElement.querySelectorAll('.delegated-permissions input');
    expect(inputs[0].checked).toBe(true);expect(inputs[1].checked).toBe(false);
    inputs[1].click();await fixture.whenStable();fixture.detectChanges();component.save();
    expect(close).toHaveBeenCalledWith([expect.objectContaining({departamento_id:'salud',puede_revisar:true,puede_agregar_editores:true})]);
    component.flags('salud').puede_revisar=false;component.save();
    expect(close).toHaveBeenLastCalledWith([expect.objectContaining({puede_revisar:false,puede_agregar_editores:true})]);
  });

  it('no permite sobrescribir permisos cuando falla la carga del estado actual',()=>{
    const {fixture,component,close}=permissionDialog(undefined,true);
    expect(fixture.nativeElement.querySelector('.access-button.primary')).toBeNull();
    component.save();expect(close).not.toHaveBeenCalled();
  });

  it('divide los responsables en pestañas y permite cambiarlas con el teclado',()=>{
    const editor={...manager,id:8,name:'Editor',rol:'EDITOR'};
    TestBed.configureTestingModule({providers:[provideRouter([]),provideTranslateService(),
      {provide:AuthService,useValue:auth({...manager,rol:'ADMIN'})},
      {provide:UserService,useValue:{getUsers:()=>of({data:[manager,editor],meta:{last_page:1}})}},
      {provide:PermisosService,useValue:{getUserPermisos:()=>[],syncFromBackend:()=>of([])}},
      {provide:MatDialog,useValue:{open:vi.fn()}},{provide:MatSnackBar,useValue:{open:vi.fn()}},
    ]});
    const fixture=TestBed.createComponent(AdminPermissionsComponent);fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.editor-row')).toHaveLength(1);
    expect(fixture.nativeElement.querySelector('.editor-name').textContent).toContain('Responsable');
    const tabs=fixture.nativeElement.querySelectorAll('[role=tab]');
    tabs[0].dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));fixture.detectChanges();
    expect(fixture.componentInstance.selectedRole()).toBe('EDITOR');
    expect(fixture.nativeElement.querySelector('.editor-name').textContent).toContain('Editor');
    expect(tabs[1].getAttribute('aria-selected')).toBe('true');
  });

  it('ofrece solo el observatorio con edición habilitada y usa el mismo formulario con estados',()=>{
    const create=vi.fn(()=>of({id:'nueva',titulo:'Reporte',codigo:'REP-1'}));
    TestBed.configureTestingModule({providers:[provideRouter([]),
      {provide:AuthService,useValue:auth()},
      {provide:ActivatedRoute,useValue:{snapshot:{queryParamMap:convertToParamMap({tipo:'REPORTE',departamento:'laboral'})}}},
      {provide:DepartamentoService,useValue:{getAll:()=>of(departments)}},
      {provide:PublicacionService,useValue:{create}},{provide:MatDialog,useValue:{open:vi.fn()}},
    ]});
    const fixture=TestBed.createComponent(PublicationDestinationComponent);fixture.detectChanges();
    const component=fixture.componentInstance;
    expect(component.observatories().map(d=>d.id)).toEqual(['salud']);expect(component.form.controls.departamento.value).toBe('salud');
    component.openForm();component.publicationForm.patchValue({titulo:'Reporte',fecha_publicacion:'2026-10-27',link_url:'https://app.powerbi.com/view?r=test',estado:'ARCHIVADO',observacion_revision:'Archivo solicitado por el observatorio'});
    component.goToStep(2);fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('select[formControlName=estado]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.sharepoint-action')).toBeNull();
    component.submit();expect(create).toHaveBeenCalledOnce();
    expect((create.mock.calls[0] as any)[1].get('estado')).toBe('ARCHIVADO');
    expect((create.mock.calls[0] as any)[1].get('observacion_revision')).toBe('Archivo solicitado por el observatorio');
  });

  it('el menú incluye Usuarios y Permisos y excluye administración global, Atlas y Barómetro',()=>{
    TestBed.configureTestingModule({providers:[provideRouter([])]});
    const fixture=TestBed.createComponent(WorkspaceSidebarComponent);
    fixture.componentRef.setInput('observatoryAdmin',true);fixture.detectChanges();
    const links=Array.from(fixture.nativeElement.querySelectorAll('a')).map((a:any)=>a.getAttribute('href'));
    expect(links).toContain('/admin/usuarios');expect(links).toContain('/admin/permisos');
    expect(links).not.toContain('/admin/atlas');expect(links).not.toContain('/admin/datasets');expect(links).not.toContain('/admin/configuracion');
  });
});
