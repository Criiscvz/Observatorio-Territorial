import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { provideTranslateService } from '@ngx-translate/core';
import { of, Subject, throwError } from 'rxjs';
import { User } from '@core/models';
import { AuthService } from '@core/services/auth.service';
import { DepartamentoService } from '@core/services/departamento.service';
import { PermisosService } from '@core/services/permisos.service';
import { UserService } from '@core/services/user.service';
import { ObservatoryAccessService } from '@core/services/observatory-access.service';
import { AdminPermissionsComponent } from './admin-permissions.component';
import { EditorPickerDialogComponent } from './editor-picker-dialog.component';
import { UserPermissionsDialogComponent } from './user-permissions-dialog.component';

const departments = [{id:'salud',nombre:'Salud',codigo_interno:'SAL',rol:'ADMIN' as const,puede_agregar_editores:false},
  {id:'laboral',nombre:'Laboral',codigo_interno:'LAB',rol:'ADMIN' as const,puede_agregar_editores:true}];
const supervisor: User = {id:1,name:'Supervisor',email:'supervisor@example.test',rol:'ADMIN_OBSERVATORIO',departamentos:departments};
const normal: User = {access_capabilities:{can_view_access:true,can_manage_access:true,can_assign_editors:true,can_revoke_access:true},id:2,name:'Nuevo editor',email:'nuevo@example.test',rol:'USER',is_active:true};
const editor: User = {...normal,access_capabilities:{can_view_access:true,can_manage_access:false,can_assign_editors:false,can_revoke_access:false},rol:'EDITOR',departamentos:[departments[0]]};
const auth = {user:()=>supervisor,isAdmin:()=>false,canAssignEditors:()=>true};
const assigned = [{modulo:'observatorios',nivel:'escritura',departamento_id:'salud'}];

