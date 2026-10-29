import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { PublicPublicationDetailsComponent } from './public-publication-details.component';
import { PublicationViewerService } from './publication-viewer.service';
import { PublicLibraryPublication } from './public-library-publication';

describe('Detalles y visor de Atlas', () => {
  const item: PublicLibraryPublication = {
    id:'atlas',type:'REPORTE',title:'Atlas de Economía',code:'ATL-0012',date:'2026-10-23',authors:'ULEAM',
    description:'Indicadores económicos',source:'ULEAM',sourceUrl:null,
    reportUrl:'https://app.powerbi.com/view?r=publico',download_url:null,sharepoint_url:null,locked:false,
  };
  it('abre el visor desde detalles con contexto Atlas y sin avisar de un PDF que no se requiere', () => {
    const viewer={open:vi.fn()};
    TestBed.configureTestingModule({providers:[
      {provide:MAT_DIALOG_DATA,useValue:{item,departmentName:'Economía',context:'atlas'}},
      {provide:PublicationViewerService,useValue:viewer},
    ]});
    const fixture=TestBed.createComponent(PublicPublicationDetailsComponent);fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.eyebrow').textContent).toContain('Atlas');
    expect(fixture.nativeElement.querySelector('.missing-resource')).toBeNull();
    const button=fixture.nativeElement.querySelector('.resource-actions button') as HTMLButtonElement;
    expect(button.textContent).toContain('Ver Atlas');button.click();
    expect(viewer.open).toHaveBeenCalledExactlyOnceWith(item,'Economía','report','atlas');
  });
  it('conserva la acción y el contexto de los reportes de Observatorios', () => {
    const viewer={open:vi.fn()};
    TestBed.configureTestingModule({providers:[
      {provide:MAT_DIALOG_DATA,useValue:{item,departmentName:'Observatorio de la Salud'}},
      {provide:PublicationViewerService,useValue:viewer},
    ]});
    const fixture=TestBed.createComponent(PublicPublicationDetailsComponent);fixture.detectChanges();
    const button=fixture.nativeElement.querySelector('.resource-actions button') as HTMLButtonElement;
    expect(button.textContent).toContain('Ver reporte');button.click();
    expect(viewer.open).toHaveBeenCalledExactlyOnceWith(item,'Observatorio de la Salud','report');
  });
});
