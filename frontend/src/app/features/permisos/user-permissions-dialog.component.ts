import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
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
    MatInputModule,
    MatProgressSpinnerModule,
    MatDividerModule,
    TranslateModule,
  ],
  templateUrl: './user-permissions-dialog.component.html',
  styleUrl: './user-permissions-dialog.component.scss',
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
  observatorioSearch = '';
  selectedDepartamentoIds: string[] = [];

  ngOnInit(): void {
    this.permisosService.syncFromBackend(this.user.id).subscribe({
      next: () => this.loadCurrentConfig(),
      error: () => this.loadCurrentConfig(),
    });
    this.loadDepartamentos();
  }

  private loadCurrentConfig(): void {
    const currentPermisos = this.permisosService.getUserPermisos(this.user.id);
    const observatorioPermisos = currentPermisos.filter(
      (p) => p.modulo === 'observatorios' && p.nivel !== 'ninguno',
    );
    const allObservatorios = observatorioPermisos.some((p) => p.departamento_id === null);
    this.selectedDepartamentoIds = allObservatorios
      ? this.departamentos.map((dep) => dep.id)
      : observatorioPermisos
          .map((p) => p.departamento_id)
          .filter((id): id is string => !!id);

    this.modules = MODULOS_PERMISO.map((modulo) => {
      const configs = currentPermisos.filter((p) => p.modulo === modulo);
      const config = configs.find((p) => p.nivel !== 'ninguno') ?? configs[0];
      const habilitado = modulo === 'observatorios'
        ? this.selectedDepartamentoIds.length > 0
        : config ? config.nivel !== 'ninguno' : false;

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
        this.loadCurrentConfig();
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
      if (mod.modulo === 'observatorios') {
        this.selectedDepartamentoIds = [];
      }
    } else {
      mod.nivel = 'lectura';
    }
  }

  filteredDepartamentos(): Departamento[] {
    const term = this.observatorioSearch.trim().toLowerCase();
    if (!term) return this.departamentos;

    return this.departamentos.filter((dep) =>
      [dep.nombre, dep.codigo_interno, dep.descripcion]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(term)),
    );
  }

  isDepartamentoSelected(departamentoId: string): boolean {
    return this.selectedDepartamentoIds.includes(departamentoId);
  }

  toggleDepartamento(departamentoId: string, checked: boolean): void {
    this.selectedDepartamentoIds = checked
      ? Array.from(new Set([...this.selectedDepartamentoIds, departamentoId]))
      : this.selectedDepartamentoIds.filter((id) => id !== departamentoId);

    const observatorios = this.modules.find((mod) => mod.modulo === 'observatorios');
    if (observatorios) {
      observatorios.habilitado = this.selectedDepartamentoIds.length > 0;
      if (observatorios.habilitado && observatorios.nivel === 'ninguno') {
        observatorios.nivel = 'escritura';
      }
    }
  }

  selectAllDepartamentos(): void {
    this.selectedDepartamentoIds = this.departamentos.map((dep) => dep.id);
    const observatorios = this.modules.find((mod) => mod.modulo === 'observatorios');
    if (observatorios) {
      observatorios.habilitado = this.selectedDepartamentoIds.length > 0;
      observatorios.nivel = observatorios.nivel === 'ninguno' ? 'escritura' : observatorios.nivel;
    }
  }

  clearDepartamentos(): void {
    this.selectedDepartamentoIds = [];
    const observatorios = this.modules.find((mod) => mod.modulo === 'observatorios');
    if (observatorios) {
      observatorios.habilitado = false;
      observatorios.nivel = 'ninguno';
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
          if (this.selectedDepartamentoIds.length === 0) {
            result.push({
              modulo: mod.modulo,
              nivel: 'ninguno',
              departamento_id: null,
            });
            continue;
          }

          for (const departamentoId of this.selectedDepartamentoIds) {
            result.push({
              modulo: mod.modulo,
              nivel: mod.nivel,
              departamento_id: departamentoId,
            });
          }
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