describe('Accesos del supervisor',()=>{
  it('deniega edición mientras carga el contexto y no amplía un contexto de solo consulta aunque el rol local sea administrador',()=>{
    const context=new Subject<any>(),close=vi.fn();
    TestBed.configureTestingModule({providers:[
      {provide:AuthService,useValue:{...auth,user:()=>({...supervisor,rol:'ADMIN'}),isAdmin:()=>true}},
      {provide:MAT_DIALOG_DATA,useValue:editor},{provide:MatDialogRef,useValue:{close}},
      {provide:ObservatoryAccessService,useValue:{context:()=>context}},
    ]});
    const fixture=TestBed.createComponent(UserPermissionsDialogComponent);fixture.detectChanges();const component=fixture.componentInstance;
    component.toggleDepartamento('laboral',true);component.save();expect(close).not.toHaveBeenCalled();expect(component.permissionsReady).toBe(false);
    context.next({capabilities:{can_view_access:true,can_manage_access:false,can_assign_editors:false,can_revoke_access:false},observatorios:[departments[0]],permisos:assigned});
    fixture.detectChanges();expect(component.readOnly).toBe(true);expect(component.departamentos).toEqual([departments[0]]);
    component.clearDepartamentos();component.toggleDepartamento('laboral',true);component.save();expect(close).not.toHaveBeenCalled();
    expect(component.selectedDepartamentoIds).toEqual(['salud']);expect(fixture.nativeElement.querySelector('.access-button.primary')).toBeNull();
  });
  function dialog(user: User) {
    const close=vi.fn();
    TestBed.configureTestingModule({providers:[
      {provide:AuthService,useValue:auth},{provide:MAT_DIALOG_DATA,useValue:user},{provide:MatDialogRef,useValue:{close}},
      {provide:DepartamentoService,useValue:{getAll:()=>of(departments)}},
      {provide:ObservatoryAccessService,useValue:{context:()=>of({capabilities:user.access_capabilities,observatorios:user.rol==='USER'?[departments[1]]:departments,permisos:user.rol==='USER'?[]:assigned})}},
    ]});
    const fixture=TestBed.createComponent(UserPermissionsDialogComponent);fixture.detectChanges();
    return {fixture,component:fixture.componentInstance,close};
  }
  it('permite consultar los editores compartidos sin conceder gestión de accesos',()=>{
    const {fixture,component,close}=dialog(editor);
    expect(component.readOnly).toBe(true);
    expect(component.departamentos.map(d=>d.id)).toEqual(['salud','laboral']);
    expect(component.selectedDepartamentoIds).toEqual(['salud']);
    expect(fixture.nativeElement.querySelector('.access-button.primary')).toBeNull();
    expect(fixture.nativeElement.querySelector('.observatorio-option input').disabled).toBe(true);
    component.clearDepartamentos();component.toggleDepartamento('laboral',true);component.save();
    expect(component.selectedDepartamentoIds).toEqual(['salud']);expect(close).not.toHaveBeenCalled();
  });
  it('muestra las acciones del editor dentro de cada acceso asignado y permite buscar sin perder la selección',async()=>{
    const {fixture,component}=dialog(editor);
    const assignedCard=fixture.nativeElement.querySelector('.observatorio-card.selected');
    expect(assignedCard.querySelector('.editor-access-included').textContent).toContain('Crear artículos, reportes y libros');
    expect(fixture.nativeElement.querySelector('.observatorio-card:not(.selected) .editor-access-included')).toBeNull();
    expect(fixture.nativeElement.querySelectorAll('[role=switch]')).toHaveLength(0);
    expect(fixture.nativeElement.querySelector('.dialog-content .user-info')).toBeNull();
    expect(fixture.nativeElement.querySelector('.dialog-container > .user-info')).not.toBeNull();
    const search=fixture.nativeElement.querySelector('input[aria-label="Buscar observatorio"]');
    search.value='laboral';search.dispatchEvent(new Event('input',{bubbles:true}));
    await fixture.whenStable();fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.observatorio-card')).toHaveLength(1);
    expect(component.selectedDepartamentoIds).toEqual(['salud']);
    search.value='';search.dispatchEvent(new Event('input',{bubbles:true}));
    await fixture.whenStable();fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.observatorio-card.selected .editor-access-included')).not.toBeNull();
  });
  it('asigna un usuario como editor solo después de seleccionar un observatorio autorizado',()=>{
    const {fixture,component,close}=dialog(normal);
    expect(component.promotingEditor).toBe(true);expect(component.departamentos.map(d=>d.id)).toEqual(['laboral']);
    expect(fixture.nativeElement.querySelector('.access-button.primary').disabled).toBe(true);
    component.save();expect(close).not.toHaveBeenCalled();
    component.toggleDepartamento('salud',true);expect(component.selectedDepartamentoIds).toEqual([]);
    component.toggleDepartamento('laboral',true);component.save();
    expect(close).toHaveBeenCalledWith([{modulo:'observatorios',nivel:'escritura',departamento_id:'laboral'}]);
  });
  it('ofrece agregar editor desde Permisos y conserva la consulta para accesos no editables',()=>{
    const open=vi.fn(()=>({afterClosed:()=>of(undefined)}));
    TestBed.configureTestingModule({providers:[provideTranslateService(),
      {provide:AuthService,useValue:auth},{provide:UserService,useValue:{getUsers:()=>of({data:[editor],meta:{last_page:1,access_capabilities:{can_assign_editors:true}}})}},
      {provide:PermisosService,useValue:{getUserPermisos:()=>assigned,syncFromBackend:()=>of(assigned)}},
      {provide:MatDialog,useValue:{open}},{provide:MatSnackBar,useValue:{open:vi.fn()}},
    ]});
    const fixture=TestBed.createComponent(AdminPermissionsComponent);
    vi.spyOn(fixture.debugElement.injector.get(MatDialog),'open').mockImplementation(open as any);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.editor-name').textContent).toContain('Nuevo editor');
    expect(fixture.nativeElement.querySelector('.reset-access').disabled).toBe(true);
    expect(fixture.nativeElement.querySelector('.manage-observatorios:not(.add-editor)').textContent).toContain('Ver accesos');
    fixture.nativeElement.querySelector('.add-editor').click();
    expect(open).toHaveBeenCalledWith(EditorPickerDialogComponent,expect.anything());
    open.mockReturnValueOnce({afterClosed:()=>of(normal)} as any);fixture.componentInstance.addEditor();
    expect(open).toHaveBeenLastCalledWith(UserPermissionsDialogComponent,expect.objectContaining({data:normal}));
  });
  it('activa revisión al asignar nuevos observatorios y respeta un permiso ya desactivado',()=>{
    const close=vi.fn();
    const previous=[{modulo:'observatorios',nivel:'escritura',departamento_id:'salud',puede_revisar:false,puede_agregar_editores:false}];
    TestBed.configureTestingModule({providers:[
      {provide:AuthService,useValue:{...auth,user:()=>({...supervisor,rol:'ADMIN'}),isAdmin:()=>true}},
      {provide:MAT_DIALOG_DATA,useValue:supervisor},{provide:MatDialogRef,useValue:{close}},
      {provide:DepartamentoService,useValue:{getAll:()=>of(departments)}},
      {provide:ObservatoryAccessService,useValue:{context:()=>of({capabilities:{can_view_access:true,can_manage_access:true,can_assign_editors:true,can_revoke_access:true},observatorios:departments,permisos:previous})}},
    ]});
    const fixture=TestBed.createComponent(UserPermissionsDialogComponent);fixture.detectChanges();
    const component=fixture.componentInstance;
    component.toggleDepartamento('laboral',true);component.save();
    expect(close).toHaveBeenCalledWith([
      expect.objectContaining({departamento_id:'salud',puede_revisar:false,puede_agregar_editores:false}),
      expect.objectContaining({departamento_id:'laboral',puede_revisar:true,puede_agregar_editores:false}),
    ]);
    component.flags('laboral').puede_revisar=false;component.toggleDepartamento('laboral',false);component.toggleDepartamento('laboral',true);component.save();
    expect(close).toHaveBeenLastCalledWith([expect.anything(),expect.objectContaining({departamento_id:'laboral',puede_revisar:false})]);
  });
  it('los interruptores del supervisor guardan el permiso del observatorio correcto',async()=>{
    const close=vi.fn();
    TestBed.configureTestingModule({providers:[
      {provide:AuthService,useValue:{...auth,user:()=>({...supervisor,rol:'ADMIN'}),isAdmin:()=>true}},
      {provide:MAT_DIALOG_DATA,useValue:supervisor},{provide:MatDialogRef,useValue:{close}},
      {provide:DepartamentoService,useValue:{getAll:()=>of(departments)}},
      {provide:ObservatoryAccessService,useValue:{context:()=>of({capabilities:{can_view_access:true,can_manage_access:true,can_assign_editors:true,can_revoke_access:true},observatorios:departments,permisos:[]})}},
    ]});
    const fixture=TestBed.createComponent(UserPermissionsDialogComponent);fixture.detectChanges();
    const checkbox=fixture.nativeElement.querySelector('input[aria-label="Asignar Laboral"]');
    checkbox.click();await fixture.whenStable();fixture.detectChanges();
    const switches=fixture.nativeElement.querySelectorAll('input[role=switch]');
    expect(switches).toHaveLength(2);expect(switches[0].checked).toBe(true);expect(switches[1].checked).toBe(false);
    expect(switches[0].getAttribute('aria-label')).toBe('Edición y revisión en Laboral');
    expect(fixture.nativeElement.querySelector('.default-permission').textContent).toContain('Activo por defecto');
    switches[0].click();switches[1].click();await fixture.whenStable();fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.default-permission')).toBeNull();
    fixture.nativeElement.querySelector('.access-button.primary').click();
    expect(close).toHaveBeenCalledWith([{modulo:'observatorios',nivel:'escritura',departamento_id:'laboral',puede_revisar:false,puede_agregar_editores:true}]);
  });
});

