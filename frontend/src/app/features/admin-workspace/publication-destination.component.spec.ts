import { AuthService } from '@core/services/auth.service';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom, of, Subject, throwError } from 'rxjs';
import { DepartamentoService } from '@core/services/departamento.service';
import { PublicacionService } from '@core/services/publicacion.service';
import { SharePointAtlasImportDialogComponent } from '@features/public/public-atlas/sharepoint-atlas-import-dialog.component';
import { PublicationDestinationComponent } from './publication-destination.component';

describe('Creación de artículos, libros y reportes en el panel', () => {
  function setup(tipo = 'ARTICULO', departments = [{ id: 'salud', nombre: 'Salud' }, { id: 'laboral', nombre: 'Laboral' }], departamento = '') {
    const publications = { create: vi.fn(() => of({ id: 'nuevo', codigo: 'ART-0010', titulo: 'Guardado' } as any)) };
    const service = { getAll: vi.fn(() => of(departments)) };
    const dialog = { open: vi.fn(() => ({ afterClosed: () => of(false) })) };
    TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap({ tipo, departamento }) } } }, { provide: DepartamentoService, useValue: service }, { provide: PublicacionService, useValue: publications }, { provide: MatDialog, useValue: dialog }] });
    const fixture = TestBed.createComponent(PublicationDestinationComponent);fixture.detectChanges();
    const component = fixture.componentInstance;
    const open = () => { component.form.controls.departamento.setValue('laboral');component.openForm();fixture.detectChanges(); };
    const fill = () => component.publicationForm.patchValue({ titulo: ' Publicación de prueba ', fecha_publicacion: '2026-10-20', ...(tipo === 'REPORTE' ? { link_url: 'https://app.powerbi.com/view?r=test' } : {}) });
    return { fixture, component, publications, service, dialog, open, fill };
  }
  it.each(['ARTICULO', 'LIBRO', 'REPORTE'])('abre %s en la misma pantalla y conserva el observatorio', tipo => {
    const {fixture, component, open} = setup(tipo);expect(component.destination()).toBeNull();open();
    expect(component.destination()?.tipo).toBe(tipo);expect(component.destination()?.departamento.id).toBe('laboral');
    expect(component.form.disabled).toBe(true);expect(fixture.nativeElement.querySelector('.creation-grid.editor-open')).not.toBeNull();
    expect(fixture.nativeElement.querySelectorAll('form').length).toBe(2);
  });
  it.each(['ARTICULO','REPORTE','LIBRO'])('preselecciona el observatorio de origen y el tipo %s sin pedirlo de nuevo', tipo => {
    const {component,fixture}=setup(tipo,undefined,'salud');
    expect(component.form.controls.departamento.value).toBe('salud');
    const selected=fixture.nativeElement.querySelector('select[formControlName=departamento]') as HTMLSelectElement;
    expect(selected.value).toBe('salud');component.openForm();
    expect(component.destination()?.departamento.id).toBe('salud');expect(component.destination()?.tipo).toBe(tipo);
  });
  it('rechaza un observatorio ajeno a los destinos disponibles aunque venga en la URL', () => {
    const {component}=setup('ARTICULO',undefined,'no-disponible');
    expect(component.form.controls.departamento.value).toBe('');component.openForm();expect(component.destination()).toBeNull();
  });
  it('excluye Atlas y rechaza tipos y observatorios ajenos al selector', () => {
    const {fixture, component} = setup('ATLAS');
    expect(component.form.controls.tipo.value).toBe('ARTICULO');
    expect(fixture.nativeElement.querySelector('option[value=ATLAS]')).toBeNull();
    component.form.setValue({ tipo: 'ATLAS', departamento: 'laboral' });component.openForm();expect(component.destination()).toBeNull();
    component.form.setValue({ tipo: 'ARTICULO', departamento: 'no-existe' });component.openForm();expect(component.destination()).toBeNull();
  });
  it('permite reintentar una carga fallida y no abre mientras faltan destinos', () => {
    const {component, service} = setup();service.getAll.mockReturnValueOnce(throwError(() => new Error('offline')));component.load();
    expect(component.error()).toBe(true);component.openForm();expect(component.destination()).toBeNull();
    component.load();expect(component.error()).toBe(false);
  });
  it('valida los campos antes de avanzar, incluyendo título vacío y límites', () => {
    const {component, open, fill, publications} = setup();open();component.submit();expect(component.step()).toBe(1);
    expect(component.fieldError('titulo')).toBeTruthy();fill();component.publicationForm.controls.titulo.setValue('   ');component.goToStep(2);expect(component.step()).toBe(1);
    fill();component.publicationForm.patchValue({ descripcion: 'x'.repeat(3001), fuente: 'x'.repeat(256), link_url: 'javascript:alert(1)' });component.submit();
    expect(component.step()).toBe(1);expect(component.fieldError('descripcion')).toContain('3000');expect(publications.create).not.toHaveBeenCalled();
  });
  it.each(['ARTICULO', 'LIBRO'])('%s exige PDF, guarda metadatos opcionales y autores en el destino correcto', tipo => {
    const {component, open, fill, publications} = setup(tipo);open();fill();component.submit();component.submit();expect(publications.create).not.toHaveBeenCalled();expect(component.fileError()).toBeTruthy();
    component.autores.at(0).setValue(' Ana ');component.addAuthor();component.autores.at(1).setValue('Luis');component.addAuthor();
    component.publicationForm.patchValue({ estado: 'EN_REVISION', solo_suscriptores: true });
    const pdf = new File(['%PDF-1.4'], 'documento.pdf', { type: 'application/pdf' });component.selectFile(pdf);component.submit();
    expect(publications.create).toHaveBeenCalledOnce();const [id, data] = publications.create.mock.calls[0] as any;
    expect(id).toBe('laboral');expect(data.get('tipo')).toBe(tipo);expect(data.get('titulo')).toBe('Publicación de prueba');expect(data.getAll('autores[]')).toEqual(['Ana','Luis']);expect(data.get('estado')).toBe('EN_REVISION');expect(data.get('solo_suscriptores')).toBe('1');expect(data.get('archivo')).toBe(pdf);expect(data.has('atlas_categoria_id')).toBe(false);
    component.submit();expect(publications.create).toHaveBeenCalledOnce();expect(component.canLeave()).toBe(true);
  });
  it('un reporte exige URL y se guarda sin PDF', () => {
    const {component, open, fill, publications} = setup('REPORTE');open();fill();component.publicationForm.controls.link_url.setValue('');component.submit();expect(component.step()).toBe(1);
    component.publicationForm.controls.link_url.setValue('ftp://example.test/file');component.submit();expect(publications.create).not.toHaveBeenCalled();
    component.publicationForm.controls.link_url.setValue('https://app.powerbi.com/view?r=test');component.submit();component.submit();
    const data = (publications.create.mock.calls[0] as any)[1];expect(data.get('tipo')).toBe('REPORTE');expect(data.has('archivo')).toBe(false);expect(data.get('link_url')).toContain('app.powerbi.com');
  });
  it('rechaza archivos inválidos y grandes sin permitir que un reporte omita el error', () => {
    const {component, open, fill, publications} = setup('REPORTE');open();fill();component.submit();
    component.selectFile(new File(['csv'],'datos.csv',{type:'text/csv'}));component.submit();expect(publications.create).not.toHaveBeenCalled();expect(component.fileError()).toContain('PDF');
    const large=new File(['%PDF'],'grande.pdf',{type:'application/pdf'});Object.defineProperty(large,'size',{value:20*1024*1024+1});component.selectFile(large);expect(component.fileError()).toContain('20 MB');
    component.clearFile();component.submit();expect(publications.create).toHaveBeenCalledOnce();
  });
  it('acepta el límite exacto de 20 MB y permite quitar el archivo', () => {
    const {component, open} = setup();open();const pdf=new File(['%PDF'],'limite.pdf',{type:'application/x-pdf'});Object.defineProperty(pdf,'size',{value:20*1024*1024});component.selectFile(pdf);expect(component.selectedFile()).toBe(pdf);expect(component.fileError()).toBe('');component.clearFile();expect(component.selectedFile()).toBeNull();
  });
  it('bloquea envíos duplicados y salir durante el guardado', () => {
    const {component, open, fill, publications} = setup('REPORTE');open();fill();component.submit();const response=new Subject<any>();publications.create.mockReturnValue(response);component.submit();component.submit();component.requestClose();
    expect(publications.create).toHaveBeenCalledOnce();expect(component.saving()).toBe(true);expect(component.canLeave()).toBe(false);expect(component.destination()).not.toBeNull();response.next({id:'real',codigo:'REP-0012',titulo:'Reporte'});expect(component.savedPublication()?.codigo).toBe('REP-0012');
  });
  it('conserva el PDF y lo escrito al recibir errores del servidor y permite reintentar', () => {
    const {component, open, fill, publications} = setup();open();fill();component.selectFile(new File(['%PDF'],'archivo.pdf',{type:'application/pdf'}));component.submit();
    publications.create.mockReturnValueOnce(throwError(()=>({error:{errors:{titulo:['Título rechazado'],archivo:['PDF rechazado']}}})));component.submit();
    expect(component.saving()).toBe(false);expect(component.step()).toBe(1);expect(component.fieldError('titulo')).toBe('Título rechazado');expect(component.selectedFile()?.name).toBe('archivo.pdf');expect(component.savedPublication()).toBeNull();
    component.publicationForm.controls.titulo.setValue('Corregido');component.submit();component.submit();expect(component.savedPublication()).not.toBeNull();
  });
  it('conserva los datos ante una interrupción de red', () => {
    const {component, open, fill, publications} = setup('REPORTE');open();fill();component.submit();publications.create.mockReturnValueOnce(throwError(()=>new Error('offline')));component.submit();expect(component.serverError()).toContain('reintentar');expect(component.publicationForm.controls.titulo.value).toContain('prueba');
  });
  it('completa el flujo con los controles visibles y muestra el código recibido al guardar', () => {
    const {fixture, component, publications} = setup();
    const element = fixture.nativeElement as HTMLElement;
    const department = element.querySelector<HTMLSelectElement>('select[formControlName=departamento]')!;
    department.value = 'laboral'; department.dispatchEvent(new Event('change')); fixture.detectChanges();
    element.querySelector<HTMLButtonElement>('.form-footer button.primary')!.click(); fixture.detectChanges();
    for (const [name,value] of [['titulo','Artículo desde la interfaz'],['fecha_publicacion','2026-10-20']]) {
      const input = element.querySelector<HTMLInputElement>(`input[name=${name}]`)!;
      input.value = value; input.dispatchEvent(new Event('input'));
    }
    fixture.detectChanges();element.querySelector<HTMLButtonElement>('.editor-footer button.primary')!.click();fixture.detectChanges();
    expect(component.step()).toBe(2);
    const input = element.querySelector<HTMLInputElement>('input[type=file]')!;
    Object.defineProperty(input,'files',{value:[new File(['%PDF'],'interfaz.pdf',{type:'application/pdf'})],configurable:true});
    input.dispatchEvent(new Event('change'));fixture.detectChanges();
    element.querySelector<HTMLButtonElement>('.editor-footer button.primary')!.click();fixture.detectChanges();
    expect(publications.create).toHaveBeenCalledOnce();
    expect(element.querySelector('.success')?.textContent).toContain('ART-0010');
    expect(element.querySelector('.success a')?.getAttribute('href')).toBe('/admin/departamentos/laboral');
  });
  it('pide confirmar antes de cerrar datos sin guardar y permite seguir editando', async () => {
    const {component, open, fill, dialog} = setup();open();fill();component.publicationForm.markAsDirty();component.requestClose();expect(component.confirmClose()).toBe(true);expect(component.destination()).not.toBeNull();
    expect(await firstValueFrom(component.canLeave() as any)).toBe(false);expect(dialog.open).toHaveBeenCalledOnce();
    const event={preventDefault:vi.fn(),returnValue:undefined} as any;component.beforeUnload(event);expect(event.preventDefault).toHaveBeenCalledOnce();
    component.closeForm();expect(component.destination()).toBeNull();expect(component.form.enabled).toBe(true);expect(component.canLeave()).toBe(true);
  });
  it.each([['ARTICULO','articulos'],['LIBRO','libros'],['REPORTE','reportes']])('reutiliza el importador de %s con el destino %s', (tipo,target) => {
    const {component, fixture, open, dialog, publications} = setup(tipo);
    expect(fixture.nativeElement.querySelector('.destination-import')).toBeNull();
    open();
    expect(component.step()).toBe(1);
    expect(fixture.nativeElement.querySelectorAll('.sharepoint-action').length).toBe(1);
    fixture.nativeElement.querySelector('.destination-form .sharepoint-action').click();
    expect(dialog.open).toHaveBeenCalledWith(SharePointAtlasImportDialogComponent,expect.objectContaining({data:expect.objectContaining({context:'observatorio',target,departamentos:[expect.objectContaining({id:'laboral'})]})}));expect(component.importing()).toBe(false);
    expect(publications.create).not.toHaveBeenCalled();
    expect(component.publicationForm.controls.titulo.value).toBe('');
  });
  it('muestra el resultado junto al destino sin perder el borrador ni duplicar aperturas', () => {
    const {component, fixture, open, dialog, fill} = setup();open();fill();component.publicationForm.markAsDirty();
    component.selectFile(new File(['%PDF'],'borrador.pdf',{type:'application/pdf'}));
    const response=new Subject<any>();dialog.open.mockReturnValue({afterClosed:()=>response});
    component.importSharePoint();component.importSharePoint();fixture.detectChanges();
    expect(dialog.open).toHaveBeenCalledOnce();expect(component.importing()).toBe(true);
    expect(fixture.nativeElement.querySelector('.sharepoint-action').disabled).toBe(true);
    response.next({totals:{imported:2,duplicates:1,rejected:0,errors:0}});fixture.detectChanges();
    expect(component.importing()).toBe(false);expect(component.importFailed()).toBe(false);
    expect(fixture.nativeElement.querySelector('.destination-form .import-feedback').textContent).toContain('2 importados, 1 duplicados');
    expect(component.publicationForm.controls.titulo.value).toContain('prueba');expect(component.selectedFile()?.name).toBe('borrador.pdf');
    expect(component.hasUnsavedChanges()).toBe(true);
  });
  it.each([
    [{totals:{imported:0,duplicates:3,rejected:0,errors:0}},false,'3 duplicados'],
    [{totals:{imported:1,duplicates:0,rejected:1,errors:1}},true,'1 rechazados'],
  ])('distingue duplicados y resultados parciales de importación', (result,failed,message) => {
    const {component, open, dialog}=setup();open();dialog.open.mockReturnValue({afterClosed:()=>of(result as any)});
    component.importSharePoint();expect(component.importMessage()).toContain(message as string);expect(component.importFailed()).toBe(failed);
  });
  it('permite cancelar o reintentar cuando el importador se cierra con error', () => {
    const {component, open, dialog, fill}=setup();open();fill();
    component.importSharePoint();expect(component.importMessage()).toBe('');expect(component.importing()).toBe(false);
    dialog.open.mockReturnValueOnce({afterClosed:()=>throwError(()=>new Error('offline'))});component.importSharePoint();
    expect(component.importing()).toBe(false);expect(component.importMessage()).toContain('volver a intentarlo');expect(component.importFailed()).toBe(true);
    component.importSharePoint();expect(component.importMessage()).toBe('');expect(component.publicationForm.controls.titulo.value).toContain('prueba');
  });
});

beforeEach(() => TestBed.configureTestingModule({providers:[{provide:AuthService,useValue:{isAdmin:()=>true,isEditor:()=>false}}]}));
