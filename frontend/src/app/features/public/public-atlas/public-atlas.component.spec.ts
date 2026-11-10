import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { ViewportScroller } from '@angular/common';
import { MatDialog } from '@angular/material/dialog';
import { of, Subject, throwError } from 'rxjs';
import { AtlasCategoriaService } from '@core/services/atlas-categoria.service';
import { ObservatorioPublicacion } from '@core/models/publicacion/publicacion.interface';
import { PublicacionService } from '@core/services/publicacion.service';
import { PublicationViewerService } from '../components/publication-viewer.service';
import { PublicAtlasComponent } from './public-atlas.component';
import { PublicPublicationDetailsComponent } from '../components/public-publication-details.component';
import { publicationPage } from '../../../testing/publication-page.fixture';

describe('Atlas público con biblioteca remota',()=>{
 const category={id:'salud',nombre:'Salud',descripcion:'Descripción territorial',publico:true,icono:'home',publicaciones_total:25};
 const publication=(extra:Partial<ObservatorioPublicacion>={}):ObservatorioPublicacion=>({id:'selected',tipo:'ATLAS',estado:'PUBLICACION',solo_suscriptores:false,
  titulo:'Atención médica',codigo:'ATL-0010',fuente:'ULEAM',fecha_publicacion:'2026-10-20',created_at:'',updated_at:'',atlas_categoria_id:'salud',
  link_url:'https://app.powerbi.com/view?r=atlas-publico',...extra});
 let items:ObservatorioPublicacion[],categories:any,publications:any,viewer:any,dialog:any,fixture:any,component:PublicAtlasComponent;
 const element=()=>fixture.nativeElement as HTMLElement;
 beforeEach(()=>{
  items=Array.from({length:25},(_,i)=>publication({id:'a'+i,titulo:'Atlas '+i,codigo:'ATL-'+i}));
  categories={directory:vi.fn((_public:boolean,q:string)=>of({data:q?[category]:[category,...Array.from({length:6},(_,i)=>({...category,id:'c'+i,nombre:'Categoría '+i,publicaciones_total:0}))],unassigned_total:0}))};
  publications={atlasPage:vi.fn((_category:string,page:number,q:string)=>of(publicationPage(items,{page,q})))};
  viewer={open:vi.fn()};dialog={open:vi.fn()};
  TestBed.configureTestingModule({providers:[{provide:AtlasCategoriaService,useValue:categories},{provide:PublicacionService,useValue:publications},
   {provide:PublicationViewerService,useValue:viewer},{provide:MatDialog,useValue:dialog},{provide:ViewportScroller,useValue:{scrollToPosition:vi.fn()}}]});
  fixture=TestBed.createComponent(PublicAtlasComponent);component=fixture.componentInstance;fixture.detectChanges();
 });
 it('carga solo resúmenes, cinco categorías por página y conserva Explorar',()=>{
  expect(categories.directory).toHaveBeenCalledWith(true,'');expect(publications.atlasPage).not.toHaveBeenCalled();
  expect(element().querySelectorAll('.directory-row')).toHaveLength(5);expect(element().textContent).toContain('25 publicaciones');
  expect(element().querySelector('.category-icon')?.textContent).toContain('home');expect(element().querySelector('.explore-category')?.textContent).toContain('Explorar');
  component.changePage(1);fixture.detectChanges();expect(element().querySelectorAll('.directory-row')).toHaveLength(2);
  component.search('atencion');expect(categories.directory).toHaveBeenLastCalledWith(true,'atencion');expect(component.currentPage()).toBe(0);
 });
 it('solicita las páginas y búsqueda al servidor y conserva el filtro del directorio',()=>{
  component.search('salud');component.openCategory(component.entries()[0]);fixture.detectChanges();
  expect(publications.atlasPage).toHaveBeenLastCalledWith('salud',1,'');expect(element().querySelectorAll('.atlas-library-row')).toHaveLength(20);
  component.changeLibraryPage(1);fixture.detectChanges();expect(publications.atlasPage).toHaveBeenLastCalledWith('salud',2,'');
  expect(element().querySelectorAll('.atlas-library-row')).toHaveLength(5);expect(element().textContent).toContain('21–25 de 25 publicaciones');
  component.searchLibrary('ATL-24');fixture.detectChanges();expect(publications.atlasPage).toHaveBeenLastCalledWith('salud',1,'ATL-24');
  expect(element().querySelectorAll('.atlas-library-row')).toHaveLength(1);component.backToCategories();expect(component.query()).toBe('salud');expect(component.atlas()).toEqual([]);
 });
 it('cancela respuestas obsoletas de búsqueda, regreso y destrucción',()=>{
  const first=new Subject<any>(),second=new Subject<any>();publications.atlasPage.mockReturnValueOnce(first).mockReturnValueOnce(second);
  component.openCategory(component.entries()[0]);component.searchLibrary('nuevo');expect(first.observed).toBe(false);
  first.next(publicationPage([publication({titulo:'Obsoleto'})]));expect(component.atlas()).toEqual([]);
  second.next(publicationPage([publication({titulo:'Vigente'})]));expect(component.atlas()[0].titulo).toBe('Vigente');
  component.backToCategories();expect(second.observed).toBe(false);
  const pending=new Subject<any>();categories.directory.mockReturnValueOnce(pending);component.loadData();fixture.destroy();expect(pending.observed).toBe(false);
 });
 it('corrige una página que desaparece después de eliminar',()=>{
  component.openCategory(component.entries()[0]);items=[publication()];component.changeLibraryPage(1);
  expect(publications.atlasPage).toHaveBeenLastCalledWith('salud',1,'');expect(component.currentLibraryPage()).toBe(0);expect(component.libraryTotal()).toBe(1);
 });
 it('distingue errores de listas vacías y permite reintentar',()=>{
  categories.directory.mockReturnValueOnce(throwError(()=>new Error('offline')));component.loadData();fixture.detectChanges();expect(component.loadError()).toBe(true);
  element().querySelector<HTMLButtonElement>('[role=alert] button')!.click();fixture.detectChanges();expect(component.loadError()).toBe(false);
  publications.atlasPage.mockReturnValueOnce(throwError(()=>new Error('offline')));component.openCategory(component.entries()[0]);fixture.detectChanges();
  expect(element().querySelector('[role=alert]')?.textContent).toContain('No se pudo cargar');expect(component.atlas()).toEqual([]);
  items=[];component.retryLibrary();fixture.detectChanges();expect(component.libraryError()).toBe(false);expect(element().textContent).toContain('Aún no hay Atlas publicados');
 });
 it('abre ficha y visor Power BI con fecha y autores vigentes',()=>{
  items=[publication({autores:['Ana López','Luis Vera']})];component.openCategory(component.entries()[0]);fixture.detectChanges();
  expect(element().querySelector('.publication-authors')?.textContent).toContain('Ana López, Luis Vera');expect(element().querySelector('.publication-date')?.textContent).toContain('20/10/2026');
  element().querySelector<HTMLButtonElement>('.details-button')!.click();expect(dialog.open).toHaveBeenCalledWith(PublicPublicationDetailsComponent,expect.objectContaining({data:expect.objectContaining({context:'atlas'})}));
  const external=vi.spyOn(window,'open').mockReturnValue(null);element().querySelector<HTMLButtonElement>('.view-atlas')!.click();
  expect(viewer.open).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({id:'selected',authors:'Ana López, Luis Vera',reportUrl:'https://app.powerbi.com/view?r=atlas-publico'}),'Salud','report','atlas');
  expect(external).not.toHaveBeenCalled();external.mockRestore();
 });
 it.each(['javascript:alert(1)','https://example.test/atlas','https://app.powerbi.com.evil.test/view?r=x'])('no integra enlaces incompatibles: %s',link_url=>{
  items=[publication({link_url})];component.openCategory(component.entries()[0]);fixture.detectChanges();expect(element().querySelector<HTMLButtonElement>('.view-atlas')!.disabled).toBe(true);
  component.openAtlas(items[0]);expect(viewer.open).not.toHaveBeenCalled();
 });
 it('conserva PDF y evita abrir recursos restringidos u obsoletos',()=>{
  items=[publication({link_url:null,download_url:'/api/pdf',bloqueado:false,solo_suscriptores:true})];component.openCategory(component.entries()[0]);component.openAtlas(items[0]);
  expect(viewer.open).toHaveBeenCalledWith(expect.objectContaining({download_url:'/api/pdf'}),'Salud','pdf','atlas');viewer.open.mockClear();
  const old=items[0];items=[{...old,bloqueado:true}];component.retryLibrary();fixture.detectChanges();expect(element().querySelector<HTMLButtonElement>('.view-atlas')!.disabled).toBe(true);
  component.openDetails(old);component.openAtlas(old);expect(viewer.open).not.toHaveBeenCalled();expect(dialog.open).not.toHaveBeenCalled();
  component.backToCategories();component.openAtlas(old);expect(viewer.open).not.toHaveBeenCalled();
 });
 it('no llama APIs durante SSR',()=>{
  fixture.destroy();TestBed.resetTestingModule();categories.directory.mockClear();
  TestBed.configureTestingModule({providers:[{provide:PLATFORM_ID,useValue:'server'},{provide:AtlasCategoriaService,useValue:categories},{provide:PublicacionService,useValue:publications},{provide:PublicationViewerService,useValue:viewer},{provide:MatDialog,useValue:dialog}]});
  const server=TestBed.createComponent(PublicAtlasComponent);server.detectChanges();expect(categories.directory).not.toHaveBeenCalled();server.destroy();
 });
});
