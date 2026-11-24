import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { BarometroPage, BarometroService } from '@core/services/barometro.service';
import { BehaviorSubject, of, Subject, throwError } from 'rxjs';
import { barometroPage, barometroPublication } from '../../../testing/barometro.fixture';
import { PublicPublicationDetailsComponent } from '../components/public-publication-details.component';
import { PublicationViewerService } from '../components/publication-viewer.service';
import { BarometerViewComponent } from './barometer-view.component';

describe('BarometerViewComponent', () => {
  function setup(code = 'investigacion', initialPage = barometroPage()) {
    const params = new BehaviorSubject(convertToParamMap({ codigo: code }));
    const published = vi.fn<BarometroService['published']>(() => of(initialPage));
    const dialog = { open: vi.fn() };
    const viewer = { open: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { paramMap: params } },
        { provide: BarometroService, useValue: { published } },
        { provide: MatDialog, useValue: dialog },
        { provide: PublicationViewerService, useValue: viewer },
      ],
    });
    const fixture = TestBed.createComponent(BarometerViewComponent);
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance, published, params, dialog, viewer };
  }

  it('shows an unavailable section without requesting a public library', () => {
    const { fixture, published } = setup('sin-seccion');
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector('h1')?.textContent).toBe('Sección del Barómetro no disponible');
    expect(root.querySelector('a')?.getAttribute('href')).toBe('/publico/barometro/barometro');
    expect(published).not.toHaveBeenCalled();
  });

  it('cancels a pending search on navigation and resets the filters for the new section', () => {
    const { fixture, component, published, params } = setup();
    const previous = new Subject<BarometroPage>();
    const current = barometroPublication({ seccion: 'vinculacion', titulo: 'Indicadores de vinculación' });
    published.mockReturnValueOnce(previous).mockReturnValueOnce(of(barometroPage([current])));
    const search = (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>('input[type="search"]')!;

    search.value = '  resultados  ';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    expect(published).toHaveBeenLastCalledWith('investigacion', 1, 'resultados');
    expect(component.loading()).toBe(true);

    params.next(convertToParamMap({ codigo: 'vinculacion' }));
    previous.next(barometroPage([barometroPublication()]));
    expect(previous.observed).toBe(false);
    expect(published).toHaveBeenLastCalledWith('vinculacion', 1, '');
    expect(component.query()).toBe('');
    expect(component.items().map(item => item.titulo)).toEqual([current.titulo]);
  });

  it('recovers when the selected page no longer exists on the server', () => {
    const publication = barometroPublication();
    const { component, published } = setup('investigacion', barometroPage([publication], 1, 21));
    published.mockReturnValueOnce(of(barometroPage([], 2, 1)))
      .mockReturnValueOnce(of(barometroPage([publication])));

    component.changePage(1);

    expect(published.mock.calls).toEqual([
      ['investigacion', 1, ''], ['investigacion', 2, ''], ['investigacion', 1, ''],
    ]);
    expect(component.page()).toBe(0);
    expect(component.total()).toBe(1);
  });

  it('shows a load error and lets visitors retry from the library', () => {
    const { fixture, published } = setup();
    const root = fixture.nativeElement as HTMLElement;
    const publication = barometroPublication();
    published.mockReturnValueOnce(throwError(() => new Error('Servicio no disponible')))
      .mockReturnValueOnce(of(barometroPage([publication])));
    const search = root.querySelector<HTMLInputElement>('input[type="search"]')!;
    search.value = 'indicadores';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();

    expect(root.querySelector('[role="alert"]')?.textContent).toContain('No se pudo cargar la biblioteca');
    expect(root.textContent).not.toContain('No encontramos publicaciones');

    root.querySelector<HTMLButtonElement>('[role="alert"] button')!.click();
    fixture.detectChanges();

    expect(published).toHaveBeenLastCalledWith('investigacion', 1, 'indicadores');
    expect(root.querySelector('[role="alert"]')).toBeNull();
    expect(root.querySelector('h3')?.textContent).toBe(publication.titulo);
  });

  it('opens the current published report and ignores entries from another section or state', () => {
    const publication = barometroPublication();
    const archived = barometroPublication({ id: 8, estado: 'ARCHIVADO' });
    const otherSection = barometroPublication({ id: 9, seccion: 'barometro' });
    const incompatible = barometroPublication({ id: 10, link_url: 'https://example.test/report' });
    const page = barometroPage([publication, archived, otherSection, incompatible]);
    const { fixture, component, dialog, viewer } = setup('investigacion', page);
    const root = fixture.nativeElement as HTMLElement;
    const [current, archivedItem, foreignItem, incompatibleItem] = component.items();

    component.open(archivedItem);
    component.open(foreignItem, true);
    component.open(incompatibleItem);
    expect(viewer.open).not.toHaveBeenCalled();
    expect(dialog.open).not.toHaveBeenCalled();
    expect(root.querySelectorAll<HTMLButtonElement>('.view-atlas')[3].disabled).toBe(true);

    root.querySelector<HTMLButtonElement>('.details-button')!.click();
    expect(dialog.open).toHaveBeenCalledExactlyOnceWith(PublicPublicationDetailsComponent, expect.objectContaining({
      data: expect.objectContaining({ context: 'barometro', item: expect.objectContaining({ code: current.codigo }) }),
    }));
    root.querySelector<HTMLButtonElement>('.view-atlas')!.click();
    expect(viewer.open).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ code: 'BAR-0007', reportUrl: publication.link_url }),
      'Resultados Investigación ULEAM', 'report', 'barometro',
    );
  });
});
