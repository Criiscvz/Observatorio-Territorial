import { PermissionsWorkspaceFacade } from './permissions-workspace.facade';
import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { User } from '@core/models';
import {
  ModuloPermiso,
  NivelPermiso,
  PermisoConfig,
} from '@core/models/permisos';
import { UserPermissionsDialogComponent } from './user-permissions-dialog.component';
import { EditorPickerDialogComponent } from './editor-picker-dialog.component';

@Component({
  selector: 'app-admin-permissions',
  providers: [PermissionsWorkspaceFacade],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatCardModule,
    MatDialogModule,
    MatDividerModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatSnackBarModule,
    MatTooltipModule,
    TranslateModule,
  ],
  templateUrl: './admin-permissions.component.html',
  styleUrl: './admin-permissions.component.scss',
})
export class AdminPermissionsComponent implements OnInit {
  private readonly state=inject(PermissionsWorkspaceFacade);
  readonly auth=this.state.auth;
  readonly selectedRole=this.state.selectedRole;
  readonly roleTabs = [{ value: 'ADMIN_OBSERVATORIO' as const, label: 'Supervisor', icon: 'manage_accounts' },
    { value: 'EDITOR' as const, label: 'Editor', icon: 'edit_note' }];
  roleCount(role: string): number {return this.state.roleCount(role);}
  changeRoleTab(role: 'EDITOR' | 'ADMIN_OBSERVATORIO'): void {return this.state.changeRoleTab(role);}
  roleTabKeydown(event: KeyboardEvent): void {
    const buttons = Array.from((event.currentTarget as HTMLElement).parentElement!.querySelectorAll<HTMLButtonElement>('[role=tab]'));
    const current = buttons.indexOf(event.currentTarget as HTMLButtonElement);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1
      : event.key === 'ArrowRight' ? (current + 1) % buttons.length : event.key === 'ArrowLeft' ? (current + buttons.length - 1) % buttons.length : -1;
    if (next < 0) return;
    event.preventDefault(); buttons[next].click(); buttons[next].focus();
  }

  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  readonly editorPermissions = [
    'Crear Artículos',
    'Crear Reportes',
    'Crear Libros',
    'Envíos en revisión',
    'Panel del editor',
  ];
  readonly roleSummaries = [
    {
      rol: 'ADMIN',
      label: 'Administrador',
      icon: 'admin_panel_settings',
      description: 'Control total del sistema, usuarios, observatorios y biblioteca.',
      access: 'Acceso completo',
      permissions: ['Todos los módulos', 'Aprobar y publicar', 'Asignar permisos'],
    },
    {
      rol: 'ADMIN_OBSERVATORIO', label: 'Supervisor', icon: 'manage_accounts',
      description: 'Administra únicamente sus observatorios asignados.', access: 'Dos permisos independientes por observatorio',
      permissions: ['Edición y revisión', 'Agregar editores'],
    },
    {
      rol: 'EDITOR',
      label: 'Editor',
      icon: 'edit_note',
      description: 'Gestiona contenidos en los Observatorios asignados.',
      access: 'Configurable por usuario',
      permissions: ['Observatorios asignados', 'Crear Artículos, Reportes y Libros', 'Envíos en revisión'],
    },
    {
      rol: 'SUBSCRIBER',
      label: 'Suscriptor',
      icon: 'workspace_premium',
      description: 'Puede ver contenido publicado marcado como solo para suscriptores.',
      access: 'Lectura suscriptor',
      permissions: ['Contenido publicado', 'Contenido solo suscriptores'],
    },
  ];

  readonly canAssignEditors=this.state.canAssignEditors;
  readonly users=this.state.users;
  readonly loadingUsers=this.state.loadingUsers;
  readonly searchTerm=this.state.searchTerm;
  readonly resetConfirmationId=this.state.resetConfirmationId;
  readonly savingUserId=this.state.savingUserId;
  readonly saveStatus=this.state.saveStatus;

