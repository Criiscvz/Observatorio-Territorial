import { publicationPage } from '../../../testing/publication-page.fixture';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { provideTranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { AuthService } from '@core/services/auth.service';
import { DepartamentoService } from '@core/services/departamento.service';
import { DatasetService } from '@core/services/dataset.service';
import { PublicacionService } from '@core/services/publicacion.service';
import { PublicationViewerService } from '@features/public/components/publication-viewer.service';
import { DepartamentoDetailComponent } from './departamento-detail.component';

describe('Biblioteca integrada en el observatorio', () => {
  function setup(extra:any={},editor=false) {
    const publication={capabilities:{can_view:true,can_edit:!editor,can_delete:!editor,can_review:!editor},id:'rep-1',tipo:'REPORTE',titulo:'Reporte de salud',estado:'PUBLICACION',codigo:'REP-1',fecha_publicacion:'2026-10-20',fuente:'ULEAM',autores:['Ana','Luis'],download_url:null,link_url:'https://app.powerbi.com/view?r=publico',...extra};
    const openPdf=vi.fn(()=>of(true)); const viewer={open:vi.fn()};
    TestBed.configureTestingModule({imports:[DepartamentoDetailComponent],providers:[
      provideRouter([]),provideTranslateService({fallbackLang:'es'}),
      {provide:ActivatedRoute,useValue:{snapshot:{queryParamMap:convertToParamMap({})},params:of({id:'salud'}),queryParamMap:of(convertToParamMap({}))}},
      {provide:DepartamentoService,useValue:{getById:()=>of({id:'salud',nombre:'Observatorio de la Salud',publico:true,datasets:[{id:'antiguo',nombre:'Datos antiguos'}]})}},
      {provide:DatasetService,useValue:{}},
      {provide:PublicacionService,useValue:{libraryPage:(_id:string,filters:any)=>of(publicationPage([publication],filters)),canUpload:()=>of({can_upload:true}),openPdf}},
      {provide:AuthService,useValue:{isAdmin:()=>!editor,isEditor:()=>editor,canReviewObservatory:()=>!editor,user:()=>({id:1}),hasRoleInDepartamento:()=>editor}},
      {provide:PublicationViewerService,useValue:viewer},
      {provide:MatDialog,useValue:{}},{provide:MatSnackBar,useValue:{open:vi.fn()}},
    ]});
    const fixture=TestBed.createComponent(DepartamentoDetailComponent);fixture.detectChanges();
    const element=fixture.nativeElement as HTMLElement;
    const tabIndex={ARTICULO:0,REPORTE:1,LIBRO:2}[publication.tipo as 'ARTICULO'|'REPORTE'|'LIBRO'];
    if(tabIndex!==undefined) element.querySelectorAll<HTMLButtonElement>('[role=tab]')[tabIndex].click();
    fixture.detectChanges();
    return {fixture,element,publication,openPdf,viewer};
  }
  it('conserva el único acceso de creación y abre el reporte en el visor sin pestañas nuevas',async()=>{
    const {fixture,element,publication,openPdf,viewer}=setup();await fixture.whenStable();
    expect(element.querySelectorAll('.observatory-create')).toHaveLength(1);
    expect(element.querySelector('a[href*="/admin/datasets"]')).toBeNull();
    expect(element.textContent).not.toContain('Importar Conjunto');expect(element.querySelector('.datasets-section')).toBeNull();
    expect(element.querySelectorAll('[role=tab]')).toHaveLength(3);expect(element.querySelector('.library-detail')).toBeNull();
    const url=new URL(element.querySelector<HTMLAnchorElement>('.observatory-create')!.getAttribute('href')!,'http://localhost');
    expect(url.pathname).toBe('/admin/publicaciones/nueva');expect(url.searchParams.get('departamento')).toBe('salud');expect(url.searchParams.get('tipo')).toBe('REPORTE');
    const external=vi.spyOn(window,'open').mockReturnValue(null);
    try{
      element.querySelector<HTMLButtonElement>('.detail-toggle')!.click();fixture.detectChanges();
      const buttons=element.querySelectorAll<HTMLButtonElement>('.resource-actions button');expect(buttons).toHaveLength(1);
      expect(buttons[0].textContent).toContain('Ver reporte');buttons[0].click();
      expect(viewer.open).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({id:publication.id,title:publication.titulo,description:'',authors:'Ana, Luis',reportUrl:publication.link_url,locked:false}),'Observatorio de la Salud','report');
      expect(openPdf).not.toHaveBeenCalled();expect(external).not.toHaveBeenCalled();
    }finally{external.mockRestore();}
  });
  it.each(['ARTICULO','LIBRO'])('abre %s con el único botón Ver PDF y conserva los datos completos',tipo=>{
    const {element,fixture,viewer,publication}=setup({tipo,titulo:'Documento de lectura',descripcion:'Descripción completa',download_url:'/api/departamentos/publicaciones/doc/download',link_url:'https://www.uleam.edu.ec/fuente'});
    element.querySelector<HTMLButtonElement>('.detail-toggle')!.click();fixture.detectChanges();
    const buttons=element.querySelectorAll<HTMLButtonElement>('.resource-actions button');expect(buttons).toHaveLength(1);expect(buttons[0].textContent).toContain('Ver PDF');buttons[0].click();
    expect(viewer.open).toHaveBeenCalledWith(expect.objectContaining({type:tipo,title:'Documento de lectura',description:'Descripción completa',authors:'Ana, Luis',download_url:publication.download_url,sourceUrl:publication.link_url,reportUrl:null}),'Observatorio de la Salud','pdf');
  });
  it('permite al editor leer su PDF en revisión sin perder el contexto de permisos',()=>{
    const url='/api/departamentos/publicaciones/libro/download?context=management';
    const {element,fixture,viewer}=setup({tipo:'LIBRO',creado_por:1,estado:'EN_REVISION',solo_suscriptores:true,bloqueado:false,download_url:url},true);
    element.querySelector<HTMLButtonElement>('.detail-toggle')!.click();fixture.detectChanges();element.querySelector<HTMLButtonElement>('.resource-actions button')!.click();
    expect(viewer.open).toHaveBeenCalledWith(expect.objectContaining({locked:false,download_url:url}),'Observatorio de la Salud','pdf');
  });
  it('muestra Ver reporte y usa el PDF cuando el reporte importado solo tiene un archivo',()=>{
    const {element,fixture,viewer}=setup({download_url:'/api/departamentos/publicaciones/report/download',sharepoint_file_id:'pdf',sharepoint_url:'https://tenant.sharepoint.com/report.pdf',link_url:'https://tenant.sharepoint.com/report.pdf'});
    element.querySelector<HTMLButtonElement>('.detail-toggle')!.click();fixture.detectChanges();const button=element.querySelector<HTMLButtonElement>('.resource-actions button')!;
    expect(button.textContent).toContain('Ver reporte');button.click();expect(viewer.open).toHaveBeenCalledWith(expect.objectContaining({reportUrl:null}),'Observatorio de la Salud','pdf');
  });
  it('mantiene bloqueados los recursos no autorizados aunque se invoque el controlador directamente',()=>{
    const {fixture,element,viewer,publication}=setup({tipo:'LIBRO',bloqueado:true,download_url:'/api/private/download'});
    element.querySelector<HTMLButtonElement>('.detail-toggle')!.click();fixture.detectChanges();expect(element.querySelector<HTMLButtonElement>('.resource-actions button')!.disabled).toBe(true);
    fixture.componentInstance.viewLibraryPublication(publication);expect(viewer.open).not.toHaveBeenCalled();
  });
});
