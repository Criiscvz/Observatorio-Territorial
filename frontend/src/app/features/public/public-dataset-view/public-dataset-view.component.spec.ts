import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { TranslateModule } from '@ngx-translate/core';
import { of } from 'rxjs';
import { CategoriaService } from '@core/services/categoria.service';
import { DashboardService } from '@core/services/dashboard.service';
import { PublicDatasetViewComponent } from './public-dataset-view.component';

describe('Dataset table after retiring graphical analysis', () => {
  const getPublicDatasetData = vi.fn((id: string, page: number) => of({
    dataset: { id, nombre: 'Registros territoriales', total_registros: 51, departamento_id: 'obs-1' },
    variables: [
      { id: 'v1', nombre_columna: 'canton', nombre_original: 'Cantón', tipo_dato: 'TEXTO', es_visible: true },
      { id: 'v2', nombre_columna: 'interno', tipo_dato: 'TEXTO', es_visible: false },
    ],
    data: [{ id: page, data: { canton: page === 1 ? 'Manta' : 'Chone', interno: 'No público' } }],
    pagination: { current_page: page, per_page: 50, total: 51, last_page: 2 },
  }));

  beforeEach(async () => {
    getPublicDatasetData.mockClear();
    await TestBed.configureTestingModule({
      imports: [PublicDatasetViewComponent, TranslateModule.forRoot()],
      providers: [
        provideRouter([]), provideNoopAnimations(),
        { provide: ActivatedRoute, useValue: { params: of({ id: 'dataset-1' }) } },
        { provide: DashboardService, useValue: { getPublicDatasetData } },
        { provide: CategoriaService, useValue: { getFuentes: () => of([
          { id: 'source-1', titulo: 'Fuente del conjunto', url: 'https://example.org/datos' },
        ]) } },
      ],
    }).compileComponents();
  });

  it('renders visible records and retains data and sources tabs', async () => {
    const fixture = TestBed.createComponent(PublicDatasetViewComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelector('table')?.textContent).toContain('Manta');
    expect(element.querySelector('table')?.textContent).toContain('Cantón');
    expect(element.querySelector('table')?.textContent).not.toContain('No público');
    const tabs = Array.from(element.querySelectorAll('[role="tab"]')).map(tab => tab.textContent);
    expect(tabs).toHaveLength(2);
    expect(tabs.join(' ')).toContain('public.datasetView.tabs.data');
    expect(tabs.join(' ')).toContain('datasets.view.sources.title');
    expect(element.querySelector('app-variable-list')).toBeNull();
  });

  it('requests the next page and updates the table through the paginator', async () => {
    const fixture = TestBed.createComponent(PublicDatasetViewComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    const element: HTMLElement = fixture.nativeElement;
    element.querySelector<HTMLButtonElement>('.mat-mdc-paginator-navigation-next')!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(getPublicDatasetData).toHaveBeenLastCalledWith('dataset-1', 2);
    expect(element.querySelector('table')?.textContent).toContain('Chone');
  });
});
