import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { of, Subject, throwError } from 'rxjs';
import { AtlasCategoriaService } from '@core/services/atlas-categoria.service';
import { PublicacionService } from '@core/services/publicacion.service';
import { SharePointAtlasImportDialogComponent } from './sharepoint-atlas-import-dialog.component';

describe('Importador de SharePoint para publicaciones del observatorio',()=>{
  const file={id:'pdf-1',name:'Investigación.pdf',type:'pdf',is_pdf:true,selectable:true,size:1024} as any;
  const folder={id:'folder-1',name:'Carpeta',type:'folder',is_pdf:false,selectable:false} as any;
  const browser={current:{id:'root',name:'Carpeta raíz'},root:{id:'root',name:'Carpeta raíz'},parent:null,breadcrumbs:[],items:[file,folder]} as any;
  const result={data:{imported:[],duplicates:[],rejected:[],errors:[]},totals:{imported:1,duplicates:0,rejected:0,errors:0}} as any;
  function setup(target='articulos'){
    const service={browseSharePointFolder:vi.fn(()=>of(browser)),importManySharePoint:vi.fn(()=>of(result)),browseGlobalAtlasSharePointFolder:vi.fn(),importManyGlobalAtlasSharePoint:vi.fn()};
    const dialog={disableClose:false,close:vi.fn()};const categories={list:vi.fn()};
    TestBed.configureTestingModule({providers:[{provide:PublicacionService,useValue:service},{provide:AtlasCategoriaService,useValue:categories},{provide:MatDialogRef,useValue:dialog},{provide:MAT_DIALOG_DATA,useValue:{departamentos:[{id:'salud',nombre:'Salud'}],target,context:'observatorio'}}]});
    const component=TestBed.runInInjectionContext(()=>new SharePointAtlasImportDialogComponent());
    return {component,service,dialog,categories};
  }
  it.each(['articulos','libros','reportes'])('importa PDFs como %s en el destino ya seleccionado',target=>{
    const {component,service,dialog,categories}=setup(target);
    expect(service.browseSharePointFolder).toHaveBeenCalledExactlyOnceWith('salud',target,null);
    expect(categories.list).not.toHaveBeenCalled();component.toggleFile(file,true);component.importSelected();
    expect(service.importManySharePoint).toHaveBeenCalledExactlyOnceWith('salud',target,['pdf-1']);
    expect(service.importManyGlobalAtlasSharePoint).not.toHaveBeenCalled();expect(dialog.close).toHaveBeenCalledExactlyOnceWith(result);
  });
  it('identifica correctamente la biblioteca de origen de libros',()=>{
    const {component}=setup('libros');expect(component.rootLabel).toBe('Atlas');expect(component.destinationLabel).toBe('Libros PDF');
  });
  it('solo selecciona PDFs y evita enviar una selección vacía',()=>{
    const {component,service}=setup();component.importSelected();expect(service.importManySharePoint).not.toHaveBeenCalled();
    component.toggleFile(folder,true);expect(component.selectedCount()).toBe(0);component.toggleVisible(true);expect(component.selectedCount()).toBe(1);expect(component.allVisibleSelected()).toBe(true);component.toggleVisible(false);expect(component.selectedCount()).toBe(0);
  });
  it('navega entre carpetas conservando los PDFs seleccionados',()=>{
    const {component,service}=setup();component.toggleFile(file,true);component.openFolder(folder);
    expect(service.browseSharePointFolder).toHaveBeenLastCalledWith('salud','articulos','folder-1');expect(component.selectedCount()).toBe(1);
    component.loadFolder(null);expect(service.browseSharePointFolder).toHaveBeenCalledTimes(2);
  });
  it('no duplica importaciones y no permite cerrar durante el envío',()=>{
    const {component,service,dialog}=setup();const response=new Subject<any>();service.importManySharePoint.mockReturnValue(response);component.toggleFile(file,true);component.importSelected();component.importSelected();component.cancel();
    expect(service.importManySharePoint).toHaveBeenCalledOnce();expect(dialog.disableClose).toBe(true);expect(dialog.close).not.toHaveBeenCalled();response.next(result);expect(dialog.close).toHaveBeenCalledWith(result);
  });
  it('conserva la selección y permite reintentar ante errores de importación',()=>{
    const {component,service,dialog}=setup();service.importManySharePoint.mockReturnValueOnce(throwError(()=>({status:422})));component.toggleFile(file,true);component.importSelected();
    expect(component.error()).toContain('ya no están disponibles');expect(component.selectedCount()).toBe(1);expect(component.importing()).toBe(false);expect(dialog.disableClose).toBe(false);component.importSelected();expect(dialog.close).toHaveBeenCalledWith(result);
  });
  it('muestra un error de conexión recuperable al consultar SharePoint',()=>{
    const {component,service}=setup();service.browseSharePointFolder.mockReturnValueOnce(throwError(()=>new Error('offline')));component.loadFolder('otra');
    expect(component.error()).toContain('No se pudo cargar');component.loadFolder('otra');expect(component.error()).toBeNull();expect(component.loading()).toBe(false);
  });
  it('devuelve el resumen de duplicados y fallos sin presentarlos como importaciones nuevas',()=>{
    const {component,service,dialog}=setup();const mixed={...result,totals:{imported:0,duplicates:1,rejected:1,errors:1}};service.importManySharePoint.mockReturnValueOnce(of(mixed));component.toggleFile(file,true);component.importSelected();expect(dialog.close).toHaveBeenCalledWith(mixed);expect(component.resultMessage(mixed)).toContain('0 importados · 1 duplicados · 1 rechazados · 1 errores');
  });
});
