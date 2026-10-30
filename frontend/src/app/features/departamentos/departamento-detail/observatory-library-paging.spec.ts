import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslateService } from '@ngx-translate/core';
import { Subject, of, throwError } from 'rxjs';
import { AuthService } from '@core/services/auth.service';
import { DepartamentoService } from '@core/services/departamento.service';
import { DatasetService } from '@core/services/dataset.service';
import { PublicacionService } from '@core/services/publicacion.service';
import { PublicationViewerService } from '@features/public/components/publication-viewer.service';
import { DepartamentoDetailComponent } from './departamento-detail.component';
import { ObservatoryWorkspaceFacade } from './observatory-workspace.facade';
import { PublicationEditorFacade } from './publication-editor.facade';
import { publicationPage } from '../../../testing/publication-page.fixture';

describe('Solicitudes remotas de la biblioteca de gestión',()=>{
 function setup(){
  const params=new Subject<any>();const service={libraryPage:vi.fn((_id:string,_filters:any)=>of(publicationPage([]))),libraryById:vi.fn(),canUpload:()=>of({can_upload:true})};
  TestBed.configureTestingModule({providers:[
   ObservatoryWorkspaceFacade, PublicationEditorFacade,
   {provide:ActivatedRoute,useValue:{params,snapshot:{queryParamMap:convertToParamMap({})},queryParamMap:new Subject()}},
   {provide:Router,useValue:{events:new Subject()}},{provide:DepartamentoService,useValue:{getById:(id:string)=>of({id,nombre:id,datasets:[]})}},
   {provide:DatasetService,useValue:{}},{provide:PublicacionService,useValue:service},{provide:PublicationViewerService,useValue:{}},
   {provide:AuthService,useValue:{isAdmin:()=>true,isEditor:()=>false,user:()=>({id:1}),canReviewObservatory:()=>true}},
   {provide:TranslateService,useValue:{instant:(s:string)=>s}},{provide:MatDialog,useValue:{}},{provide:MatSnackBar,useValue:{open:vi.fn()}}]});
  const component=TestBed.runInInjectionContext(()=>new DepartamentoDetailComponent());component.ngOnInit();params.next({id:'salud'});return{component,service,params};
 }
 it('envía tipo, búsqueda y página sin volver a cargar arrays completos',()=>{
  const {component,service}=setup();component.libraryFiltersChanged({tipo:'LIBRO',q:'Pérez',page:2});
  expect(service.libraryPage).toHaveBeenCalledWith('salud',{tipo:'LIBRO',q:'Pérez',page:3});
 });
 it('cancela búsquedas y observatorios anteriores y nunca muestra una respuesta tardía',()=>{
  const {component,service,params}=setup();const old=new Subject<any>(),fresh=new Subject<any>();
  service.libraryPage.mockReturnValueOnce(old as any).mockReturnValueOnce(fresh as any);
  component.libraryFiltersChanged({tipo:'ARTICULO',q:'antes',page:0});component.libraryFiltersChanged({tipo:'ARTICULO',q:'ahora',page:0});
  expect(old.observed).toBe(false);old.next(publicationPage([{id:'old'}]));expect(component.publicaciones()).toEqual([]);
  fresh.next(publicationPage([{id:'fresh',tipo:'ARTICULO'}]));expect(component.publicaciones()[0].id).toBe('fresh');
  params.next({id:'otro'});expect(fresh.observed).toBe(false);expect(component.publicaciones()).toEqual([]);
 });
 it('corrige una página vacía al disminuir el total y permite reintentar después de un error',()=>{
  const {component,service}=setup();component.libraryPage.set(2);component.loadPublicaciones('salud');
  expect(service.libraryPage).toHaveBeenLastCalledWith('salud',expect.objectContaining({page:1}));expect(component.libraryPage()).toBe(0);
  service.libraryPage.mockReturnValueOnce(throwError(()=>new Error('offline')));component.retryLibrary();expect(component.libraryError()).not.toBe('');
  component.retryLibrary();expect(component.libraryError()).toBe('');
 });
 it('usa el total de revisión y pide la página seleccionada de la cola',()=>{
  const {component,service}=setup();service.libraryPage.mockReturnValueOnce(of({...publicationPage([{id:'x',estado:'EN_REVISION'}]),meta:{total:45,per_page:20,current_page:1,last_page:3}}) as any);
  component.loadReviewPublicaciones('salud');expect(component.reviewCount).toBe(45);expect(component.reviewPublicaciones()).toHaveLength(1);
  component.changeReviewPage(1);expect(service.libraryPage).toHaveBeenCalledWith('salud',{estado:'EN_REVISION',page:2});
 });
});
