import { ChangeDetectorRef, Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ObservatoryAccessService } from '@core/services/observatory-access.service';
import { User, Departamento } from '@core/models';
import { PermisoConfig } from '@core/models/permisos';
import { AuthService } from '@core/services/auth.service';

@Component({
  selector: 'app-user-permissions-dialog',
  standalone: true,
  imports: [
    FormsModule,
    MatDialogModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './user-permissions-dialog.component.html',
  styleUrl: './user-permissions-dialog.component.scss',
})
export class UserPermissionsDialogComponent implements OnInit {
  readonly auth = inject(AuthService);

  private readonly accessService = inject(ObservatoryAccessService);
  private readonly dialogRef = inject(MatDialogRef<UserPermissionsDialogComponent>);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);
  readonly user = inject<User>(MAT_DIALOG_DATA);
  readonly isObservatoryAdmin = this.user.rol === 'ADMIN_OBSERVATORIO';
  readonly promotingEditor = this.user.rol === 'USER' && this.auth.user()?.rol === 'ADMIN_OBSERVATORIO';
  readonly delegated = this.auth.user()?.rol === 'ADMIN_OBSERVATORIO';
  readOnly = true;
  permissionsReady = false;
  capabilities: Record<string, { puede_revisar: boolean; puede_agregar_editores: boolean }> = {};

  flags(id: string) {
    return this.capabilities[id] ??= { puede_revisar: this.isObservatoryAdmin, puede_agregar_editores: false };
  }

  departamentos: Departamento[] = [];
  filteredDepartamentosList: Departamento[] = [];
  loadingDepartamentos = false;
  loadDepartamentosError = '';
  observatorioSearch = '';
  selectedDepartamentoIds: string[] = [];
  private originalDepartamentoIds = new Set<string>();

  isNewAssignment(id: string): boolean {
    return !this.originalDepartamentoIds.has(id);
  }

  private currentPermissions: PermisoConfig[] = [];
  ngOnInit(): void {
    this.loadingDepartamentos = true;
    this.accessService.context(this.user.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: context => {
        this.readOnly = context.capabilities?.can_manage_access !== true;
        this.departamentos = context.observatorios;
        this.currentPermissions = context.permisos;
        this.permissionsReady = context.capabilities?.can_view_access === true;
        this.loadingDepartamentos = false;
        this.updateFilteredDepartamentos(); this.applyCurrentSelection();
      },
      error: () => {
        this.readOnly = true; this.permissionsReady = false; this.loadingDepartamentos = false;
        this.departamentos = []; this.filteredDepartamentosList = [];
        this.loadDepartamentosError = 'No se pudieron cargar los accesos actuales. Cierra y vuelve a abrir para reintentar.';
        this.cdr.detectChanges();
      },
    });
  }

  private applyCurrentSelection(): void {
    const observatorioPermisos = this.currentPermissions
      .filter((permiso) => permiso.modulo === 'observatorios' && permiso.nivel !== 'ninguno');

    const allObservatorios = observatorioPermisos.some((permiso) => permiso.departamento_id === null);
    this.capabilities = {};
    observatorioPermisos.forEach(permission => {
      if (permission.departamento_id) this.capabilities[permission.departamento_id] = {
        puede_revisar: !!permission.puede_revisar, puede_agregar_editores: !!permission.puede_agregar_editores,
      };
    });
    this.selectedDepartamentoIds = allObservatorios
      ? this.departamentos.map((departamento) => departamento.id)
      : observatorioPermisos
          .map((permiso) => permiso.departamento_id)
          .filter((id): id is string => !!id && this.departamentos.some(dep => dep.id === id));
    this.originalDepartamentoIds = new Set(this.selectedDepartamentoIds);

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
    if (this.readOnly || !this.permissionsReady || !this.departamentos.some(dep => dep.id === departamentoId)) return;
    this.selectedDepartamentoIds = checked
      ? Array.from(new Set([...this.selectedDepartamentoIds, departamentoId]))
      : this.selectedDepartamentoIds.filter((id) => id !== departamentoId);
  }

  selectAllDepartamentos(): void {
    if (this.readOnly || !this.permissionsReady) return;
    this.selectedDepartamentoIds = this.departamentos.map((dep) => dep.id);
  }

  clearDepartamentos(): void {
    if (this.readOnly || !this.permissionsReady) return;
    this.selectedDepartamentoIds = [];
  }

  save(): void {
    if (this.readOnly || !this.permissionsReady || this.loadingDepartamentos || this.loadDepartamentosError
      || (this.promotingEditor && (!this.selectedDepartamentoIds.length || this.user.is_active === false))) return;
    const result: PermisoConfig[] = this.selectedDepartamentoIds.length
      ? this.selectedDepartamentoIds.map((departamentoId) => ({
          modulo: 'observatorios',
          nivel: 'escritura',
          departamento_id: departamentoId,
          ...(this.isObservatoryAdmin ? this.flags(departamentoId) : {}),
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
