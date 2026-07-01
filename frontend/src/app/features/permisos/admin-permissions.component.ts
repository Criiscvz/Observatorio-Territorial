import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
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
import { forkJoin, of } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { PermisosService, RolePermissionConfig, SystemPermissions } from '@core/services/permisos.service';
import { UserService } from '@core/services/user.service';
import { User } from '@core/models';
import { UserPermissionsDialogComponent } from '../usuarios/user-permissions-dialog.component';

@Component({
  selector: 'app-admin-permissions',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatCardModule,
    MatCheckboxModule,
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
  private readonly permisosService = inject(PermisosService);
  private readonly userService = inject(UserService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  permissions!: SystemPermissions;
  rolesList = ['EDITOR', 'SUBSCRIBER', 'USER'];

  // Gestión de permisos por usuario
  users = signal<User[]>([]);
  loadingUsers = signal(true);
  searchTerm = signal('');
  roleFilter = signal<string>('ALL');

  filteredUsers = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const role = this.roleFilter();
    return this.users().filter((user) => {
      const matchesRole = role === 'ALL' || user.rol === role;
      const matchesTerm =
        !term ||
        user.name?.toLowerCase().includes(term) ||
        user.email?.toLowerCase().includes(term);
      return matchesRole && matchesTerm;
    });
  });

  ngOnInit(): void {
    this.loadPermissions();
    this.loadUsers();
  }

  loadPermissions(): void {
    // Deep clone the object so modifications don't apply immediately until saved
    this.permissions = JSON.parse(JSON.stringify(this.permisosService.getRolePermissions()));
  }

  loadUsers(): void {
    this.loadingUsers.set(true);
    // Cargamos la primera página y, si hay más, el resto en paralelo para listar TODOS los usuarios.
    this.userService
      .getUsers(100, 1)
      .pipe(
        switchMap((first) => {
          const lastPage = first.meta.last_page;
          if (lastPage <= 1) {
            return of([first]);
          }
          const requests = [of(first)];
          for (let page = 2; page <= lastPage; page++) {
            requests.push(this.userService.getUsers(100, page));
          }
          return forkJoin(requests);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (responses) => {
          const all = responses.flatMap((r) => r.data);
          this.users.set(all);
          this.loadingUsers.set(false);
        },
        error: () => {
          this.snackBar.open(
            this.translate.instant('users.messages.loadError') || 'No se pudieron cargar los usuarios.',
            this.translate.instant('common.buttons.close') || 'Cerrar',
            { duration: 3000 },
          );
          this.loadingUsers.set(false);
        },
      });
  }

  savePermissions(): void {
    this.permisosService.saveRolePermissions(this.permissions);
    this.snackBar.open(
      this.translate.instant('permissions.messages.saved') || 'Permisos guardados correctamente.',
      this.translate.instant('common.buttons.close') || 'Cerrar',
      { duration: 3000 }
    );
  }

  resetDefaults(): void {
    localStorage.removeItem('observatorio_role_permissions');
    this.loadPermissions();
    this.snackBar.open(
      'Configuración restablecida a los valores por defecto.',
      'Cerrar',
      { duration: 3000 }
    );
  }

  // --- Permisos por usuario ---

  getUserConfig(user: User): RolePermissionConfig {
    return this.permisosService.getUserPermissions(user.id, user.rol);
  }

  hasCustomPermissions(user: User): boolean {
    return this.permisosService.hasCustomPermissions(user.id);
  }

  getRoleBadgeClass(rol: string): string {
    return 'badge-' + (rol || 'user').toLowerCase();
  }

  getInitial(user: User): string {
    return user.name?.charAt(0)?.toUpperCase() || 'U';
  }

  openPermissionsDialog(user: User): void {
    const dialogRef = this.dialog.open(UserPermissionsDialogComponent, {
      width: '460px',
      maxWidth: '95vw',
      autoFocus: false,
      data: user,
    });

    dialogRef
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => {
        if (result) {
          this.permisosService.saveUserPermissions(user.id, result);
          // Reasignamos la señal para refrescar los indicadores calculados.
          this.users.set([...this.users()]);
          this.snackBar.open(
            'Permisos personalizados guardados correctamente para el usuario.',
            'Cerrar',
            { duration: 3000 },
          );
        }
      });
  }

  resetUserPermissions(user: User): void {
    this.permisosService.clearUserPermissions(user.id);
    this.users.set([...this.users()]);
    this.snackBar.open(
      `Permisos de ${user.name} restablecidos a los valores de su rol.`,
      'Cerrar',
      { duration: 3000 },
    );
  }
}
