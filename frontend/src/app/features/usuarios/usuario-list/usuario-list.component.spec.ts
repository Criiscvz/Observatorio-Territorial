import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router, provideRouter } from '@angular/router';
import { of, Subject } from 'rxjs';
import { User } from '@core/models';
import { AuthService } from '@core/services/auth.service';
import { UserService } from '@core/services/user.service';
import { PermisosService } from '@core/services/permisos.service';
import { UserPasswordDialogComponent, UserRoleDialogComponent } from '../user-dialogs.component';
import { UsuarioListComponent } from './usuario-list.component';

const user:User={id:8,name:'Carlos Mendoza',email:'carlos@example.test',rol:'ADMIN_OBSERVATORIO',is_active:true};
const page=(users:User[]=[user])=>({data:users,meta:{current_page:1,last_page:1,per_page:15,total:users.length}});
describe('Usuarios con acciones directas',()=>{
  it('usa la capacidad de gestión del usuario y no concede el acceso por el rol local administrador',()=>{
    const {component}=setup();
    expect(component.canManagePermissions(user)).toBe(false);
    expect(component.canManagePermissions({...user,access_capabilities:{can_view_access:true,can_manage_access:true,can_assign_editors:true,can_revoke_access:true}})).toBe(true);
  });
  function setup(admin=true){
    const auth={isAdmin:()=>admin,user:()=>({id:1,rol:admin?'ADMIN':'ADMIN_OBSERVATORIO'}),canAssignEditors:()=>true,clearAuthSilent:vi.fn(),getCurrentUser:()=>of(user)};
    const api={getUsers:vi.fn(()=>of(page(admin?[user]:[{...user,rol:'USER'}])))};
    const afterClosed=new Subject<any>();const dialog={open:vi.fn(()=>({afterClosed:()=>afterClosed}))};
    TestBed.configureTestingModule({providers:[provideRouter([]),{provide:AuthService,useValue:auth},{provide:UserService,useValue:api},
      {provide:MatDialog,useValue:dialog},{provide:MatSnackBar,useValue:{open:vi.fn()}},{provide:PermisosService,useValue:{saveUserPermisos:()=>of({})}},
    ]});TestBed.overrideProvider(MatDialog,{useValue:dialog});
    const fixture=TestBed.createComponent(UsuarioListComponent);
    vi.spyOn(fixture.debugElement.injector.get(MatDialog),'open').mockImplementation(dialog.open as any);
    fixture.detectChanges();
    return {fixture,component:fixture.componentInstance,api,dialog,afterClosed,auth};
  }
  it('muestra nombre y correo juntos, Supervisor y accesos directos sin menús anidados',()=>{
    const {fixture}=setup();const el=fixture.nativeElement;
    expect(el.querySelectorAll('th')).toHaveLength(4);expect(el.querySelector('.user-identity').textContent).toContain('carlos@example.test');
    expect(el.querySelector('.role-badge').textContent).toContain('Supervisor');expect(el.querySelector('[matMenuTriggerFor]')).toBeNull();
    expect(el.querySelector('button[aria-label="Cambiar contraseña de Carlos Mendoza"]')).not.toBeNull();
  });
  it('abre la ventana del rol o la contraseña para el usuario seleccionado y respeta cancelar',()=>{
    const {fixture,dialog,afterClosed,api}=setup();
    fixture.nativeElement.querySelector('button[aria-label="Cambiar rol de Carlos Mendoza"]').click();
    expect(dialog.open).toHaveBeenCalledWith(UserRoleDialogComponent,expect.objectContaining({data:user}));
    afterClosed.next(undefined);expect(api.getUsers).toHaveBeenCalledTimes(1);
    fixture.nativeElement.querySelector('button[aria-label="Cambiar contraseña de Carlos Mendoza"]').click();
    expect(dialog.open).toHaveBeenLastCalledWith(UserPasswordDialogComponent,expect.objectContaining({data:user}));
  });
  it('cierra la identidad local al cambiar la contraseña propia y redirige al acceso',()=>{
    const {component,afterClosed,auth}=setup();const navigate=vi.spyOn(TestBed.inject(Router),'navigate').mockResolvedValue(true);
    component.openPasswordDialog({...user,id:1});afterClosed.next({message:'Guardada',reauthenticate:true});
    expect(auth.clearAuthSilent).toHaveBeenCalledOnce();expect(navigate).toHaveBeenCalledWith(['/auth/login']);
  });
  it('el Supervisor solo puede agregar editores y no puede invocar acciones de administración',()=>{
    const {fixture,component,dialog}=setup(false);const el=fixture.nativeElement;
    expect(el.textContent).toContain('Agregar editor');expect(el.querySelector('select[formControlName=rol]')).toBeNull();
    expect(el.querySelector('button[aria-label^="Cambiar contraseña"]')).toBeNull();
    component.openPasswordDialog(user);component.openRoleDialog(user);component.openUserDialog(user);component.deleteUser(user);expect(dialog.open).not.toHaveBeenCalled();
  });
  it('incluye el filtro de rol en la petición paginada y descarta respuestas anteriores',()=>{
    const {component,api}=setup();const old=new Subject<any>(),current=new Subject<any>();
    api.getUsers.mockReturnValueOnce(old);component.loadUsers();
    api.getUsers.mockReturnValueOnce(current);component.filters.controls.rol.setValue('EDITOR');component.loadUsers(1);
    old.next(page([{...user,id:12,name:'Respuesta antigua'}]));expect(component.users()[0].name).not.toBe('Respuesta antigua');
    current.next(page([{...user,rol:'EDITOR'}]));expect(component.users()[0].rol).toBe('EDITOR');
    expect(api.getUsers).toHaveBeenLastCalledWith(15,1,undefined,undefined,'EDITOR');
  });
});
