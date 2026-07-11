import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
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
import { forkJoin, of } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { PermisosService } from '@core/services/permisos.service';
import { UserService } from '@core/services/user.service';
import { User } from '@core/models';
import {
  ModuloPermiso,
  NivelPermiso,
  PermisoConfig,
  MODULOS_PERMISO,
  MODULO_LABELS,
  MODULO_ICONS,
  NIVEL_LABELS,
} from '@core/models/permisos';
import { UserPermissionsDialogComponent } from './user-permissions-dialog.component';

@Component({
  selector: 'app-admin-permissions',
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
  private readonly permisosService = inject(PermisosService);
  private readonly userService = inject(UserService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  readonly modulos = MODULOS_PERMISO;
  readonly moduloLabels = MODULO_LABELS;
  readonly moduloIcons = MODULO_ICONS;
  readonly nivelLabels = NIVEL_LABELS;
  readonly roleSummaries = [
    {
      rol: 'ADMIN',
      label: 'Administrador',
      icon: 'admin_panel_settings',
      description: 'Control total del sistema, usuarios, observatorios y biblioteca.',
      access: 'Acceso completo',
    },
    {
      rol: 'EDITOR',
      label: 'Editor',
      icon: 'edit_note',
      description: 'Gestiona contenidos en los Observatorios asignados.',
      access: 'Configurable por usuario',
    },
    {
      rol: 'SUBSCRIBER',
      label: 'Suscriptor',
      icon: 'workspace_premium',
      description: 'Puede ver contenido publicado marcado como solo para suscriptores.',
      access: 'Lectura suscriptor',
    },
    {
      rol: 'USER',
      label: 'Usuario',
      icon: 'person',
      description: 'Acceso de lectura a contenido público publicado.',
      access: 'Lectura pública',
    },
  ];

  users = signal<User[]>([]);
  loadingUsers = signal(true);
  searchTerm = signal('');
  roleFilter = signal<string>('ALL');

  filteredUsers = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    return this.users().filter((user) => {
      const isEditor = user.rol === 'EDITOR';
      const matchesTerm =
        !term ||
        user.name?.toLowerCase().includes(term) ||
        user.email?.toLowerCase().includes(term);
      return isEditor && matchesTerm;
    });
  });

  ngOnInit(): void {
    this.loadUsers();
  }

  loadUsers(): void {
    this.loadingUsers.set(true);
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

          const editors = all.filter((user) => user.rol === 'EDITOR');
          if (editors.length > 0) {
            forkJoin(editors.map((user) => this.permisosService.syncFromBackend(user.id)))
              .pipe(takeUntilDestroyed(this.destroyRef))
              .subscribe({
                next: () => this.users.set([...this.users()]),
                error: () => this.users.set([...this.users()]),
              });
          }
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

  // ─── helpers de UI ───

  getUserPermisos(user: User): PermisoConfig[] {
    return this.permisosService.getUserPermisos(user.id);
  }

  getModuloNivel(user: User, modulo: ModuloPermiso): NivelPermiso {
    return this.permisosService.getNivel(user.id, modulo);
  }

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

  getActivePermissionsCount(user: User): number {
    return this.getUserPermisos(user).filter((permiso) => permiso.nivel !== 'ninguno').length;
  }

  tienePermisosPersonalizados(user: User): boolean {
    return this.permisosService.getUserPermisos(user.id).length > 0;
  }

  // ─── acciones ───

  openPermissionsDialog(user: User): void {
    const dialogRef = this.dialog.open(UserPermissionsDialogComponent, {
      width: '520px',
      maxWidth: '95vw',
      autoFocus: false,
      data: user,
    });

    dialogRef
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result: PermisoConfig[] | undefined) => {
        if (result) {
          this.permisosService
            .saveUserPermisos(user.id, result)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
              next: (response) => {
                if (response.user) {
                  this.users.update((users) =>
                    users.map((item) => (item.id === response.user!.id ? response.user! : item))
                  );
                } else {
                  this.users.set([...this.users()]);
                }
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
    // Eliminar solo permisos de atlas/reportes (frontend), mantener observatorios
    const current = this.permisosService.getUserPermisos(user.id);
    const observatorioPermisos = current.filter((p) => p.modulo === 'observatorios');
    const emptyFrontend: PermisoConfig[] = [
      { modulo: 'atlas', nivel: 'ninguno' },
      { modulo: 'reportes', nivel: 'ninguno' },
    ];

    this.permisosService
      .saveUserPermisos(user.id, [...observatorioPermisos, ...emptyFrontend])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.users.set([...this.users()]);
          this.snackBar.open(
            `Permisos de ${user.name} restablecidos.`,
            'Cerrar',
            { duration: 3000 },
          );
        },
        error: () => {
          this.snackBar.open(
            'No se pudieron restablecer los permisos.',
            'Cerrar',
            { duration: 4000 },
          );
        },
      });
  }
}
