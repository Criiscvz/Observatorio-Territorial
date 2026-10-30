import { publicationPage } from '../../../testing/publication-page.fixture';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslateService } from '@ngx-translate/core';
import { Subject, of } from 'rxjs';
import { AuthService } from '@core/services/auth.service';
import { DepartamentoService } from '@core/services/departamento.service';
import { DatasetService } from '@core/services/dataset.service';
import { PublicacionService } from '@core/services/publicacion.service';
import { DepartamentoDetailComponent } from './departamento-detail.component';

describe('Accesos operativos a los formularios existentes', () => {
  function setup(query: Record<string, string>, admin = true, editor = false) {
    const publication = {capabilities:{can_view:true,can_edit:admin||editor,can_delete:admin||editor,can_review:admin},id:'publication',tipo:'ARTICULO',titulo:'Pendiente',estado:'EN_REVISION',fecha_publicacion:'2026-10-20',autores:[],creado_por:1};
    const records=[publication,{...publication,id:'other',creado_por:2,estado:'PUBLICACION'},{...publication,id:'atlas',tipo:'ATLAS'}];
    TestBed.configureTestingModule({providers:[
      {provide:ActivatedRoute,useValue:{snapshot:{queryParamMap:convertToParamMap(query)},params:of({id:'salud'}),queryParamMap:new Subject()}},
      {provide:Router,useValue:{events:new Subject()}},
      {provide:DepartamentoService,useValue:{getById:()=>of({id:'salud',nombre:'Salud',datasets:[]})}},
      {provide:DatasetService,useValue:{}},
      {provide:PublicacionService,useValue:{libraryPage:(_id:string,filters:any)=>of(publicationPage(records.filter(x=>x.tipo!=='ATLAS'&&(!editor||x.creado_por===1)),filters)),libraryById:(_id:string,id:string)=>of(records.find(x=>x.id===id)),canUpload:()=>of({can_upload:admin||editor})}},
      {provide:AuthService,useValue:{isAdmin:()=>admin,isEditor:()=>editor,canReviewObservatory:()=>admin,user:()=>({id:1}),hasRoleInDepartamento:()=>editor}},
      {provide:TranslateService,useValue:{instant:(value:string)=>value}},
      {provide:MatDialog,useValue:{}},{provide:MatSnackBar,useValue:{}},
    ]});
    const component=TestBed.runInInjectionContext(()=>new DepartamentoDetailComponent());
    component.ngOnInit();return component;
  }
  it.each(['ARTICULO','REPORTE','LIBRO'])('abre directamente el formulario de %s',tipo=>{
    const component=setup({nuevo:tipo});
    expect(component.showPublicationForm()).toBe(true);
    expect(component.publicationForm.controls.tipo.value).toBe(tipo);
    if(tipo==='REPORTE') expect(component.publicationForm.controls.link_url.hasError('required')).toBe(true);
    component.publicationForm.controls.titulo.setValue('Trabajo en curso');
    component.loadPublicaciones('salud');
    expect(component.publicationForm.controls.titulo.value).toBe('Trabajo en curso');
  });
  it('abre la publicación elegida para revisar sin crear una publicación nueva',()=>{
    const component=setup({editar_publicacion:'publication'});
    expect(component.editingPublication()?.id).toBe('publication');
    expect(component.publicationForm.controls.titulo.value).toBe('Pendiente');
    expect(component.publicationForm.controls.estado.value).toBe('EN_REVISION');
  });
  it('no habilita el formulario a usuarios sin permisos por cambiar la URL',()=>{
    expect(setup({nuevo:'ARTICULO'},false).showPublicationForm()).toBe(false);
  });
  it('la biblioteca y la revisión del editor excluyen otros autores y Atlas',()=>{
    const component=setup({},false,true);
    expect(component.publicaciones().map(x=>x.id)).toEqual(['publication']);
    component.showReviewPanel.set(true);component.loadReviewPublicaciones('salud');
    expect(component.reviewPublicaciones().map(x=>x.id)).toEqual(['publication']);
    component.openPublicationForm('ATLAS');expect(component.showPublicationForm()).toBe(false);
  });
});
