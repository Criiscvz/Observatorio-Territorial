import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router } from '@angular/router';
import { Subject, catchError, debounceTime, of, switchMap } from 'rxjs';
import { User, UserRole } from '@core/models';
import { USER_ROLE_OPTIONS, userRoleIcon, userRoleLabel } from '@core/models/user/user-role.presentation';
import { AuthService } from '@core/services/auth.service';
import { UserService } from '@core/services/user.service';
import { PermisosService } from '@core/services/permisos.service';
import { ConfirmDialogComponent, ConfirmDialogData } from '@shared/components/confirm-dialog/confirm-dialog.component';
import { UserPermissionsDialogComponent } from '../../permisos/user-permissions-dialog.component';
import { UserEditDialogComponent, UserPasswordDialogComponent, UserRoleDialogComponent } from '../user-dialogs.component';

@Component({selector:'app-usuario-list',standalone:true,imports:[ReactiveFormsModule,MatDialogModule,MatIconModule,MatTooltipModule],
  templateUrl:'./usuario-list.component.html',styleUrl:'./usuario-list.component.scss'})
export class UsuarioListComponent implements OnInit {
  readonly auth=inject(AuthService);
  private readonly api=inject(UserService);
  private readonly permissions=inject(PermisosService);
  private readonly dialog=inject(MatDialog);
  private readonly snackBar=inject(MatSnackBar);
  private readonly router=inject(Router);
  private readonly destroyRef=inject(DestroyRef);
  private readonly requests=new Subject<number>();
  readonly roles=USER_ROLE_OPTIONS;
  readonly roleLabel=userRoleLabel;
  readonly roleIcon=userRoleIcon;
  readonly users=signal<User[]>([]);
  readonly loading=signal(true);
  readonly error=signal('');
  readonly busyUserId=signal<number|null>(null);
  readonly currentPage=signal(1);
  readonly pageSize=signal(15);
  readonly totalItems=signal(0);
  readonly lastPage=signal(1);
  readonly filters=inject(FormBuilder).nonNullable.group({search:[''],rol:['' as UserRole|'']});
  private readonly dialogOptions={width:'660px',maxWidth:'calc(100vw - 24px)',maxHeight:'calc(100dvh - 32px)',panelClass:'user-management-dialog-panel',autoFocus:'.user-dialog-header button'};
  get firstItem():number { return this.totalItems() ? (this.currentPage()-1)*this.pageSize()+1 : 0; }
  get lastItem():number { return Math.min(this.currentPage()*this.pageSize(),this.totalItems()); }

