import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { TranslateModule } from '@ngx-translate/core';
import { PermisosService, RolePermissionConfig } from '@core/services/permisos.service';
import { User } from '@core/models';

@Component({
  selector: 'app-user-permissions-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatCheckboxModule,
    MatSelectModule,
    MatFormFieldModule,
    MatButtonModule,
    MatIconModule,
    TranslateModule,
  ],
  template: `
    <div class="dialog-container">
      <h2 mat-dialog-title class="dialog-title">
        <mat-icon>security</mat-icon>
        <span>Permisos Personalizados</span>
      </h2>
      
      <mat-dialog-content class="dialog-content">
        <div class="user-info">
          <div class="avatar-replacement">
            <mat-icon>person</mat-icon>
          </div>
          <div class="user-details">
            <h3>{{ user.name }}</h3>
            <p class="email">{{ user.email }}</p>
            <span class="role-badge" [ngClass]="'badge-' + user.rol.toLowerCase()">{{ user.rol }}</span>
          </div>
        </div>

        <p class="explanation">
          Configura los permisos específicos de este usuario. Por defecto, se heredan los accesos base de su rol de sistema.
        </p>

        <!-- Formulario de Permisos -->
        <div class="permissions-form" *ngIf="config">
          <!-- Crear -->
          <div class="permission-item">
            <div class="permission-check">
              <mat-checkbox [(ngModel)]="config.create">Crear Publicaciones</mat-checkbox>
            </div>
            <p class="help-text">Permite subir nuevos informes y documentos de investigación al Atlas.</p>
          </div>

          <!-- Editar -->
          <div class="permission-item">
            <div class="permission-check">
              <mat-checkbox [(ngModel)]="config.edit">Editar Publicaciones</mat-checkbox>
              
              <mat-form-field *ngIf="config.edit" appearance="outline" class="scope-select">
                <mat-select [(value)]="config.editScope">
                  <mat-option value="own">Solo propio</mat-option>
                  <mat-option value="all">Todos</mat-option>
                </mat-select>
              </mat-form-field>
            </div>
            <p class="help-text">Permite modificar metadatos de las publicaciones.</p>
          </div>

          <!-- Eliminar -->
          <div class="permission-item">
            <div class="permission-check">
              <mat-checkbox [(ngModel)]="config.delete">Eliminar Publicaciones</mat-checkbox>
              
              <mat-form-field *ngIf="config.delete" appearance="outline" class="scope-select">
                <mat-select [(value)]="config.deleteScope">
                  <mat-option value="own">Solo propio</mat-option>
                  <mat-option value="all">Todos</mat-option>
                </mat-select>
              </mat-form-field>
            </div>
            <p class="help-text">Permite dar de baja o purgar publicaciones del catálogo.</p>
          </div>
        </div>
      </mat-dialog-content>

      <mat-dialog-actions align="end" class="dialog-actions">
        <button mat-button mat-dialog-close>Cancelar</button>
        <button mat-flat-button color="primary" (click)="save()">
          <mat-icon>save</mat-icon>
          Guardar Permisos
        </button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [`
    .dialog-container {
      padding: 4px;
    }
    .dialog-title {
      display: flex;
      align-items: center;
      gap: 10px;
      color: #1e1b4b;
      margin: 0;
      font-weight: 700;

      mat-icon {
        color: #6366f1;
      }
    }
    .dialog-content {
      padding-top: 16px !important;
    }
    .user-info {
      display: flex;
      align-items: center;
      gap: 16px;
      background: #f8fafc;
      padding: 16px;
      border-radius: 12px;
      border: 1px solid rgba(0, 0, 0, 0.05);
      margin-bottom: 16px;
    }
    .avatar-replacement {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: #e2e8f0;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #64748b;
    }
    .user-details {
      display: flex;
      flex-direction: column;
      gap: 2px;
      h3 {
        margin: 0;
        font-size: 15px;
        font-weight: 600;
        color: #1e1b4b;
      }
      .email {
        margin: 0;
        font-size: 13px;
        color: #64748b;
      }
    }
    .role-badge {
      display: inline-block;
      width: max-content;
      margin-top: 4px;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.05em;

      &.badge-admin { background: rgba(239, 68, 68, 0.1); color: #ef4444; }
      &.badge-editor { background: rgba(245, 158, 11, 0.1); color: #f59e0b; }
      &.badge-subscriber { background: rgba(99, 102, 241, 0.1); color: #6366f1; }
      &.badge-user { background: rgba(16, 185, 129, 0.1); color: #10b981; }
    }
    .explanation {
      font-size: 13px;
      color: #64748b;
      line-height: 1.5;
      margin-bottom: 20px;
    }
    .permissions-form {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .permission-item {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding-bottom: 12px;
      border-bottom: 1px solid #f1f5f9;

      &:last-child {
        border-bottom: none;
      }
    }
    .permission-check {
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;
    }
    .help-text {
      margin: 0;
      font-size: 12px;
      color: #94a3b8;
      padding-left: 28px;
    }
    .scope-select {
      width: 140px;
      font-size: 12px;
      margin-bottom: -1.25em; /* Offset Angular Material outline container padding */

      ::ng-deep {
        .mat-mdc-form-field-infix {
          padding-top: 6px !important;
          padding-bottom: 6px !important;
          min-height: 36px !important;
        }
        .mat-mdc-text-field-wrapper {
          height: 36px !important;
        }
      }
    }
    .dialog-actions {
      padding: 12px 24px;
      border-top: 1px solid #f1f5f9;
      margin: 0 -24px -24px -24px;

      button {
        display: flex;
        align-items: center;
        gap: 6px;
        font-weight: 500;
      }
    }
    @media (max-width: 480px) {
      .permission-check {
        flex-direction: column;
        align-items: flex-start;
        gap: 8px;
      }
      .scope-select {
        width: 100%;
      }
      .help-text {
        padding-left: 0;
      }
      .dialog-actions {
        flex-direction: column-reverse;
        align-items: stretch;

        button {
          justify-content: center;
          width: 100%;
        }
      }
    }
  `],
})
export class UserPermissionsDialogComponent implements OnInit {
  private readonly permisosService = inject(PermisosService);
  private readonly dialogRef = inject(MatDialogRef<UserPermissionsDialogComponent>);
  readonly user = inject<User>(MAT_DIALOG_DATA);

  config!: RolePermissionConfig;

  ngOnInit(): void {
    const rawConfig = this.permisosService.getUserPermissions(this.user.id, this.user.rol);
    // Clone to prevent direct modification until click save
    this.config = JSON.parse(JSON.stringify(rawConfig));
  }

  save(): void {
    this.dialogRef.close(this.config);
  }
}
