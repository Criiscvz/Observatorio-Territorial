import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { of, Subject } from 'rxjs';
import { AtlasCategoriaService } from '@core/services/atlas-categoria.service';
import { ConfirmDialogComponent, ConfirmDialogData } from '@shared/components/confirm-dialog/confirm-dialog.component';
import { AtlasCategoriasComponent } from './atlas-categorias.component';

describe('Atlas category management', () => {
  const item = { id: 'category-1', nombre: 'Salud', descripcion: null };
  let component: AtlasCategoriasComponent;
  let closed: Subject<boolean>;
  let service: any;
  let dialog: any;
  let data: ConfirmDialogData;

  beforeEach(() => {
    closed = new Subject<boolean>();
    service = { list: vi.fn(() => of([item])), save: vi.fn(), delete: vi.fn(() => of({ message: 'Eliminada' })) };
    dialog = { open: vi.fn((_component, options) => { data = options.data; return { afterClosed: () => closed }; }) };
    TestBed.configureTestingModule({ providers: [
      { provide: AtlasCategoriaService, useValue: service },
      { provide: MatDialog, useValue: dialog },
      { provide: MatSnackBar, useValue: { open: vi.fn() } },
    ] });
    component = TestBed.runInInjectionContext(() => new AtlasCategoriasComponent());
  });

  it('cancel and dismissal do not send a deletion request', () => {
    component.remove(item);
    expect(dialog.open).toHaveBeenCalledWith(ConfirmDialogComponent, expect.anything());
    expect(data.title).toBe('Eliminar categoría');
    expect(data.message).toBe('¿Estás seguro de que deseas eliminar la categoría «Salud»?');
    expect(service.delete).not.toHaveBeenCalled();
    closed.next(false);
    expect(service.delete).not.toHaveBeenCalled();
    expect(component.deleting()).toBe(false);
  });

  it('sends deletion only through the confirmation action and prevents duplicate modals', () => {
    component.remove(item);
    component.remove(item);
    expect(dialog.open).toHaveBeenCalledTimes(1);
    data.confirmAction!().subscribe();
    expect(service.delete).toHaveBeenCalledExactlyOnceWith(item.id);
    expect(service.list).toHaveBeenCalled();
  });

  it('shows the server association conflict without removing the category', () => {
    component.ngOnInit();
    component.remove(item);
    data.onError!({ status: 409, error: { message: 'Primero debes reasignar el contenido.' } });
    expect(component.error()).toBe('Primero debes reasignar el contenido.');
    expect(component.categorias()).toEqual([item]);
  });

  it('normalizes names and prevents duplicate saves while a request is pending', () => {
    const response = new Subject<any>();
    service.save.mockReturnValue(response);
    component.form.setValue({ nombre: '  Salud   pública ', descripcion: '' });
    component.save();
    component.save();
    expect(service.save).toHaveBeenCalledExactlyOnceWith({ nombre: 'Salud pública', descripcion: null }, undefined);
    response.next({ message: 'Guardada', data: item });
    expect(component.saving()).toBe(false);
  });

  it('the shared modal sends one request and stays open until the server responds', () => {
    const pending = new Subject<unknown>();
    const action = vi.fn(() => pending);
    const ref = { close: vi.fn(), disableClose: false };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [
      { provide: MatDialogRef, useValue: ref },
      { provide: MAT_DIALOG_DATA, useValue: { confirmAction: action } },
    ] });
    const modal = TestBed.runInInjectionContext(() => new ConfirmDialogComponent());
    modal.onConfirm();
    modal.onConfirm();
    expect(action).toHaveBeenCalledTimes(1);
    expect(ref.disableClose).toBe(true);
    expect(ref.close).not.toHaveBeenCalled();
    pending.next({});
    expect(ref.close).toHaveBeenCalledWith(true);
  });
});
