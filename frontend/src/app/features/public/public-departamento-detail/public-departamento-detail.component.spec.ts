import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { MatDialog, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { BehaviorSubject, of, Subject, throwError } from 'rxjs';
import { DepartamentoService } from '@core/services/departamento.service';
import { ArticulosService } from '@core/services/articulos.service';
import { ReportesService } from '@core/services/reportes.service';
import { PublicacionService } from '@core/services/publicacion.service';
import { AuthService } from '@core/services/auth.service';
import { PublicDepartamentoDetailComponent } from './public-departamento-detail.component';
import { PublicPublicationDetailsComponent } from '../components/public-publication-details.component';
import { hasPublicPdf, publicHttpUrl, toPublicLibraryItem } from '../components/public-library-publication';
import { SubscriberAccessDialogComponent } from '@shared/components/subscriber-access-dialog';
import { PublicationViewerComponent } from '../components/publication-viewer.component';
import { PublicationViewerService } from '../components/publication-viewer.service';

describe('Biblioteca pública por observatorio', () => {
  const department = {id: 'salud', nombre: 'Observatorio de la Salud', descripcion: 'Investigación'};
  const article = (id: number, extra: any = {}) => ({id: `art-${id}`, departamento_id: 'salud', titulo: `Artículo ${id}`, codigo: `ART-${id}`, autor: ['Ana Pérez','Luis'], fecha_publicacion: '2026-10-20', fuente: 'ULEAM', download_url: `/api/departamentos/publicaciones/art-${id}/download`, link_url: 'https://example.test/fuente', ...extra});
  function setup(options: {articles?: any[]; reports?: any[]; books?: any[]; articleError?: boolean} = {}) {
    const params = new BehaviorSubject({id: 'salud'});
    const departments = {getPublicById: vi.fn(() => of(department))};
    const articles = {getAll: vi.fn(() => options.articleError ? throwError(() => new Error('offline')) : of(options.articles || []))};
    const reports = {getAll: vi.fn(() => of(options.reports || []))};
    const publications = {getPublicAtlasByDepartamento: vi.fn(() => of(options.books || [])), openPdf: vi.fn(() => of(true))};
    const dialog = {open: vi.fn()}; const snack = {open: vi.fn()};
    TestBed.configureTestingModule({providers: [provideRouter([]),
      {provide: ActivatedRoute, useValue: {params}}, {provide: DepartamentoService, useValue: departments},
      {provide: ArticulosService, useValue: articles}, {provide: ReportesService, useValue: reports},
      {provide: PublicacionService, useValue: publications}, {provide: AuthService, useValue: {user: () => null, isAuthenticated: () => false}},
      {provide: MatDialog, useValue: dialog}, {provide: MatSnackBar, useValue: snack},
    ]});
    TestBed.overrideProvider(MatDialog, {useValue: dialog});
    TestBed.overrideProvider(MatSnackBar, {useValue: snack});
    const fixture = TestBed.createComponent(PublicDepartamentoDetailComponent); fixture.detectChanges();
    return {fixture, component: fixture.componentInstance, element: fixture.nativeElement as HTMLElement, departments, articles, reports, publications, dialog, params, snack};
  }
  it('muestra los tres tipos con totales reales y pagina 20 sin mezclar observatorios ni Atlas', () => {
    const {component, fixture, element} = setup({articles: [...Array.from({length: 41}, (_, i) => article(i)), article(99, {departamento_id: 'otro'})], reports: [{id:'rep', departamento_id:'salud', nombre_indicador:'Reporte', link_url:'https://app.powerbi.com/view?r=demo'}], books: [{...article(2), id:'lib', tipo:'LIBRO', autores:['Autora']}, {...article(3), tipo:'ATLAS'}]});
    expect(component.count('ARTICULO')).toBe(41); expect(component.count('REPORTE')).toBe(1); expect(component.count('LIBRO')).toBe(1);
    expect(element.querySelectorAll('[role="tab"]')).toHaveLength(3); expect(element.querySelectorAll('.public-library-row')).toHaveLength(20);
    component.changePage(1); fixture.detectChanges(); expect(component.rangeStart()).toBe(21); expect(component.visible()).toHaveLength(20);
    component.changePage(1); fixture.detectChanges(); expect(component.visible()).toHaveLength(1); expect(element.textContent).toContain('41–41 de 41');
    component.selectType('LIBRO'); fixture.detectChanges(); expect(component.page()).toBe(0); expect(element.textContent).toContain('Leer libro');
  });
  it('busca por autores, título, código y fuente sin tildes y muestra un vacío útil', () => {
    const {component, fixture, element} = setup({articles:[article(1), article(2, {autor:'Otro', fuente:'Ministerio', titulo:'Acceso territorial'})]});
    for (const query of ['PEREZ','ART-1']) {component.search(query); expect(component.filtered().map(x => x.id)).toEqual(['art-1']);}
    component.search('ministerio'); expect(component.filtered().map(x => x.id)).toEqual(['art-2']);
    component.search('inexistente'); fixture.detectChanges(); expect(element.textContent).toContain('No se encontraron publicaciones');
    component.selectType('LIBRO'); fixture.detectChanges(); expect(element.textContent).toContain('Aún no hay libros publicados'); expect(component.query()).toBe('');
  });
  it('elige la primera pestaña con publicaciones y conserva un error parcial sin ocultar reportes', () => {
    const {component, fixture, element} = setup({articleError:true, reports:[{id:'rep', departamento_id:'salud', nombre_indicador:'Reporte', link_url:'https://app.powerbi.com/view?r=demo'}]});
    expect(component.type()).toBe('REPORTE'); expect(component.visible()).toHaveLength(1);
    expect(element.querySelector('[role="alert"]')?.textContent).toContain('artículos');
    component.selectType('ARTICULO'); fixture.detectChanges(); expect(component.visible()).toHaveLength(0);
  });
  it('cancela la carga anterior al cambiar de observatorio y no deja resultados de otra ruta', () => {
    const {component, params, departments, articles} = setup({articles:[article(1)]});
    const pending = new Subject<any[]>(); articles.getAll.mockReturnValue(pending);
    params.next({id:'anterior'}); expect(component.loading()).toBe(true);
    articles.getAll.mockReturnValue(of([])); departments.getPublicById.mockReturnValue(of({...department,id:'actual'}));
    params.next({id:'actual'}); pending.next([article(1)]); pending.complete();
    expect(component.departamento()?.id).toBe('actual'); expect(component.items()).toEqual([]); expect(component.loading()).toBe(false);
  });
  it('abre el PDF o el reporte correcto y usa una ventana central para sus detalles', () => {
    const {component, publications, dialog} = setup({articles:[article(1)], reports:[{id:'rep', departamento_id:'salud', nombre_indicador:'Reporte', link_url:'https://app.powerbi.com/view?r=demo'}]});
    const pdf = component.items().find(x => x.type === 'ARTICULO')!;
    component.read(pdf); expect(dialog.open).toHaveBeenCalledWith(PublicationViewerComponent, expect.objectContaining({data: {item:pdf, departmentName:department.nombre, mode:'pdf'}}));
    component.openDetails(pdf); expect(dialog.open).toHaveBeenCalledWith(PublicPublicationDetailsComponent, expect.objectContaining({data:{item:pdf,departmentName:department.nombre},maxHeight:'calc(100dvh - 24px)'}));
    const open = vi.spyOn(window,'open').mockImplementation(() => null);
    const report=component.items().find(x => x.type === 'REPORTE')!;
    component.read(report); expect(dialog.open).toHaveBeenCalledWith(PublicationViewerComponent, expect.objectContaining({data: {item:report,departmentName:department.nombre,mode:'report'}})); expect(open).not.toHaveBeenCalled(); open.mockRestore();
  });
  it('no abre ningún recurso de suscriptor para visitantes aunque lleguen enlaces en la respuesta', () => {
    const {component, dialog, publications} = setup({articles:[article(1,{visibilidad:'suscriptor'})]});
    const item=component.items()[0]; expect(item.locked).toBe(true); expect(item.download_url).toBeNull(); expect(item.sourceUrl).toBeNull();
    component.read(item); component.openDetails(item); expect(publications.openPdf).not.toHaveBeenCalled();
    expect(dialog.open).toHaveBeenCalledWith(SubscriberAccessDialogComponent, expect.anything());
  });
});

describe('Recursos de la biblioteca pública', () => {
  it('separa el PDF y el enlace de fuente, valida protocolos y conserva SharePoint y las fichas antiguas', () => {
    const base:any={id:'art',titulo:'Título',download_url:'/api/publicaciones/art/download',link_url:'https://example.test/fuente',autor:['Ana','Luis']};
    const item=toPublicLibraryItem(base,'ARTICULO',false); expect(item.authors).toBe('Ana, Luis'); expect(item.sourceUrl).toBe('https://example.test/fuente'); expect(hasPublicPdf(item)).toBe(true);
    const legacy=toPublicLibraryItem({...base,download_url:null,link_url:null,enlace:'https://example.test/lectura'},'ARTICULO',false); expect(hasPublicPdf(legacy)).toBe(false); expect(legacy.sourceUrl).toBe('https://example.test/lectura');
    const report=toPublicLibraryItem({id:'r',nombre_indicador:'R',ficha_indicador:'https://example.test/ficha.pdf',link_url:'https://app.powerbi.com/view?r=test',fuente:'ULEAM'} as any,'REPORTE',false);
    expect(hasPublicPdf(report)).toBe(true); expect(report.sourceUrl).toBeNull(); expect(report.reportUrl).toContain('powerbi.com');
    const book=toPublicLibraryItem({id:'b',titulo:'Libro',sharepoint_url:'https://tenant.sharepoint.com/libro.pdf'} as any,'LIBRO',false); expect(hasPublicPdf(book)).toBe(true);
    for(const url of ['javascript:alert(1)','data:text/html,x','ftp://example.test']) expect(publicHttpUrl(url)).toBeNull();
  });
  it('respeta el bloqueo explícito del servidor incluso para una cuenta suscriptora', () => {
    const item=toPublicLibraryItem({id:'a',titulo:'Bloqueado',bloqueado:true,download_url:'https://example.test/a.pdf',link_url:'https://example.test'} as any,'ARTICULO',true);
    expect(hasPublicPdf(item)).toBe(false); expect(item.sourceUrl).toBeNull();
  });
  it('muestra solo los botones disponibles en la ficha y abre el PDF real', () => {
    const item=toPublicLibraryItem({id:'a',titulo:'Artículo',download_url:'/api/a/download',link_url:'https://example.test/fuente',autor:'Ana'} as any,'ARTICULO',false);
    const publications={openPdf:vi.fn(() => of(true))}; const viewer={open:vi.fn()};
    TestBed.configureTestingModule({providers:[{provide:PublicationViewerService,useValue:viewer},{provide:MAT_DIALOG_DATA,useValue:{item,departmentName:'Salud'}},{provide:MatDialogRef,useValue:{close:vi.fn()}},{provide:PublicacionService,useValue:publications},{provide:MatSnackBar,useValue:{open:vi.fn()}}]});
    const fixture=TestBed.createComponent(PublicPublicationDetailsComponent); fixture.detectChanges();
    const element=fixture.nativeElement as HTMLElement; expect(element.querySelector('a')?.getAttribute('href')).toBe('https://example.test/fuente');
    element.querySelector<HTMLButtonElement>('.resource-actions button')!.click(); expect(viewer.open).toHaveBeenCalledWith(item,'Salud','pdf');
    expect(element.textContent).not.toContain('Ver reporte');
  });
});