  readonly filteredUsers=this.state.filteredUsers;

  ngOnInit(): void {
    this.state.loadErrors.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.snackBar.open(
      this.translate.instant('users.messages.loadError') || 'No se pudieron cargar los usuarios.',
      this.translate.instant('common.buttons.close') || 'Cerrar', {duration:3000}));
    this.loadUsers();
  }

  loadUsers():void {this.state.loadUsers();}

  // ─── helpers de UI ───

  getUserPermisos(user: User): PermisoConfig[] {return this.state.getUserPermisos(user);}

  getModuloNivel(user: User, modulo: ModuloPermiso): NivelPermiso {return this.state.getModuloNivel(user,modulo);}

  getNivelChipClass(nivel: NivelPermiso): string {
    const map: Record<NivelPermiso, string> = {
      ninguno: 'nivel-none',
      lectura: 'nivel-read',
      escritura: 'nivel-write',
      admin: 'nivel-admin',
    };
    return map[nivel] ?? 'nivel-none';
  }

  getRoleBadgeClass(rol: string): string {
    return 'badge-' + (rol || 'user').toLowerCase();
  }

  getInitial(user: User): string {
    return user.name?.charAt(0)?.toUpperCase() || 'U';
  }

  getActivePermissionsCount(user: User): number {return this.state.getActivePermissionsCount(user);}

  getAssignedObservatoriosCount(user: User): number {return this.state.getAssignedObservatoriosCount(user);}

  hasAllObservatorios(user: User): boolean {return this.state.hasAllObservatorios(user);}

  getAssignedObservatoriosNames(user: User): string[] {return this.state.getAssignedObservatoriosNames(user);}

  tienePermisosPersonalizados(user: User): boolean {return this.state.tienePermisosPersonalizados(user);}

  // ─── acciones ───

  canManageUser(user: User): boolean {return this.state.canManageUser(user);}

  addEditor(): void {
    if (this.auth.user()?.rol !== 'ADMIN_OBSERVATORIO' || !this.canAssignEditors() || this.savingUserId() !== null) return;
    this.dialog.open(EditorPickerDialogComponent, {
      width: '620px', maxWidth: 'calc(100vw - 24px)', maxHeight: 'calc(100dvh - 32px)',
      panelClass: 'access-management-dialog-panel', autoFocus: false,
    }).afterClosed().pipe(takeUntilDestroyed(this.destroyRef)).subscribe((user: User | undefined) => {
      if (user) this.openPermissionsDialog(user);
    });
  }

  openPermissionsDialog(user: User): void {
    if (user.access_capabilities?.can_view_access !== true || this.savingUserId() !== null) return;
    this.resetConfirmationId.set(null);
    const dialogRef = this.dialog.open(UserPermissionsDialogComponent, {
      width: '760px',
      maxWidth: 'calc(100vw - 24px)',
      maxHeight: 'calc(100dvh - 32px)',
      panelClass: 'access-management-dialog-panel',
      autoFocus: false,
      data: user,
    });

    dialogRef
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result: PermisoConfig[] | undefined) => {
        if (result) {
          this.state.saveAccess(user,result).subscribe({
              next: (response) => {
                this.snackBar.open(
                  response.message || 'Permisos guardados correctamente.',
                  'Cerrar',
                  { duration: 3000 },
                );
              },
              error: () => {
                this.snackBar.open(
                  'No se pudieron guardar los permisos.',
                  'Cerrar',
                  { duration: 4000 },
                );
              },
            });
        }
      });
  }

  resetUserPermissions(user: User): void {
    this.state.saveAccess(user,[{modulo:'observatorios',nivel:'ninguno',departamento_id:null}],true).subscribe({
      next:()=>this.snackBar.open(`Permisos de ${user.name} restablecidos.`,'Cerrar',{duration:3000}),
      error:()=>this.snackBar.open('No se pudieron restablecer los permisos.','Cerrar',{duration:4000}),
    });
  }
}
