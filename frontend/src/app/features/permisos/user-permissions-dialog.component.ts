import { ChangeDetectorRef, Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDividerModule } from '@angular/material/divider';
import { TranslateModule } from '@ngx-translate/core';
import { PermisosService } from '@core/services/permisos.service';
import { DepartamentoService } from '@core/services/departamento.service';
import { User, Departamento } from '@core/models';
import { PermisoConfig } from '@core/models/permisos';

@Component({
  selector: 'app-user-permissions-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatCheckboxModule,
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
  private readonly cdr = inject(ChangeDetectorRef);
  readonly user = inject<User>(MAT_DIALOG_DATA);

  readonly editorPermissions = [
    'Crear Artículos',
    'Crear Reportes',
    'Crear Atlas',
    'Enviar contenido a revisión',
    'Ver sus envíos',
    'Entrar al panel del editor',
  ];

  departamentos: Departamento[] = [];
  filteredDepartamentosList: Departamento[] = [];
  loadingDepartamentos = false;
  loadDepartamentosError = '';
  observatorioSearch = '';
  selectedDepartamentoIds: string[] = [];

  ngOnInit(): void {
    this.loadingDepartamentos = true;
    this.loadDepartamentosError = '';
    this.departamentoService.getAll().subscribe({
      next: (deps) => {
        this.departamentos = deps;
        this.updateFilteredDepartamentos();
        this.loadingDepartamentos = false;
        this.loadAssignedObservatorios();
        this.cdr.detectChanges();
      },
      error: () => {
        this.departamentos = [];
        this.filteredDepartamentosList = [];
        this.loadDepartamentosError = 'No se pudieron cargar los Observatorios.';
        this.loadingDepartamentos = false;
        this.loadAssignedObservatorios();
        this.cdr.detectChanges();
      },
    });
  }

  private loadAssignedObservatorios(): void {
    this.permisosService.syncFromBackend(this.user.id).subscribe({
      next: () => this.applyCurrentSelection(),
      error: () => this.applyCurrentSelection(),
    });
  }

  private applyCurrentSelection(): void {
    const observatorioPermisos = this.permisosService
      .getUserPermisos(this.user.id)
      .filter((permiso) => permiso.modulo === 'observatorios' && permiso.nivel !== 'ninguno');

    const allObservatorios = observatorioPermisos.some((permiso) => permiso.departamento_id === null);
    this.selectedDepartamentoIds = allObservatorios
      ? this.departamentos.map((departamento) => departamento.id)
      : observatorioPermisos
          .map((permiso) => permiso.departamento_id)
          .filter((id): id is string => !!id);

    this.cdr.detectChanges();
  }

  updateFilteredDepartamentos(): void {
    const term = this.observatorioSearch.trim().toLowerCase();
    if (!term) {
      this.filteredDepartamentosList = [...this.departamentos];
      return;
    }

    this.filteredDepartamentosList = this.departamentos.filter((dep) =>
      [dep.nombre, dep.codigo_interno, dep.descripcion]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(term)),
    );
  }

  onSearchChange(value: string): void {
    this.observatorioSearch = value;
    this.updateFilteredDepartamentos();
  }

  isDepartamentoSelected(departamentoId: string): boolean {
    return this.selectedDepartamentoIds.includes(departamentoId);
  }

  toggleDepartamento(departamentoId: string, checked: boolean): void {
    this.selectedDepartamentoIds = checked
      ? Array.from(new Set([...this.selectedDepartamentoIds, departamentoId]))
      : this.selectedDepartamentoIds.filter((id) => id !== departamentoId);
  }

  selectAllDepartamentos(): void {
    this.selectedDepartamentoIds = this.departamentos.map((dep) => dep.id);
  }

  clearDepartamentos(): void {
    this.selectedDepartamentoIds = [];
  }

  save(): void {
    const result: PermisoConfig[] = this.selectedDepartamentoIds.length
      ? this.selectedDepartamentoIds.map((departamentoId) => ({
          modulo: 'observatorios',
          nivel: 'escritura',
          departamento_id: departamentoId,
        }))
      : [
          {
            modulo: 'observatorios',
            nivel: 'ninguno',
            departamento_id: null,
          },
        ];

    this.dialogRef.close(result);
  }

  cancel(): void {
    this.dialogRef.close();
  }
}
