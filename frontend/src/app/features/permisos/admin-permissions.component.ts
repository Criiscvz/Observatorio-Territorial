import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { PermisosService, SystemPermissions } from '@core/services/permisos.service';

@Component({
  selector: 'app-admin-permissions',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatCardModule,
    MatCheckboxModule,
    MatDividerModule,
    MatIconModule,
    MatSelectModule,
    MatSnackBarModule,
    TranslateModule,
  ],
  templateUrl: './admin-permissions.component.html',
  styleUrl: './admin-permissions.component.scss',
})
export class AdminPermissionsComponent implements OnInit {
  private readonly permisosService = inject(PermisosService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly translate = inject(TranslateService);

  permissions!: SystemPermissions;
  rolesList = ['EDITOR', 'SUBSCRIBER', 'USER'];

  ngOnInit(): void {
    this.loadPermissions();
  }

  loadPermissions(): void {
    // Deep clone the object so modifications don't apply immediately until saved
    this.permissions = JSON.parse(JSON.stringify(this.permisosService.getRolePermissions()));
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
}
