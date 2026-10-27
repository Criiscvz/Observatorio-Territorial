import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { of, Subject, throwError } from 'rxjs';
import { AuthService } from '@core/services/auth.service';
import { UserService } from '@core/services/user.service';
import { User } from '@core/models';
import { UserEditDialogComponent, UserPasswordDialogComponent, UserRoleDialogComponent } from './user-dialogs.component';

const target:User={id:8,name:'Carlos Mendoza',email:'carlos@example.test',rol:'EDITOR',is_active:true};
function setup(type: 'password' | 'role' | 'edit' | 'new' = 'password', admin = true) {
  const api={changePassword:vi.fn(()=>of({message:'Guardado',reauthenticate:false})),updateUserRole:vi.fn(()=>of({user:{...target,rol:'ADMIN_OBSERVATORIO'}})),
    updateUser:vi.fn(()=>of({data:target})),createUser:vi.fn(()=>of({data:{...target,id:9}}))};
  const ref={close:vi.fn(),disableClose:false};
  TestBed.configureTestingModule({providers:[
    {provide:AuthService,useValue:{isAdmin:()=>admin,user:()=>({id:1,rol:admin?'ADMIN':'ADMIN_OBSERVATORIO'})}},
    {provide:UserService,useValue:api},{provide:MatDialogRef,useValue:ref},{provide:MAT_DIALOG_DATA,useValue:type==='new'?null:target},
  ]});
  return {api,ref,component:<T>(cls:new (...args:any[])=>T)=>{const fixture=TestBed.createComponent(cls);fixture.detectChanges();return {fixture,instance:fixture.componentInstance};}};
}