describe('Selector de nuevos editores',()=>{
  function setup(getUsers=vi.fn(()=>of({data:[normal],meta:{last_page:2,total:20}}))){
    const close=vi.fn();
    TestBed.configureTestingModule({providers:[{provide:AuthService,useValue:auth},
      {provide:UserService,useValue:{getUsers}},{provide:MatDialogRef,useValue:{close}},
    ]});
    const fixture=TestBed.createComponent(EditorPickerDialogComponent);fixture.detectChanges();
    return {fixture,component:fixture.componentInstance,close,getUsers};
  }
  it('pagina los candidatos y no permite seleccionar cuentas inactivas u otros roles',()=>{
    const {component,getUsers,close,fixture}=setup();
    expect(fixture.nativeElement.querySelectorAll('.candidate')).toHaveLength(1);
    component.load(2);expect(getUsers).toHaveBeenLastCalledWith(15,2,'');
    component.choose({...normal,is_active:false,access_capabilities:{can_view_access:true,can_manage_access:false,can_assign_editors:false,can_revoke_access:false}});component.choose(editor);expect(close).not.toHaveBeenCalled();
    component.choose(normal);expect(close).toHaveBeenCalledWith(normal);
  });
  it('cancela respuestas anteriores al cambiar la búsqueda y permite reintentar errores',()=>{
    const old=new Subject<any>();const fresh=new Subject<any>();
    const getUsers=vi.fn().mockReturnValueOnce(old).mockReturnValueOnce(fresh).mockReturnValueOnce(throwError(()=>new Error('offline'))).mockReturnValue(of({data:[normal],meta:{last_page:1,total:1}}));
    const {component,fixture}=setup(getUsers);
    component.search.setValue('nuevo',{emitEvent:false});component.load(1);
    fresh.next({data:[normal],meta:{last_page:1,total:1}});old.next({data:[editor],meta:{last_page:1,total:1}});
    expect(component.users()[0].rol).toBe('USER');
    component.load(1);fixture.detectChanges();expect(component.error()).toContain('No se pudieron cargar');
    component.load(1);expect(component.error()).toBe('');expect(component.users()).toEqual([normal]);
  });
  it('no selecciona candidatos con capacidades ausentes o denegadas aunque la cuenta local pueda asignar editores',()=>{
    const {component,close}=setup();
    component.choose({...normal,access_capabilities:undefined});
    component.choose({...normal,access_capabilities:{can_view_access:true,can_manage_access:false,can_assign_editors:false,can_revoke_access:false}});
    expect(close).not.toHaveBeenCalled();
  });
});
