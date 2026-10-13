import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { provideRouter } from '@angular/router';
import { Departamento } from '@core/models';
import { DepartamentoService } from '@core/services/departamento.service';
import { adminGuard } from '@core/guards/role.guard';
import { provideTranslateService } from '@ngx-translate/core';
import {
  ConfirmDialogComponent,
  ConfirmDialogData,
} from '@shared/components/confirm-dialog/confirm-dialog.component';
import { of, Subject, throwError } from 'rxjs';
import { ADMIN_ROUTES } from '../../../routes/admin.routes';
import { DepartamentoListComponent } from './departamento-list.component';

describe('Observatory management directory', () => {
  const items: Departamento[] = [
    {
      id: 'eco',
      nombre: 'Vitalidad Ecológica',
      codigo_interno: 'ECO-01',
      descripcion: 'Ambiente y biodiversidad',
      publico: true,
      icono: 'eco',
      created_at: '',
      updated_at: '',
      datasets_count: 3,
    },
    {
      id: 'social',
      nombre: 'Economía del Cuidado',
      codigo_interno: 'SOC-02',
      publico: false,
      created_at: '',
      updated_at: '',
      datasets: [],
    },
  ];
  let service: any;
  let dialog: any;
  let closed: Subject<boolean>;
  let data: ConfirmDialogData;
  let component: DepartamentoListComponent;

  beforeEach(() => {
    closed = new Subject<boolean>();
    service = { getAll: vi.fn(() => of(items)), delete: vi.fn(() => of({ message: 'Eliminado' })) };
    dialog = {
      open: vi.fn((_component, options) => {
        data = options.data;
        return { afterClosed: () => closed };
      }),
    };
    TestBed.configureTestingModule({
      imports: [DepartamentoListComponent],
      providers: [
        provideRouter([]),
        provideTranslateService({ fallbackLang: 'es' }),
        { provide: DepartamentoService, useValue: service },
        { provide: MatDialog, useValue: dialog },
        { provide: MatSnackBar, useValue: { open: vi.fn() } },
      ],
    });
    component = TestBed.runInInjectionContext(() => new DepartamentoListComponent());
  });

  it('loads the existing observatories without creating or updating records', () => {
    component.ngOnInit();
    expect(component.departamentos()).toEqual(items);
    expect(service.getAll).toHaveBeenCalledTimes(1);
    expect(service.delete).not.toHaveBeenCalled();
    expect(component.loading()).toBe(false);
  });

  it('searches names without accents or case and also searches codes and descriptions', () => {
    component.ngOnInit();
    for (const search of ['  ECOLOGICA ', 'eco-01', 'biodiversidad']) {
      component.search.set(search);
      expect(component.filteredDepartamentos()).toEqual([items[0]]);
    }
    component.search.set('no existe');
    expect(component.filteredDepartamentos()).toEqual([]);
    component.search.set('');
    expect(component.filteredDepartamentos()).toEqual(items);
  });

  it('distinguishes known zero dataset counts from unavailable counts', () => {
    expect(component.datasetCount(items[0])).toBe(3);
    expect(component.datasetCount(items[1])).toBe(0);
    expect(component.datasetCount({ ...items[1], datasets: undefined })).toBeUndefined();
  });

  it('reports load errors and recovers on refresh', () => {
    service.getAll.mockReturnValueOnce(throwError(() => ({ status: 0 })));
    component.load();
    expect(component.error()).toBeTruthy();
    expect(component.loading()).toBe(false);
    component.load();
    expect(component.error()).toBe('');
    expect(component.departamentos()).toEqual(items);
  });

  it('prevents duplicate requests while the directory is loading', () => {
    service.getAll.mockReturnValue(new Subject());
    component.load();
    component.load();
    component.remove(items[0]);
    expect(service.getAll).toHaveBeenCalledTimes(1);
    expect(dialog.open).not.toHaveBeenCalled();
  });

  it('does not delete on cancel or when a confirmation is merely opened', () => {
    component.remove(items[0]);
    expect(dialog.open).toHaveBeenCalledWith(ConfirmDialogComponent, expect.anything());
    expect(service.delete).not.toHaveBeenCalled();
    closed.next(false);
    expect(service.delete).not.toHaveBeenCalled();
    expect(component.deleting()).toBe(false);
  });

  it('deletes only the confirmed observatory and refreshes the directory', () => {
    component.remove(items[0]);
    component.remove(items[1]);
    expect(dialog.open).toHaveBeenCalledTimes(1);
    expect(data.confirmColor).toBe('warn');
    data.confirmAction!().subscribe();
    expect(service.delete).toHaveBeenCalledExactlyOnceWith('eco');
    expect(service.getAll).toHaveBeenCalledTimes(1);
    closed.next(true);
    expect(component.deleting()).toBe(false);
  });

  it('preserves the directory and reports permissions or server deletion failures', () => {
    component.ngOnInit();
    component.remove(items[0]);
    data.onError!({ status: 403, error: { message: 'Internal detail' } });
    expect(component.error()).toBe('common.messages.permissionDenied');
    expect(component.departamentos()).toEqual(items);
    data.onError!({ status: 409, error: { message: 'Contenido asociado' } });
    expect(component.error()).toBe('Contenido asociado');
  });

  it('renders icons, visibility, search and links to the unchanged create, detail and edit routes', async () => {
    const fixture = TestBed.createComponent(DepartamentoListComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelectorAll('.observatorio-card')).toHaveLength(2);
    expect(element.querySelector('.observatorio-icon mat-icon')?.textContent).toBe('eco');
    expect(element.querySelectorAll('.visibility-badge.private')).toHaveLength(1);
    expect(element.querySelector('a[href="/admin/departamentos/nuevo"]')).not.toBeNull();
    expect(element.querySelector('a[href="/admin/departamentos/eco"]')).not.toBeNull();
    expect(element.querySelector('a[href="/admin/departamentos/eco/editar"]')).not.toBeNull();
    const search = element.querySelector('input[type="search"]') as HTMLInputElement;
    search.value = 'ecologica';
    search.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(element.querySelectorAll('.observatorio-card')).toHaveLength(1);
    fixture.destroy();
  });

  it('keeps the directory admin-only and separate from the detail and form routes', () => {
    const route = ADMIN_ROUTES.find((item) => item.path === 'departamentos');
    expect(route?.canActivate).toEqual([adminGuard]);
    expect(ADMIN_ROUTES.indexOf(route!)).toBeLessThan(
      ADMIN_ROUTES.findIndex((item) => item.path === 'departamentos/:id'),
    );
    expect(ADMIN_ROUTES.find((item) => item.path === 'departamentos/nuevo')?.canActivate).toEqual([
      adminGuard,
    ]);
    expect(
      ADMIN_ROUTES.find((item) => item.path === 'departamentos/:id/editar')?.canActivate,
    ).toEqual([adminGuard]);
  });
});
