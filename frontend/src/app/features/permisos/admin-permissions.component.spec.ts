import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { provideTranslateService } from '@ngx-translate/core';
import { of, Subject } from 'rxjs';
import { User } from '@core/models';
import { PermisoConfig } from '@core/models/permisos';
import { PermisosService } from '@core/services/permisos.service';
import { UserService } from '@core/services/user.service';
import { AdminPermissionsComponent } from './admin-permissions.component';
import { UserPermissionsDialogComponent } from './user-permissions-dialog.component';

describe('Lista compacta de editores', () => {
  const editor: User = { id: 1, name: 'Carlos Mendoza Reyes', email: 'carlos@uleam.edu.ec', rol: 'EDITOR',
    departamentos: [{id: 'salud', nombre: 'Observatorio de la Salud', codigo_interno: 'SAL', rol: 'EDITOR'}] };
  const initial: PermisoConfig[] = [{modulo: 'observatorios', nivel: 'escritura', departamento_id: 'salud'}];
  function setup() {
    let permissions = [...initial];
    const service = {
      getUserPermisos: vi.fn(() => permissions),
      syncFromBackend: vi.fn(() => of(permissions)),
      saveUserPermisos: vi.fn((_id: number, next: PermisoConfig[]) => {
        permissions = next;
        return of({permisos: next, message: 'Guardado', user: {...editor, departamentos: []}});
      }),
    };
    const dialog = {open: vi.fn(() => ({afterClosed: () => of(undefined as PermisoConfig[] | undefined)}))};
    TestBed.configureTestingModule({providers: [provideTranslateService(),
      {provide: PermisosService, useValue: service},
      {provide: UserService, useValue: {getUsers: () => of({data: [editor, {...editor, id: 2, rol: 'ADMIN'}], meta: {last_page: 1}})}},
      {provide: MatDialog, useValue: dialog}, {provide: MatSnackBar, useValue: {open: vi.fn()}},
    ]});
    TestBed.overrideProvider(MatDialog, {useValue: dialog});
    TestBed.overrideProvider(MatSnackBar, {useValue: {open: vi.fn()}});
    const fixture = TestBed.createComponent(AdminPermissionsComponent);
    vi.spyOn(fixture.debugElement.injector.get(MatDialog), 'open').mockImplementation(dialog.open as any);
    fixture.detectChanges();
    return {fixture, component: fixture.componentInstance, service, dialog};
  }
  it('muestra solo editores en filas, sus observatorios y una sola explicación de alcance', () => {
    const {fixture} = setup(); const el = fixture.nativeElement;
    expect(el.querySelectorAll('.editor-row')).toHaveLength(1);
    expect(el.querySelector('.observatorio-chip').textContent).toContain('Observatorio de la Salud');
    expect(el.querySelectorAll('.editor-scope-note')).toHaveLength(1);
    expect(el.querySelector('.editor-role-details').open).toBe(false);
    expect(el.querySelector('.manage-observatorios').textContent).toContain('Gestionar observatorios');
  });
  it('conserva la búsqueda y permite gestionar editores sin observatorios asignados', () => {
    const {component, fixture, service} = setup();
    component.searchTerm.set('sin coincidencia'); fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.editor-row')).toHaveLength(0);
    component.searchTerm.set('CARLOS'); service.getUserPermisos.mockReturnValue([]); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.manage-observatorios').disabled).toBe(false);
    expect(fixture.nativeElement.querySelector('.reset-access').disabled).toBe(true);
  });
  it('abre el formulario del usuario correcto y solo persiste al guardar', () => {
    const {fixture, component, dialog, service} = setup();
    fixture.nativeElement.querySelector('.manage-observatorios').click();
    expect(dialog.open).toHaveBeenCalledWith(UserPermissionsDialogComponent, expect.objectContaining({data: editor}));
    expect(service.saveUserPermisos).not.toHaveBeenCalled();
    dialog.open.mockReturnValue({afterClosed: () => of(initial)});
    component.openPermissionsDialog(editor);
    expect(service.saveUserPermisos).toHaveBeenCalledWith(editor.id, initial);
    expect(component.saveStatus()).toContain('actualizada');
  });
  it('requiere confirmación antes de quitar accesos y conserva al editor en la lista', () => {
    const {fixture, component, service} = setup();
    fixture.nativeElement.querySelector('.reset-access').click(); fixture.detectChanges();
    expect(service.saveUserPermisos).not.toHaveBeenCalled();
    fixture.nativeElement.querySelector('.confirmation-actions button').click(); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.reset-confirmation')).toBeNull();
    expect(service.saveUserPermisos).not.toHaveBeenCalled();
    fixture.nativeElement.querySelector('.reset-access').click(); fixture.detectChanges();
    fixture.nativeElement.querySelector('.confirm-reset').click(); fixture.detectChanges();
    expect(service.saveUserPermisos).toHaveBeenCalledWith(editor.id, [{modulo: 'observatorios', nivel: 'ninguno', departamento_id: null}]);
    expect(fixture.nativeElement.querySelectorAll('.editor-row')).toHaveLength(1);
    expect(component.getAssignedObservatoriosCount(component.users()[0])).toBe(0);
    expect(fixture.nativeElement.querySelector('.reset-confirmation')).toBeNull();
  });
  it('distingue acceso global de un único observatorio', () => {
    const {component, fixture, service} = setup();
    service.getUserPermisos.mockReturnValue([{modulo: 'observatorios', nivel: 'escritura', departamento_id: null}]);
    component.users.set([...component.users()]);
    fixture.detectChanges();
    expect(component.hasAllObservatorios(editor)).toBe(true);
    expect(fixture.nativeElement.querySelector('.assignment-count').textContent).toContain('Todos los observatorios');
    expect(fixture.nativeElement.querySelectorAll('.observatorio-chip')).toHaveLength(0);
  });
  it('evita envíos duplicados, comunica el error y permite volver a guardar', () => {
    const {component, fixture, dialog, service} = setup();
    const pending = new Subject<any>();
    service.saveUserPermisos.mockReturnValueOnce(pending as any);
    dialog.open.mockReturnValue({afterClosed: () => of(initial)});
    component.openPermissionsDialog(editor); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.manage-observatorios').disabled).toBe(true);
    component.openPermissionsDialog(editor); expect(dialog.open).toHaveBeenCalledTimes(1);
    pending.error(new Error('offline')); fixture.detectChanges();
    expect(component.savingUserId()).toBeNull();
    expect(component.saveStatus()).toContain('No se pudieron guardar');
    expect(fixture.nativeElement.querySelector('.manage-observatorios').disabled).toBe(false);
    component.openPermissionsDialog(editor); expect(component.saveStatus()).toContain('actualizada');
  });
});
