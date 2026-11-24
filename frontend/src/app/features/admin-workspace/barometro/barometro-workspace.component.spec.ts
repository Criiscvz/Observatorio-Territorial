import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { BAROMETRO_SECTIONS, BarometroPublication, BarometroService } from '@core/services/barometro.service';
import { BehaviorSubject, of, Subject, throwError } from 'rxjs';
import { barometroPage, barometroPublication } from '../../../testing/barometro.fixture';
import { PublicationViewerService } from '../../public/components/publication-viewer.service';
import { BarometroPublicationEditorComponent, BarometroWorkspaceComponent } from './barometro-workspace.component';

describe('BarometroWorkspaceComponent', () => {
  function setup(code?: string) {
    const params = new BehaviorSubject(convertToParamMap(code ? { codigo: code } : {}));
    const counts = vi.fn<BarometroService['counts']>(() => of({ data: { investigacion: 1 } }));
    const list = vi.fn<BarometroService['list']>(() => of(barometroPage()));
    const result = new Subject<boolean | undefined>();
    const dialog = { open: vi.fn(() => ({ afterClosed: () => result.asObservable() })) };
    const viewer = { open: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { paramMap: params } },
        { provide: BarometroService, useValue: { counts, list } },
        { provide: MatDialog, useValue: dialog },
        { provide: PublicationViewerService, useValue: viewer },
      ],
    });
    const fixture = TestBed.createComponent(BarometroWorkspaceComponent);
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance, params, counts, list, dialog, result, viewer };
  }

  it('loads counts for the directory and requests only the selected library after navigation', () => {
    const { fixture, params, counts, list } = setup();
    const root = fixture.nativeElement as HTMLElement;
    expect(counts).toHaveBeenCalledTimes(1);
    expect(list).not.toHaveBeenCalled();
    expect(root.querySelectorAll('.barometro-section-row')).toHaveLength(3);
    expect(root.querySelector('.barometro-section-row small')?.textContent).toBe('1 publicación');

    params.next(convertToParamMap({ codigo: 'vinculacion' }));
    expect(list).toHaveBeenCalledExactlyOnceWith('vinculacion', 1, '', '');

    params.next(convertToParamMap({ codigo: 'sin-seccion' }));
    fixture.detectChanges();
    expect(root.querySelector('h1')?.textContent).toBe('Sección no disponible');
    expect(counts).toHaveBeenCalledTimes(1);
    expect(list).toHaveBeenCalledTimes(1);
  });

  it('keeps the search and state when the server reduces the number of pages', () => {
    const { component, list } = setup('investigacion');
    const item = barometroPublication({ estado: 'ARCHIVADO' });
    const filteredFirstPage = barometroPage([item], 1, 21);
    list.mockReturnValueOnce(of(filteredFirstPage));
    component.search('  ULEAM  ');
    list.mockReturnValueOnce(of(filteredFirstPage));
    component.filter('ARCHIVADO');
    list.mockReturnValueOnce(of(barometroPage([], 2, 1)))
      .mockReturnValueOnce(of(barometroPage([item])));

    component.changePage(1);

    expect(list.mock.calls.slice(1)).toEqual([
      ['investigacion', 1, 'ULEAM', ''],
      ['investigacion', 1, 'ULEAM', 'ARCHIVADO'],
      ['investigacion', 2, 'ULEAM', 'ARCHIVADO'],
      ['investigacion', 1, 'ULEAM', 'ARCHIVADO'],
    ]);
    expect(component.items()).toEqual([item]);
    expect(component.page()).toBe(0);
    expect(component.rangeEnd()).toBe(1);
  });

  it('opens an editor only for the current section and reloads the list only after a save', () => {
    const { component, list, dialog, result } = setup('investigacion');
    const item = barometroPublication();

    component.edit(barometroPublication({ seccion: 'vinculacion' }));
    expect(dialog.open).not.toHaveBeenCalled();

    component.edit(item);
    expect(dialog.open).toHaveBeenCalledExactlyOnceWith(BarometroPublicationEditorComponent, expect.objectContaining({
      data: { section: BAROMETRO_SECTIONS[0], item },
      disableClose: true,
    }));
    result.next(undefined);
    result.complete();
    expect(list).toHaveBeenCalledTimes(1);

    dialog.open.mockReturnValueOnce({ afterClosed: () => of(true) });
    component.edit();
    expect(list).toHaveBeenCalledTimes(2);
    expect(list).toHaveBeenLastCalledWith('investigacion', 1, '', '');
  });

  it('lets an administrator retry a failed list and preview a report in review within that section', () => {
    const { fixture, component, list, viewer } = setup('investigacion');
    const root = fixture.nativeElement as HTMLElement;
    const item = barometroPublication({ estado: 'EN_REVISION' });
    list.mockReturnValueOnce(throwError(() => new Error('Servicio no disponible')))
      .mockReturnValueOnce(of(barometroPage([item])));
    component.reload();
    fixture.detectChanges();

    expect(root.querySelector('[role="alert"]')?.textContent).toContain('No se pudo cargar el Barómetro');
    root.querySelector<HTMLButtonElement>('[role="alert"] button')!.click();
    fixture.detectChanges();
    expect(root.querySelector('[role="alert"]')).toBeNull();
    expect(root.querySelector('tbody')?.textContent).toContain('En revisión');

    component.view({ ...item, seccion: 'vinculacion' });
    expect(viewer.open).not.toHaveBeenCalled();
    root.querySelector<HTMLButtonElement>('tbody button')!.click();
    expect(viewer.open).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ code: 'BAR-0007', reportUrl: item.link_url }),
      BAROMETRO_SECTIONS[0].name, 'report', 'barometro',
    );
  });
});