  ngOnInit():void {
    this.requests.pipe(switchMap(page=>{
      this.loading.set(true);this.error.set('');
      return this.api.getUsers(this.pageSize(),page,this.filters.controls.search.value.trim()||undefined,undefined,
        this.auth.isAdmin() ? this.filters.controls.rol.value||undefined : undefined).pipe(catchError(error=>{
          this.error.set(error?.status===403?'No tienes permiso para consultar estos usuarios.':'No se pudieron cargar los usuarios. Inténtalo nuevamente.');this.users.set([]);return of(null);
        }));
    }),takeUntilDestroyed(this.destroyRef)).subscribe(response=>{
      this.loading.set(false);if(!response)return;
      if(response.meta.current_page>response.meta.last_page && response.meta.total>0){this.loadUsers(response.meta.last_page);return;}
      this.users.set(response.data);this.currentPage.set(response.meta.total ? response.meta.current_page : 1);
      this.totalItems.set(response.meta.total);this.lastPage.set(Math.max(1,response.meta.last_page));
    });
    this.filters.valueChanges.pipe(debounceTime(300),takeUntilDestroyed(this.destroyRef)).subscribe(()=>this.loadUsers(1));
    this.loadUsers();
  }
  loadUsers(page=1):void { this.requests.next(Math.max(1,page)); }
  changePage(direction:number):void { if(!this.loading())this.loadUsers(Math.max(1,Math.min(this.currentPage()+direction,this.lastPage()))); }
  changePageSize(value:string):void { const count=Number(value);if([15,25,50].includes(count)){this.pageSize.set(count);this.loadUsers(1);} }
  initials(user:User):string { return user.name.trim().split(/\s+/).slice(0,2).map(name=>name[0]).join('').toUpperCase(); }
  private savedUser(user:User,message:string):void {
    this.snackBar.open(message,'Cerrar',{duration:3500});this.loadUsers(this.currentPage());
    if(user.id===this.auth.user()?.id) this.auth.getCurrentUser().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next:current=>{if(current.rol!=='ADMIN')this.router.navigate([['EDITOR','ADMIN_OBSERVATORIO'].includes(current.rol)?'/admin/dashboard':'/publico/departamentos']);},error:()=>{},
    });
  }
  openRoleDialog(user:User):void {
    if(!this.auth.isAdmin()||this.busyUserId()!==null)return;
    this.dialog.open(UserRoleDialogComponent,{...this.dialogOptions,data:user}).afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe((updated:User|undefined)=>{if(updated)this.savedUser(updated,`Rol actualizado a ${userRoleLabel(updated.rol)}.`);});
  }
  openUserDialog(user:User|null=null):void {
    if(!this.auth.isAdmin()||this.busyUserId()!==null)return;
    this.dialog.open(UserEditDialogComponent,{...this.dialogOptions,data:user}).afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe((updated:User|undefined)=>{if(updated)this.savedUser(updated,user?'Datos del usuario actualizados.':'Usuario creado correctamente.');});
  }
  openPasswordDialog(user:User):void {
    if(!this.auth.isAdmin()||this.busyUserId()!==null)return;
    this.dialog.open(UserPasswordDialogComponent,{...this.dialogOptions,width:'590px',data:user}).afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe(result=>{
        if(!result)return;
        if(result.reauthenticate){this.auth.clearAuthSilent();this.router.navigate(['/auth/login']);}
        this.snackBar.open(result.reauthenticate?'Contraseña actualizada. Inicia sesión con tu nueva contraseña.':'Contraseña actualizada correctamente. El usuario ya puede utilizarla.','Cerrar',{duration:5000});
      });
  }
  canManagePermissions(user:User):boolean {
    return this.auth.isAdmin() ? ['EDITOR','ADMIN_OBSERVATORIO'].includes(user.rol)
      : this.auth.user()?.rol==='ADMIN_OBSERVATORIO' && this.auth.canAssignEditors() && user.rol==='USER';
  }
  openPermissionsDialog(user:User):void {
    if(!this.canManagePermissions(user)||this.busyUserId()!==null)return;
    this.dialog.open(UserPermissionsDialogComponent,{width:'760px',maxWidth:'calc(100vw - 24px)',maxHeight:'calc(100dvh - 32px)',panelClass:'access-management-dialog-panel',data:user})
      .afterClosed().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(result=>{
        if(!result)return;this.busyUserId.set(user.id);
        this.permissions.saveUserPermisos(user.id,result).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
          next:()=>{this.busyUserId.set(null);this.snackBar.open('Permisos guardados correctamente.','Cerrar',{duration:3500});this.loadUsers(this.currentPage());},
          error:error=>{this.busyUserId.set(null);this.snackBar.open(error?.error?.message||'No se pudieron guardar los permisos.','Cerrar',{duration:4000});},
        });
      });
  }
  toggleStatus(user:User):void {
    if(!this.auth.isAdmin()||user.id===this.auth.user()?.id||this.busyUserId()!==null)return;
    const activate=!user.is_active;
    this.confirm(user,{title:activate?'Activar usuario':'Desactivar usuario',
      message:activate?`¿Permitir que ${user.name} vuelva a acceder a su cuenta?`:`¿Desactivar la cuenta de ${user.name}?`,
      icon:activate?'check_circle':'block',confirmText:activate?'Activar':'Desactivar',confirmColor:activate?'primary':'warn',
      confirmAction:()=>this.api.toggleUserStatus(user.id,activate)},activate?'Usuario activado.':'Usuario desactivado.');
  }
  deleteUser(user:User):void {
    if(!this.auth.isAdmin()||user.id===this.auth.user()?.id||this.busyUserId()!==null)return;
    this.confirm(user,{title:'Eliminar usuario',message:`¿Eliminar la cuenta de ${user.name}?`,icon:'delete_outline',confirmText:'Eliminar usuario',confirmColor:'warn',confirmAction:()=>this.api.deleteUser(user.id)},'Usuario eliminado.');
  }
  private confirm(user:User,data:ConfirmDialogData,success:string):void {
    this.busyUserId.set(user.id);
    this.dialog.open(ConfirmDialogComponent,{width:'450px',maxWidth:'calc(100vw - 24px)',panelClass:'app-confirm-dialog-panel',backdropClass:'app-confirm-dialog-backdrop',data:{...data,onError:(error:any)=>this.snackBar.open(error?.error?.message||'No se pudo completar la operación.','Cerrar',{duration:4000})}})
      .afterClosed().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(confirmed=>{this.busyUserId.set(null);if(confirmed){this.snackBar.open(success,'Cerrar',{duration:3000});this.loadUsers(this.currentPage());}});
  }
}
