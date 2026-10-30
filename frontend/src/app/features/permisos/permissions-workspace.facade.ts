import { Injectable, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EMPTY, Subject, Subscription, catchError, defer, finalize, forkJoin, of, switchMap, tap } from 'rxjs';
import { User } from '@core/models';
import { ModuloPermiso, NivelPermiso, PermisoConfig } from '@core/models/permisos';
import { AuthService } from '@core/services/auth.service';
import { UserService } from '@core/services/user.service';
import { PermisosService } from '@core/services/permisos.service';

/** Per-screen access list. Server capabilities authorize UI actions; cached counts are presentation only. */
@Injectable()
export class PermissionsWorkspaceFacade {
  private readonly userService=inject(UserService);
  private readonly permisosService=inject(PermisosService);
  private readonly destroyRef=inject(DestroyRef);
  private loadRequest?: Subscription;
  private readonly loadFailures=new Subject<void>();
  readonly loadErrors=this.loadFailures.asObservable();
  readonly auth = inject(AuthService);

  readonly selectedRole = signal<'EDITOR' | 'ADMIN_OBSERVATORIO'>(this.auth.user()?.rol === 'ADMIN_OBSERVATORIO' ? 'EDITOR' : 'ADMIN_OBSERVATORIO');

  roleCount(role: string): number { return this.users().filter(user => user.rol === role).length; }

  changeRoleTab(role: 'EDITOR' | 'ADMIN_OBSERVATORIO'): void {
    this.selectedRole.set(role); this.resetConfirmationId.set(null);
  }

  readonly canAssignEditors = signal(false);

  users = signal<User[]>([]);

  loadingUsers = signal(true);

  searchTerm = signal('');

  resetConfirmationId = signal<number | null>(null);

  savingUserId = signal<number | null>(null);

  saveStatus = signal('');

  filteredUsers = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    return this.users().filter((user) => {
      const matchesTerm =
        !term ||
        user.name?.toLowerCase().includes(term) ||
        user.email?.toLowerCase().includes(term);
      return user.rol === this.selectedRole() && matchesTerm;
    });
  });

  getUserPermisos(user: User): PermisoConfig[] {
    return this.permisosService.getUserPermisos(user.id);
  }

  getModuloNivel(user: User, modulo: ModuloPermiso): NivelPermiso {
    return this.permisosService.getNivel(user.id, modulo);
  }

  getActivePermissionsCount(user: User): number {
    return this.getAssignedObservatoriosCount(user);
  }

  getAssignedObservatoriosCount(user: User): number {
    return this.getUserPermisos(user).filter(
      (permiso) => permiso.modulo === 'observatorios' && permiso.nivel !== 'ninguno',
    ).length;
  }

  hasAllObservatorios(user: User): boolean {
    return this.getUserPermisos(user).some(
      (permiso) => permiso.modulo === 'observatorios' && permiso.nivel !== 'ninguno'
        && permiso.departamento_id === null,
    );
  }

  getAssignedObservatoriosNames(user: User): string[] {
    if (this.hasAllObservatorios(user)) return [];
    const assignedIds = new Set(this.getUserPermisos(user)
      .filter((permiso) => permiso.modulo === 'observatorios' && permiso.nivel !== 'ninguno')
      .map((permiso) => permiso.departamento_id));
    return (user.departamentos || [])
      .filter((departamento) => assignedIds.has(departamento.id))
      .map((departamento) => departamento.nombre);
  }

  tienePermisosPersonalizados(user: User): boolean {
    return this.permisosService.getUserPermisos(user.id).length > 0;
  }

  canManageUser(user: User): boolean {
    return user.access_capabilities?.can_manage_access === true;
  }

  loadUsers(): void {
    if (this.savingUserId() !== null) return;
    this.loadRequest?.unsubscribe();
    this.loadingUsers.set(true); this.canAssignEditors.set(false); this.resetConfirmationId.set(null);
    this.loadRequest=this.userService.getUsers(100,1,undefined,'permissions').pipe(
      switchMap(first => {
        const requests=[of(first)];
        for(let page=2;page<=first.meta.last_page;page++) requests.push(this.userService.getUsers(100,page,undefined,'permissions'));
        return forkJoin(requests);
      }),
      tap(responses => {
        this.users.set(responses.flatMap(response=>response.data));
        this.canAssignEditors.set(responses[0]?.meta.access_capabilities?.can_assign_editors === true);
        this.loadingUsers.set(false);
      }),
      switchMap(() => {
        const editors=this.users().filter(user=>['EDITOR','ADMIN_OBSERVATORIO'].includes(user.rol));
        return (editors.length ? forkJoin(editors.map(user=>this.permisosService.syncFromBackend(user.id))) : of([]))
          .pipe(catchError(()=>of([])));
      }),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next:()=>this.users.set([...this.users()]),
      error:()=>{this.users.set([]);this.canAssignEditors.set(false);this.loadingUsers.set(false);this.loadFailures.next();},
    });
  }

  saveAccess(user:User, permissions:PermisoConfig[], revoke=false) {
    return defer(() => {
      const capability=revoke ? user.access_capabilities?.can_revoke_access : user.access_capabilities?.can_manage_access;
      if(this.loadingUsers() || this.savingUserId() !== null || capability !== true
        || (revoke && this.resetConfirmationId() !== user.id)) return EMPTY;
      // Prevent an older display refresh from overwriting the result of this write.
      this.loadRequest?.unsubscribe();
      this.savingUserId.set(user.id);this.saveStatus.set('');
      return this.permisosService.saveUserPermisos(user.id,permissions).pipe(takeUntilDestroyed(this.destroyRef),tap({
        next:response=>{
          this.savingUserId.set(null);
          if(revoke)this.resetConfirmationId.set(null);
          this.saveStatus.set(revoke ? `Accesos de ${user.name} retirados.` : 'Asignación de observatorios actualizada.');
          this.users.update(items=>items.map(item=>item.id===response.user?.id ? response.user : item));
          if(!this.auth.isAdmin())this.loadUsers();
        },
        error:()=>this.saveStatus.set(revoke ? 'No se pudieron quitar los accesos. Puedes volver a intentarlo.' : 'No se pudieron guardar los permisos. Puedes volver a intentarlo.'),
      }),finalize(()=>this.savingUserId.set(null)));
    });
  }
}
