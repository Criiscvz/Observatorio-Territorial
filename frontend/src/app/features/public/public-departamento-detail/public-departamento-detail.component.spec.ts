import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { MatDialog, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { BehaviorSubject, of, Subject, throwError } from 'rxjs';
import { DepartamentoService } from '@core/services/departamento.service';
import { PublicCatalogService } from '@core/services/public-catalog.service';
import { PublicacionService } from '@core/services/publicacion.service';
import { AuthService } from '@core/services/auth.service';
import { PublicDepartamentoDetailComponent } from './public-departamento-detail.component';
import { PublicPublicationDetailsComponent } from '../components/public-publication-details.component';
import { hasPublicPdf, publicHttpUrl, toPublicLibraryItem } from '../components/public-library-publication';
import { SubscriberAccessDialogComponent } from '@shared/components/subscriber-access-dialog';
import { PublicationViewerComponent } from '../components/publication-viewer.component';
import { PublicationViewerService } from '../components/publication-viewer.service';

describe('Biblioteca pública con paginación SQL', () => {
  const department = {id:'salud', nombre:'Observatorio de la Salud', descripcion:'Investigación'};
  const article = (id:number, extra:any={}) => ({id:'art-'+id, resource_key:'publicaciones:art-'+id, origen:'publicaciones', tipo:'ARTICULO', departamento_id:'salud', titulo:'Artículo '+id, codigo:'ART-'+id, autores:['Ana Pérez'], fecha_publicacion:'2026-10-20', fuente:'ULEAM', download_url:'/api/departamentos/publicaciones/art-'+id+'/download', link_url:'https://example.test/fuente', ...extra});
  const response = (data:any[], total=data.length, counts:any={ARTICULO:total,REPORTE:0,LIBRO:0}, page=1) => ({data,counts,meta:{current_page:page,per_page:20,total,last_page:Math.max(1,Math.ceil(total/20)),from:total?(page-1)*20+1:null,to:Math.min(page*20,total)}});
  function setup(initial:any=response([article(1)])) {
    const params=new BehaviorSubject({id:'salud'});
    const departments={getPublicById:vi.fn(() => of(department))};
    const catalog={getPage:vi.fn(() => of(initial))};
    const publications={openPdf:vi.fn(() => of(true))};
    const dialog={open:vi.fn()}, snack={open:vi.fn()};
    TestBed.configureTestingModule({providers:[provideRouter([]),
      {provide:ActivatedRoute,useValue:{params}}, {provide:DepartamentoService,useValue:departments},
      {provide:PublicCatalogService,useValue:catalog}, {provide:PublicacionService,useValue:publications},
      {provide:AuthService,useValue:{user:() => null,isAuthenticated:() => false}},
      {provide:MatDialog,useValue:dialog},{provide:MatSnackBar,useValue:snack}]});
    TestBed.overrideProvider(MatDialog,{useValue:dialog}); TestBed.overrideProvider(MatSnackBar,{useValue:snack});
    const fixture=TestBed.createComponent(PublicDepartamentoDetailComponent);fixture.detectChanges();
    return {fixture,component:fixture.componentInstance,element:fixture.nativeElement as HTMLElement,catalog,departments,params,dialog,publications};
  }
  it('solicita una página de 20 y conserva los totales del servidor sin cargar las demás páginas', () => {
    const counts={ARTICULO:41,REPORTE:1,LIBRO:1};
    const s=setup(response(Array.from({length:20},(_,i)=>article(i)),41,counts));
    expect(s.catalog.getPage).toHaveBeenCalledExactlyOnceWith('salud','ARTICULO',1,'');
    expect(s.component.count('ARTICULO')).toBe(41);expect(s.component.count('REPORTE')).toBe(1);expect(s.component.count('LIBRO')).toBe(1);
    expect(s.element.querySelectorAll('.public-library-row')).toHaveLength(20);
    s.catalog.getPage.mockReturnValue(of(response(Array.from({length:20},(_,i)=>article(i+20)),41,counts,2)));
    s.component.changePage(1);s.fixture.detectChanges();expect(s.catalog.getPage).toHaveBeenLastCalledWith('salud','ARTICULO',2,'');expect(s.component.rangeStart()).toBe(21);
    s.catalog.getPage.mockReturnValue(of(response([article(40)],41,counts,3)));s.component.changePage(1);s.fixture.detectChanges();expect(s.element.textContent).toContain('41–41 de 41');
    s.catalog.getPage.mockReturnValue(of(response([article(1,{tipo:'LIBRO'})],1,counts)));s.component.selectType('LIBRO');s.fixture.detectChanges();expect(s.catalog.getPage).toHaveBeenLastCalledWith('salud','LIBRO',1,'');expect(s.element.textContent).toContain('Leer libro');
  });
  it('envía búsqueda al servidor y vuelve a la primera página sin filtrar solo lo descargado', () => {
    const s=setup(response([article(1)],41));
    s.catalog.getPage.mockReturnValue(of(response([],0,{ARTICULO:41,REPORTE:0,LIBRO:0})));
    s.component.search('PEREZ');s.fixture.detectChanges();expect(s.catalog.getPage).toHaveBeenLastCalledWith('salud','ARTICULO',1,'PEREZ');expect(s.component.visible()).toHaveLength(0);expect(s.component.count('ARTICULO')).toBe(41);expect(s.element.textContent).toContain('No se encontraron publicaciones');
  });
  it('corrige la página si el total cambia mientras se navega', () => {
    const s=setup(response([article(1)],41));
    s.catalog.getPage.mockReturnValueOnce(of(response([],1,undefined,2))).mockReturnValueOnce(of(response([article(2)],1)));
    s.component.changePage(1);
    expect(s.catalog.getPage).toHaveBeenLastCalledWith('salud','ARTICULO',1,'');
    expect(s.component.page()).toBe(0);expect(s.component.visible()[0].title).toBe('Artículo 2');
  });
  it('elige la primera pestaña con resultados según counts y no muestra publicaciones de otra pestaña', () => {
    const s=setup(response([article(1,{tipo:'REPORTE',titulo:'Reporte',link_url:'https://app.powerbi.com/view?r=demo'})],1,{ARTICULO:0,REPORTE:1,LIBRO:0}));
    expect(s.component.type()).toBe('REPORTE');expect(s.catalog.getPage).toHaveBeenLastCalledWith('salud','REPORTE',1,'');expect(s.component.visible()[0].title).toBe('Reporte');
  });
  it('cancela solicitudes al cambiar de observatorio y búsquedas anteriores', () => {
    const s=setup();const pending=new Subject<any>();s.catalog.getPage.mockReturnValue(pending);
    s.component.search('primera');expect(s.component.resultsLoading()).toBe(true);
    s.catalog.getPage.mockReturnValue(of(response([article(2)])));s.component.search('segunda');pending.next(response([article(99)]));expect(s.component.items()[0].title).toBe('Artículo 2');
    s.catalog.getPage.mockReturnValue(pending);s.params.next({id:'anterior'});
    s.catalog.getPage.mockReturnValue(of(response([])));s.departments.getPublicById.mockReturnValue(of({...department,id:'actual'}));s.params.next({id:'actual'});pending.next(response([article(99)]));expect(s.component.departamento()?.id).toBe('actual');expect(s.component.items()).toEqual([]);
  });
  it('mantiene el observatorio visible ante errores del catálogo y permite reintentar', () => {
    const s=setup();s.catalog.getPage.mockReturnValue(throwError(() => new Error('offline')));s.component.search('consulta');s.fixture.detectChanges();expect(s.component.departamento()?.id).toBe('salud');expect(s.element.querySelector('[role="alert"]')?.textContent).toContain('publicaciones');
    s.catalog.getPage.mockReturnValue(of(response([article(1)])));s.component.retry();expect(s.component.publicationErrors()).toEqual([]);expect(s.component.visible()).toHaveLength(1);
  });
  it('abre PDF y reporte del contrato unificado con descripción y autores correctos', () => {
    const s=setup(response([article(1,{descripcion:'Resumen completo'})]));const pdf=s.component.items()[0];s.component.read(pdf);expect(s.dialog.open).toHaveBeenCalledWith(PublicationViewerComponent,expect.objectContaining({data:{item:pdf,departmentName:department.nombre,mode:'pdf'}}));s.component.openDetails(pdf);expect(pdf.description).toBe('Resumen completo');expect(pdf.authors).toBe('Ana Pérez');
    s.catalog.getPage.mockReturnValue(of(response([article(2,{tipo:'REPORTE',titulo:'Reporte unificado',descripcion:'Detalle de reporte',link_url:'https://app.powerbi.com/view?r=demo'})],1,{ARTICULO:1,REPORTE:1,LIBRO:0})));s.component.selectType('REPORTE');const report=s.component.items()[0];s.component.read(report);expect(report.title).toBe('Reporte unificado');expect(report.description).toBe('Detalle de reporte');expect(s.dialog.open).toHaveBeenCalledWith(PublicationViewerComponent,expect.objectContaining({data:{item:report,departmentName:department.nombre,mode:'report'}}));
  });
  it('no abre recursos bloqueados aunque la respuesta incluya enlaces', () => {
    const s=setup(response([article(1,{solo_suscriptores:true})]));const item=s.component.items()[0];expect(item.locked).toBe(true);expect(item.download_url).toBeNull();s.component.read(item);s.component.openDetails(item);expect(s.publications.openPdf).not.toHaveBeenCalled();expect(s.dialog.open).toHaveBeenCalledWith(SubscriberAccessDialogComponent,expect.anything());
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
