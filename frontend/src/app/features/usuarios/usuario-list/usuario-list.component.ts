import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, signal, DestroyRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatDivider } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import { User, UserRole } from '@core/models';
import { UserService } from '@core/services/user.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ConfirmDialogComponent } from '@shared/components/confirm-dialog/confirm-dialog.component';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { UserPermissionsDialogComponent } from '../../permisos/user-permissions-dialog.component';
import { PermisosService } from '@core/services/permisos.service';

@Component({
  selector: 'app-usuario-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    MatButtonModule,
    MatCardModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatMenuModule,
    MatPaginatorModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatSnackBarModule,
    MatTableModule,
    MatTooltipModule,
    MatDivider,
    TranslateModule,
  ],
  templateUrl: './usuario-list.component.html',
  styleUrl: './usuario-list.component.scss',
})
export class UsuarioListComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly userService = inject(UserService);
  private readonly permisosService = inject(PermisosService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);
  private readonly translate = inject(TranslateService);

  displayedColumns = ['name', 'email', 'rol', 'is_active', 'created_at', 'actions'];
  
  users = signal<User[]>([]);
  loading = signal(true);
  
  // Pagination
  currentPage = signal(1);
  totalItems = signal(0);
  pageSize = signal(15);
  lastPage = signal(1);

  searchQuery = signal('');
  private searchTimeout: any;

  ngOnInit(): void {
    this.loadUsers();
  }

  loadUsers(page = 1): void {
    this.loading.set(true);
    const search = this.searchQuery().trim();
    this.userService.getUsers(this.pageSize(), page, search || undefined)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.users.set(response.data);
          this.currentPage.set(response.meta.current_page);
          this.totalItems.set(response.meta.total);
          this.lastPage.set(response.meta.last_page);
          this.loading.set(false);
        },
        error: () => {
          this.snackBar.open(
            this.translate.instant('users.messages.loadError'),
            this.translate.instant('common.buttons.close'),
            { duration: 3000 }
          );
          this.loading.set(false);
        },
      });
  }

  onPageChange(event: PageEvent): void {
    this.pageSize.set(event.pageSize);
    this.loadUsers(event.pageIndex + 1);
  }

  onSearchChange(term: string): void {
    this.searchQuery.set(term);
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }
    this.searchTimeout = setTimeout(() => {
      this.loadUsers(1);
    }, 400);
  }

  clearSearch(): void {
    this.searchQuery.set('');
    this.loadUsers(1);
  }

  toggleStatus(user: User): void {
    const newStatus = !user.is_active;
    const action = newStatus ? 'activar' : 'desactivar';
    
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: this.translate.instant('users.confirmToggle.title'),
        message: this.translate.instant('users.confirmToggle.message', { name: user.name, action }),
        confirmText: this.translate.instant('common.buttons.confirm'),
        cancelText: this.translate.instant('common.buttons.cancel'),
      },
    });

    dialogRef.afterClosed().pipe(takeUntilDestroyed(this.destroyRef)).subscribe((confirmed) => {
      if (confirmed) {
        this.userService.toggleUserStatus(user.id, newStatus).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
          next: () => {
            this.snackBar.open(
              this.translate.instant('users.messages.statusUpdated'),
              this.translate.instant('common.buttons.close'),
              { duration: 3000 }
            );
            this.loadUsers(this.currentPage());
          },
          error: () => {
            this.snackBar.open(
              this.translate.instant('users.messages.statusError'),
              this.translate.instant('common.buttons.close'),
              { duration: 3000 }
            );
          },
        });
      }
    });
  }

  changeRole(user: User, newRole: UserRole): void {
    if (user.rol === newRole) return;

    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: this.translate.instant('users.confirmRole.title'),
        message: this.translate.instant('users.confirmRole.message', { name: user.name, role: newRole }),
        confirmText: this.translate.instant('common.buttons.confirm'),
        cancelText: this.translate.instant('common.buttons.cancel'),
      },
    });

    dialogRef.afterClosed().pipe(takeUntilDestroyed(this.destroyRef)).subscribe((confirmed) => {
      if (confirmed) {
        this.userService.updateUserRole(user.id, { rol: newRole }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
          next: () => {
            this.snackBar.open(
              this.translate.instant('users.messages.roleUpdated'),
              this.translate.instant('common.buttons.close'),
              { duration: 3000 }
            );
            this.loadUsers(this.currentPage());
          },
          error: () => {
            this.snackBar.open(
              this.translate.instant('users.messages.roleError'),
              this.translate.instant('common.buttons.close'),
              { duration: 3000 }
            );
          },
        });
      }
    });
  }

  deleteUser(user: User): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: this.translate.instant('users.confirmDelete.title'),
        message: this.translate.instant('users.confirmDelete.message', { name: user.name }),
        confirmText: this.translate.instant('common.buttons.delete'),
        cancelText: this.translate.instant('common.buttons.cancel'),
        confirmColor: 'warn',
      },
    });

    dialogRef.afterClosed().pipe(takeUntilDestroyed(this.destroyRef)).subscribe((confirmed) => {
      if (confirmed) {
        this.userService.deleteUser(user.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
          next: () => {
            this.snackBar.open(
              this.translate.instant('users.messages.deleted'),
              this.translate.instant('common.buttons.close'),
              { duration: 3000 }
            );
            this.loadUsers(this.currentPage());
          },
          error: () => {
            this.snackBar.open(
              this.translate.instant('users.messages.deleteError'),
              this.translate.instant('common.buttons.close'),
              { duration: 3000 }
            );
          },
        });
      }
    });
  }

  getRoleBadgeClass(rol: string): string {
    switch (rol) {
      case 'ADMIN': return 'badge-admin';
      case 'EDITOR': return 'badge-editor';
      case 'SUBSCRIBER': return 'badge-subscriber';
      default: return 'badge-user';
    }
  }

  getStatusBadgeClass(isActive: boolean): string {
    return isActive ? 'badge-active' : 'badge-inactive';
  }

  formatDate(date: string | undefined): string {
    if (!date) return '-';
    return new Date(date).toLocaleDateString();
  }

  openPermissionsDialog(user: User): void {
    const dialogRef = this.dialog.open(UserPermissionsDialogComponent, {
      width: '450px',
      data: user,
    });

    dialogRef.afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => {
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
                }
                this.snackBar.open(
                  response.message || 'Permisos guardados correctamente para el usuario.',
                  'Cerrar',
                  { duration: 3000 }
                );
              },
              error: () => {
                this.snackBar.open(
                  'No se pudieron guardar los permisos del usuario.',
                  'Cerrar',
                  { duration: 4000 }
                );
              },
            });
        }
      });
  }
}