describe('Ventanas de acciones directas de usuarios',()=>{
  it('presenta cinco roles en el orden acordado y guarda el identificador del Supervisor',()=>{
    const {api,ref,component}=setup('role');const {fixture,instance}=component(UserRoleDialogComponent);
    expect([...fixture.nativeElement.querySelectorAll('.role-label')].map((e:any)=>e.childNodes[0].textContent.trim())).toEqual(['Administrador','Supervisor','Editor','Suscriptor','Usuario']);
    instance.form.controls.rol.setValue('ADMIN_OBSERVATORIO');fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.dialog-note').textContent).toContain('asignar sus observatorios');
    instance.save();expect(api.updateUserRole).toHaveBeenCalledWith(8,{rol:'ADMIN_OBSERVATORIO'});expect(ref.close).toHaveBeenCalledWith(expect.objectContaining({rol:'ADMIN_OBSERVATORIO'}));
  });
  it('no guarda el rol actual y conserva la elección cuando el servidor rechaza el cambio',()=>{
    const {api,ref,component}=setup('role');const {fixture,instance}=component(UserRoleDialogComponent);
    instance.save();expect(api.updateUserRole).not.toHaveBeenCalled();
    api.updateUserRole.mockReturnValueOnce(throwError(()=>({error:{message:'Sin autorización'}})));
    instance.form.controls.rol.setValue('USER');instance.save();fixture.detectChanges();
    expect(ref.close).not.toHaveBeenCalled();expect(instance.form.controls.rol.value).toBe('USER');expect(instance.saving()).toBe(false);expect(ref.disableClose).toBe(false);
    expect(fixture.nativeElement.querySelector('[role=alert]').textContent).toContain('Sin autorización');
  });
  it('valida contraseña y confirmación y las oculta inicialmente',()=>{
    const {api,component}=setup();const {fixture,instance}=component(UserPasswordDialogComponent);
    expect(fixture.nativeElement.querySelectorAll('input[type=password]')).toHaveLength(2);
    instance.form.setValue({password:'short',confirmation:'short'});instance.save();expect(api.changePassword).not.toHaveBeenCalled();
    instance.form.setValue({password:'Nueva-pass-123',confirmation:'No coincide'});instance.save();expect(api.changePassword).not.toHaveBeenCalled();
    instance.form.setValue({password:'é'.repeat(40),confirmation:'é'.repeat(40)});instance.save();expect(api.changePassword).not.toHaveBeenCalled();
    instance.form.setValue({password:'Nueva-pass-123',confirmation:'Nueva-pass-123'});fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('button[type=submit]').disabled).toBe(false);
  });
  it('envía la nueva contraseña una sola vez y limpia el formulario al confirmar el guardado',()=>{
    const {api,ref,component}=setup();const {instance}=component(UserPasswordDialogComponent);const pending=new Subject<any>();
    api.changePassword.mockReturnValue(pending);
    instance.form.setValue({password:'Nueva-pass-123',confirmation:'Nueva-pass-123'});instance.save();instance.save();instance.close();
    expect(api.changePassword).toHaveBeenCalledExactlyOnceWith(8,'Nueva-pass-123','Nueva-pass-123');expect(ref.close).not.toHaveBeenCalled();expect(ref.disableClose).toBe(true);
    pending.next({message:'Guardado',reauthenticate:false});
    expect(instance.form.getRawValue()).toEqual({password:'',confirmation:''});expect(ref.close).toHaveBeenCalledWith({message:'Guardado',reauthenticate:false});
  });
  it('conserva el formulario ante un error y permite reintentar sin exponer la contraseña en el mensaje',()=>{
    const {api,ref,component}=setup();const {fixture,instance}=component(UserPasswordDialogComponent);
    api.changePassword.mockReturnValueOnce(throwError(()=>({error:{errors:{password:['No se pudo guardar la contraseña.']}}})));
    instance.form.setValue({password:'Nueva-pass-123',confirmation:'Nueva-pass-123'});instance.save();fixture.detectChanges();
    expect(ref.close).not.toHaveBeenCalled();expect(fixture.nativeElement.querySelector('[role=alert]').textContent).not.toContain('Nueva-pass-123');
    expect(instance.form.controls.password.value).toBe('Nueva-pass-123');instance.save();expect(api.changePassword).toHaveBeenCalledTimes(2);
  });
  it('cancelar no llama al servidor y el Supervisor no puede cambiar contraseñas ni roles',()=>{
    const {api,ref,component}=setup('password',false);const {instance}=component(UserPasswordDialogComponent);
    instance.form.setValue({password:'Nueva-pass-123',confirmation:'Nueva-pass-123'});instance.save();expect(api.changePassword).not.toHaveBeenCalled();
    instance.close();expect(ref.close).toHaveBeenCalledWith();
  });
  it('la edición de datos no envía contraseñas ni modifica el rol',()=>{
    const {api,component}=setup('edit');const {fixture,instance}=component(UserEditDialogComponent);
    expect(fixture.nativeElement.querySelector('input[type=password]')).toBeNull();
    instance.form.controls.name.setValue(' Carlos actualizado ');instance.save();
    expect(api.updateUser).toHaveBeenCalledWith(8,expect.objectContaining({name:'Carlos actualizado'}));
    const payload=(api.updateUser.mock.calls as any)[0][1];expect(payload.password).toBeUndefined();expect(payload.rol).toBeUndefined();
  });
  it('permite crear una cuenta con contraseña confirmada y los roles visibles en orden',()=>{
    const {api,component}=setup('new');const {fixture,instance}=component(UserEditDialogComponent);
    expect([...fixture.nativeElement.querySelectorAll('select option')].map((e:any)=>e.textContent.trim())).toEqual(['Administrador','Supervisor','Editor','Suscriptor','Usuario']);
    instance.form.patchValue({name:'Ana Prueba',email:'ana@example.test',password:'Nueva-pass-123',confirmation:'Distinta'});instance.save();expect(api.createUser).not.toHaveBeenCalled();
    instance.form.controls.confirmation.setValue('Nueva-pass-123');instance.save();
    expect(api.createUser).toHaveBeenCalledWith(expect.objectContaining({name:'Ana Prueba',email:'ana@example.test',password:'Nueva-pass-123',rol:'USER'}));
  });
});