describe('BarometroPublicationEditorComponent', () => {
  function setup(item: BarometroPublication | null = null) {
    const save = vi.fn<BarometroService['save']>();
    const dialog = { close: vi.fn() };
    const viewer = { open: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: { section: BAROMETRO_SECTIONS[0], item } },
        { provide: MatDialogRef, useValue: dialog },
        { provide: BarometroService, useValue: { save } },
        { provide: PublicationViewerService, useValue: viewer },
      ],
    });
    const fixture = TestBed.createComponent(BarometroPublicationEditorComponent);
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance, save, dialog, viewer };
  }

  it('blocks preview and save when the link is incompatible, and rejects a blank title', () => {
    const { fixture, component, save, viewer } = setup();
    const root = fixture.nativeElement as HTMLElement;
    component.form.patchValue({ titulo: 'Indicadores', link_url: 'https://example.test/report' });
    fixture.detectChanges();

    expect(root.querySelector<HTMLButtonElement>('.manage')?.disabled).toBe(true);
    component.preview();
    expect(viewer.open).not.toHaveBeenCalled();
    const submit = root.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    submit.click();
    expect(save).not.toHaveBeenCalled();

    component.form.patchValue({ titulo: '   ', link_url: barometroPublication().link_url });
    submit.click();
    fixture.detectChanges();

    expect(component.form.controls.titulo.touched).toBe(true);
    expect(root.querySelector('[role="alert"]')?.textContent).toContain('Revisa el título');
    expect(save).not.toHaveBeenCalled();
  });

  it('preserves an edited report after a validation error and submits a single normalized retry', () => {
    const item = barometroPublication();
    const { component, save, dialog } = setup(item);
    const pending = new Subject<{ data: BarometroPublication }>();
    const updated = {
      titulo: 'Informe corregido', fecha_publicacion: item.fecha_publicacion,
      fuente: 'ULEAM', descripcion: 'Periodo actualizado.', link_url: item.link_url, estado: item.estado,
    };
    save.mockReturnValueOnce(pending).mockReturnValueOnce(of({ data: { ...item, ...updated } }));
    component.form.patchValue({
      titulo: '  Informe corregido ', descripcion: ' Periodo actualizado. ', fuente: ' ULEAM ',
      link_url: ` ${item.link_url} `,
    });

    component.save();
    component.save();
    component.close();
    expect(save).toHaveBeenCalledExactlyOnceWith('investigacion', updated, item.id);
    expect(dialog.close).not.toHaveBeenCalled();
    pending.error(new HttpErrorResponse({ status: 422, error: { errors: { link_url: ['Revisa el enlace.'] } } }));

    expect(component.error()).toBe('Revisa el enlace.');
    expect(component.saving()).toBe(false);
    expect(component.form.controls.titulo.value).toBe('  Informe corregido ');
    component.save();
    expect(save).toHaveBeenCalledTimes(2);
    expect(save).toHaveBeenLastCalledWith('investigacion', updated, item.id);
    expect(component.error()).toBe('');
    expect(dialog.close).toHaveBeenCalledExactlyOnceWith(true);
  });

  it('previews an unsaved report and asks before discarding the form', () => {
    const { fixture, component, save, dialog, viewer } = setup();
    const link = barometroPublication().link_url;
    component.form.controls.link_url.setValue(link);
    component.form.controls.link_url.markAsDirty();
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;

    expect(component.form.controls.estado.value).toBe('EN_REVISION');
    root.querySelector<HTMLButtonElement>('.manage')!.click();
    expect(viewer.open).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ code: 'Vista previa', title: 'Vista previa del reporte', reportUrl: link }),
      BAROMETRO_SECTIONS[0].name, 'report', 'barometro',
    );
    root.querySelector<HTMLButtonElement>('[aria-label="Cerrar formulario"]')!.click();
    fixture.detectChanges();
    expect(dialog.close).not.toHaveBeenCalled();
    expect(root.querySelector('[role="alert"]')?.textContent).toContain('Hay cambios sin guardar');

    root.querySelector<HTMLButtonElement>('.discard-notice .danger')!.click();
    expect(dialog.close).toHaveBeenCalledExactlyOnceWith();
    expect(save).not.toHaveBeenCalled();
  });
});
