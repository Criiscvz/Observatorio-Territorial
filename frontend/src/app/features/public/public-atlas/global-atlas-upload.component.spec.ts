import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { of, Subject, throwError } from 'rxjs';
import { AtlasCategoriaService } from '@core/services/atlas-categoria.service';
import { PublicacionService } from '@core/services/publicacion.service';
import { GlobalAtlasUploadComponent } from './global-atlas-upload.component';

describe('Atlas upload and replacement flow', () => {
  const category = { id: 'ambiente', nombre: 'Ambiente', descripcion: null };
  const atlas = {
    id: 'atlas-1',
    atlas_categoria_id: category.id,
    titulo: 'Atlas ambiental',
    fecha_publicacion: '2026-10-07',
    estado: 'PUBLICACION',
    solo_suscriptores: false,
    descripcion: 'Descripción original',
    autores: ['ULEAM'],
    fuente: 'ULEAM',
    nombre_archivo_original: 'original.pdf',
    download_url: '/api/atlas-1/pdf',
  } as any;
  let component: GlobalAtlasUploadComponent;
  let publications: any;
  let route: any;
  let router: any;
  let dialog: any;

  beforeEach(() => {
    publications = {
      getGlobalAtlasById: vi.fn(() => of(atlas)),
      createGlobalAtlas: vi.fn(() => of(atlas)),
      update: vi.fn(() => of(atlas)),
      openPdf: vi.fn(() => of(true)),
    };
    route = { snapshot: { queryParamMap: convertToParamMap({ categoria: category.id }) } };
    router = { navigate: vi.fn() };
    dialog = { open: vi.fn(() => ({ afterClosed: () => of(null) })) };
    TestBed.configureTestingModule({
      providers: [
        { provide: ActivatedRoute, useValue: route },
        { provide: Router, useValue: router },
        { provide: MatDialog, useValue: dialog },
        { provide: MatSnackBar, useValue: { open: vi.fn() } },
        { provide: AtlasCategoriaService, useValue: { list: () => of([category]) } },
        { provide: PublicacionService, useValue: publications },
      ],
    });
    component = TestBed.runInInjectionContext(() => new GlobalAtlasUploadComponent());
  });

  function fillForm(): void {
    component.form.patchValue({
      titulo: atlas.titulo,
      fecha_publicacion: atlas.fecha_publicacion,
      descripcion: atlas.descripcion,
    });
  }
  function selectFile(file: File): HTMLInputElement {
    const input = { files: [file], value: file.name } as unknown as HTMLInputElement;
    component.onFileSelected({ target: input } as unknown as Event);
    return input;
  }
  function startEditing(): void {
    route.snapshot.queryParamMap = convertToParamMap({ editar: atlas.id, categoria: 'otra' });
    component.ngOnInit();
  }

  it('preselects the category when arriving from its file list', () => {
    component.ngOnInit();
    expect(component.form.controls.atlas_categoria_id.value).toBe(category.id);
  });
  it('requires a PDF for a new Atlas and leaves the form available for correction', () => {
    component.ngOnInit();
    fillForm();
    component.save();
    expect(component.fileError()).toContain('seleccionar el PDF');
    expect(publications.createGlobalAtlas).not.toHaveBeenCalled();
    expect(component.saving()).toBe(false);
  });
  it('submits one creation request with file, category and subscriber flag', () => {
    component.ngOnInit();
    fillForm();
    component.form.controls.solo_suscriptores.setValue(true);
    const file = new File(['%PDF-1.4'], 'atlas.pdf', { type: 'application/pdf' });
    selectFile(file);
    const pending = new Subject<any>();
    publications.createGlobalAtlas.mockReturnValue(pending);
    component.save();
    component.save();
    expect(publications.createGlobalAtlas).toHaveBeenCalledTimes(1);
    const data = publications.createGlobalAtlas.mock.calls[0][0] as FormData;
    expect(data.get('archivo')).toBe(file);
    expect(data.get('atlas_categoria_id')).toBe(category.id);
    expect(data.get('solo_suscriptores')).toBe('1');
    pending.next(atlas);
    expect(router.navigate).toHaveBeenCalledWith(['/admin/atlas'], {
      queryParams: { categoria: category.id },
    });
  });
  it('keeps the current PDF and original category when editing metadata only', () => {
    startEditing();
    component.form.controls.titulo.setValue('Título actualizado');
    component.save();
    expect(publications.createGlobalAtlas).not.toHaveBeenCalled();
    const [id, data] = publications.update.mock.calls[0] as [string, FormData];
    expect(id).toBe(atlas.id);
    expect(data.has('archivo')).toBe(false);
    expect(data.get('atlas_categoria_id')).toBe(category.id);
    expect(data.get('autores')).toBe('ULEAM');
  });
  it('allows clearing the replacement without deleting or losing the current document', () => {
    startEditing();
    const input = selectFile(new File(['%PDF'], 'nuevo.pdf', { type: 'application/pdf' }));
    component.clearSelectedFile(input);
    component.save();
    expect(input.value).toBe('');
    expect(component.selectedFile()).toBeNull();
    expect(component.editingAtlas()).toBe(atlas);
    expect(publications.update.mock.calls[0][1].has('archivo')).toBe(false);
  });
  it('sends a selected replacement with the same publication id', () => {
    startEditing();
    const file = new File(['%PDF'], 'nuevo.pdf', { type: 'application/pdf' });
    selectFile(file);
    component.save();
    expect(publications.update.mock.calls[0][0]).toBe(atlas.id);
    expect(publications.update.mock.calls[0][1].get('archivo')).toBe(file);
  });
  it('rejects invalid formats and PDFs larger than 20 MB', () => {
    const invalid = selectFile(new File(['text'], 'archivo.txt', { type: 'text/plain' }));
    expect(component.fileError()).toContain('Solo se permiten');
    expect(invalid.value).toBe('');
    const large = new File(['%PDF'], 'grande.pdf', { type: 'application/pdf' });
    Object.defineProperty(large, 'size', { value: 20 * 1024 * 1024 + 1 });
    selectFile(large);
    expect(component.fileError()).toContain('20 MB');
    expect(component.selectedFile()).toBeNull();
  });
  it('keeps the PDF and entered data after a storage failure, allowing retry', () => {
    component.ngOnInit();
    fillForm();
    const file = new File(['%PDF'], 'atlas.pdf', { type: 'application/pdf' });
    selectFile(file);
    publications.createGlobalAtlas.mockReturnValue(
      throwError(() => ({ error: { message: 'Almacenamiento no disponible' } })),
    );
    component.save();
    expect(component.serverError()).toBe('Almacenamiento no disponible');
    expect(component.selectedFile()).toBe(file);
    expect(component.form.controls.titulo.value).toBe(atlas.titulo);
    expect(component.saving()).toBe(false);
    expect(router.navigate).not.toHaveBeenCalled();
  });
  it('retains the SharePoint import context and selected category', () => {
    component.ngOnInit();
    component.importFromSharePoint();
    expect(dialog.open.mock.calls[0][1].data).toEqual({
      departamentos: [],
      target: 'atlas',
      context: 'global-atlas',
      categoriaId: category.id,
    });
  });
  it('uses the existing protected PDF service for the current document', () => {
    startEditing();
    component.openCurrentPdf();
    expect(publications.openPdf).toHaveBeenCalledWith(atlas);
  });
});
