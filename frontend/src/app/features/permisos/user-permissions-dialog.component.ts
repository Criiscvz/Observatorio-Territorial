import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatDividerModule } from '@angular/material/divider';
import { TranslateModule } from '@ngx-translate/core';
import { PermisosService } from '@core/services/permisos.service';
import { DepartamentoService } from '@core/services/departamento.service';
import { User, Departamento } from '@core/models';
import {
  ModuloPermiso,
  NivelPermiso,
  PermisoConfig,
  MODULOS_PERMISO,
  MODULO_LABELS,
  MODULO_ICONS,
  NIVEL_LABELS,
} from '@core/models/permisos';

interface ModuloEditState {
  modulo: ModuloPermiso;
  label: string;
  icon: string;
  habilitado: boolean;
  nivel: NivelPermiso;
  departamentoId: string | null; // null = "todos", string = específico
  nivelesDisponibles: NivelPermiso[];
}

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
    MatProgressSpinnerModule,
    MatDividerModule,
    TranslateModule,
  ],
  templateUrl: './user-permissions-dialog.component.html',
  styles: [`
    .dialog-container { padding: 4px; }
    .dialog-title {
      display: flex;
      align-items: center;
      gap: 10px;
      color: #1e1b4b;
      margin: 0;
      font-weight: 700;
      mat-icon { color: #6366f1; }
    }
    .dialog-content { padding-top: 16px !important; }
    .user-info {
      display: flex;
      align-items: center;
      gap: 16px;
      background: #f8fafc;
      padding: 16px;
      border-radius: 12px;
      border: 1px solid rgba(0,0,0,0.05);
      margin-bottom: 20px;
    }
    .user-avatar {
      width: 48px; height: 48px;
      border-radius: 50%;
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      color: #fff;
      font-weight: 700;
      font-size: 18px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .user-details {
      display: flex;
      flex-direction: column;
      gap: 2px;
      h3 { margin: 0; font-size: 15px; font-weight: 600; color: #1e1b4b; }
      .email { margin: 0; font-size: 13px; color: #64748b; }
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
      &.badge-admin { background: rgba(239,68,68,0.1); color: #ef4444; }
      &.badge-editor { background: rgba(245,158,11,0.1); color: #f59e0b; }
      &.badge-subscriber { background: rgba(99,102,241,0.1); color: #6366f1; }
      &.badge-user { background: rgba(16,185,129,0.1); color: #10b981; }
    }
    .modulos-list {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .modulo-card {
      border: 1px solid rgba(0,0,0,0.06);
      border-radius: 12px;
      padding: 16px;
      background: rgba(255,255,255,0.5);
      transition: border-color 0.2s, box-shadow 0.2s;
      &.habilitado {
        border-color: rgba(99,102,241,0.2);
        box-shadow: 0 2px 8px rgba(99,102,241,0.06);
      }
    }
    .modulo-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 12px;
    }
    .modulo-icon-box {
      width: 36px; height: 36px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(99,102,241,0.08);
      mat-icon { font-size: 20px; width: 20px; height: 20px; color: #6366f1; }
    }
    .modulo-title {
      font-size: 15px;
      font-weight: 600;
      color: #1e1b4b;
      flex: 1;
    }
    .modulo-config {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding-left: 48px;
    }
    .config-row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 12px;
    }
    .nivel-select {
      width: 200px;
      font-size: 13px;
      ::ng-deep {
        .mat-mdc-form-field-infix {
          padding-top: 6px !important;
          padding-bottom: 6px !important;
          min-height: 36px !important;
        }
        .mat-mdc-text-field-wrapper { height: 36px !important; }
        .mat-mdc-form-field-subscript-wrapper { display: none; }
      }
    }
    .obs-select {
      width: 100%;
    }
    .obs-hint {
      font-size: 12px;
      color: #94a3b8;
      margin: 2px 0 0 0;
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
      .modulo-config { padding-left: 0; }
      .config-row { flex-direction: column; align-items: stretch; }
      .nivel-select { width: 100%; }
      .dialog-actions {
        flex-direction: column-reverse;
        align-items: stretch;
        button { justify-content: center; width: 100%; }
      }
    }
  `],
})
export class UserPermissionsDialogComponent implements OnInit {
  private readonly permisosService = inject(PermisosService);
  private readonly departamentoService = inject(DepartamentoService);
  private readonly dialogRef = inject(MatDialogRef<UserPermissionsDialogComponent>);
  readonly user = inject<User>(MAT_DIALOG_DATA);

  readonly nivelLabels = NIVEL_LABELS;

  modules: ModuloEditState[] = [];
  departamentos: Departamento[] = [];
  loadingDepartamentos = false;

  ngOnInit(): void {
    this.loadCurrentConfig();
    this.loadDepartamentos();
  }

  private loadCurrentConfig(): void {
    const currentPermisos = this.permisosService.getUserPermisos(this.user.id);

    this.modules = MODULOS_PERMISO.map((modulo) => {
      const config = currentPermisos.find((p) => p.modulo === modulo);
      const habilitado = config ? config.nivel !== 'ninguno' : false;

      return {
        modulo,
        label: MODULO_LABELS[modulo],
        icon: MODULO_ICONS[modulo],
        habilitado,
        nivel: config?.nivel ?? 'ninguno',
        departamentoId: config?.departamento_id ?? null,
        nivelesDisponibles: this.getNivelesDisponibles(modulo),
      };
    });
  }

  private getNivelesDisponibles(modulo: ModuloPermiso): NivelPermiso[] {
    // Todos los módulos tienen los mismos niveles
    return ['lectura', 'escritura', 'admin'];
  }

  private loadDepartamentos(): void {
    this.loadingDepartamentos = true;
    this.departamentoService.getAll().subscribe({
      next: (deps) => {
        this.departamentos = deps;
        this.loadingDepartamentos = false;
      },
      error: () => {
        this.loadingDepartamentos = false;
      },
    });
  }

  onToggleModulo(mod: ModuloEditState, checked: boolean): void {
    mod.habilitado = checked;
    if (!checked) {
      mod.nivel = 'ninguno';
      mod.departamentoId = null;
    } else {
      mod.nivel = 'lectura';
    }
  }

  getDepartamentoLabel(depId: string | null): string {
    if (depId === null) return 'Todos los departamentos';
    const dep = this.departamentos.find((d) => d.id === depId);
    return dep ? dep.nombre : 'Departamento desconocido';
  }

  save(): void {
    const result: PermisoConfig[] = [];

    for (const mod of this.modules) {
      if (mod.habilitado) {
        if (mod.modulo === 'observatorios') {
          // Guardar "todos" como null en departamento_id
          result.push({
            modulo: mod.modulo,
            nivel: mod.nivel,
            departamento_id: mod.departamentoId, // null = todos
          });
        } else {
          result.push({
            modulo: mod.modulo,
            nivel: mod.nivel,
          });
        }
      } else {
        // Guardar como "ninguno" para que el backend lo registre
        result.push({
          modulo: mod.modulo,
          nivel: 'ninguno',
          ...(mod.modulo === 'observatorios' ? { departamento_id: null } : {}),
        });
      }
    }

    this.dialogRef.close(result);
  }

  cancel(): void {
    this.dialogRef.close();
  }
}
