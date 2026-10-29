import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { Departamento } from '@core/models';
import { DepartamentoService } from '@core/services/departamento.service';
import { provideTranslateService, TranslateService } from '@ngx-translate/core';
import { of, Subject } from 'rxjs';
import { DepartamentoFormComponent } from './departamento-form.component';

describe('Observatory form icon compatibility', () => {
  const departamento: Departamento = {
    id: 'observatorio-1',
    nombre: 'Resiliencia',
    codigo_interno: 'RESILIENCIA',
    descripcion: 'Gestión de riesgos',
    publico: true,
    icono: 'shield',
    created_at: '',
    updated_at: '',
  };
  let service: { getById: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    service = {
      getById: vi.fn(() => of(departamento)),
      update: vi.fn(() => new Subject()),
    };
    TestBed.configureTestingModule({
      imports: [DepartamentoFormComponent],
      providers: [
        provideRouter([]),
        provideTranslateService({ fallbackLang: 'es' }),
        { provide: ActivatedRoute, useValue: { snapshot: { params: { id: departamento.id } } } },
        { provide: DepartamentoService, useValue: service },
      ],
    });
    TestBed.inject(TranslateService).setTranslation('es', {
      departamentos: {
        icons: {
          care: 'Cuidados / Bienestar',
          culture: 'Cultura / Arte',
          resilience: 'Resiliencia / Protección',
        },
      },
    });
  });

  it.each([
    ['shield', 'Resiliencia / Protección'],
    ['favorite', 'Cuidados / Bienestar'],
    ['auto_stories', 'Cultura / Arte'],
  ])('renders the saved %s icon as a selected option without changing its value', async (icon, label) => {
    service.getById.mockReturnValue(of({ ...departamento, icono: icon }));
    const fixture = TestBed.createComponent(DepartamentoFormComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const component = fixture.componentInstance;
    const selector = fixture.nativeElement.querySelector('mat-select[formControlName="icono"]');
    expect(component.form.get('icono')?.value).toBe(icon);
    expect(selector.textContent).toContain(label);
    expect(component.unlistedIcon).toBeNull();
    expect(service.update).not.toHaveBeenCalled();

    component.onSubmit();
    expect(service.update).toHaveBeenCalledExactlyOnceWith(
      departamento.id,
      expect.objectContaining({ icono: icon, publico: true }),
    );
    fixture.destroy();
  });

  it('keeps an existing icon outside the catalog visible and unchanged when editing', async () => {
    service.getById.mockReturnValue(of({ ...departamento, icono: 'bookmark' }));
    const fixture = TestBed.createComponent(DepartamentoFormComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const component = fixture.componentInstance;
    const selector = fixture.nativeElement.querySelector('mat-select[formControlName="icono"]');
    expect(component.unlistedIcon).toBe('bookmark');
    expect(component.form.get('icono')?.value).toBe('bookmark');
    expect(selector.textContent).toContain('bookmark');

    component.onSubmit();
    expect(service.update).toHaveBeenCalledExactlyOnceWith(
      departamento.id,
      expect.objectContaining({ icono: 'bookmark' }),
    );
    fixture.destroy();
  });

  it('can clear an existing icon or switch to a catalog icon without a duplicate fallback', () => {
    const component = TestBed.runInInjectionContext(() => new DepartamentoFormComponent());
    component.form.patchValue({ icono: 'bookmark' });
    expect(component.unlistedIcon).toBe('bookmark');
    component.form.patchValue({ icono: 'eco' });
    expect(component.unlistedIcon).toBeNull();
    component.form.patchValue({ icono: '' });
    expect(component.unlistedIcon).toBeNull();
    expect(new Set(component.availableIcons.map((icon) => icon.value)).size).toBe(
      component.availableIcons.length,
    );
  });

  it('keeps a saved photo until explicitly switching to an icon or removing it', async () => {
    const photo='data:image/jpeg;base64,existing';
    service.getById.mockReturnValue(of({...departamento,foto_url:photo}));
    const fixture=TestBed.createComponent(DepartamentoFormComponent);fixture.detectChanges();
    const component=fixture.componentInstance;
    expect(component.identityMode()).toBe('photo');expect(component.photoPreview()).toBe(photo);
    await component.onSubmit();expect(service.update).toHaveBeenCalledWith(departamento.id,expect.objectContaining({eliminar_foto:false}));
    component.loading.set(false);component.removePhoto();await component.onSubmit();
    expect(service.update).toHaveBeenLastCalledWith(departamento.id,expect.objectContaining({eliminar_foto:true,icono:'shield'}));
    fixture.destroy();
  });
  it('rejects incompatible and oversized files without losing the current identity',async()=>{
    const fixture=TestBed.createComponent(DepartamentoFormComponent);fixture.detectChanges();const component=fixture.componentInstance;
    await component.selectPhoto(new File(['<svg/>'],'x.svg',{type:'image/svg+xml'}));expect(component.photoError()).toContain('JPG');expect(component.selectedPhoto).toBeNull();
    await component.selectPhoto(new File([new Uint8Array(2*1024*1024+1)],'big.png',{type:'image/png'}));expect(component.photoError()).toContain('2 MB');
    await component.onSubmit();expect(service.update).not.toHaveBeenCalled();fixture.destroy();
  });
  it('requires a photo in photo mode and blocks duplicate submits',async()=>{
    const fixture=TestBed.createComponent(DepartamentoFormComponent);fixture.detectChanges();const component=fixture.componentInstance;
    component.setIdentityMode('photo');await component.onSubmit();expect(component.photoError()).toContain('Selecciona');expect(service.update).not.toHaveBeenCalled();
    component.setIdentityMode('icon');await component.onSubmit();await component.onSubmit();expect(service.update).toHaveBeenCalledOnce();fixture.destroy();
  });
  it('sends the prepared photo and form values together, without uploading before save',async()=>{
    const fixture=TestBed.createComponent(DepartamentoFormComponent);fixture.detectChanges();const component=fixture.componentInstance;
    const photo=new File(['jpeg'],'observatorio.jpg',{type:'image/jpeg'});
    component.selectedPhoto=photo;component.photoPreview.set('data:image/jpeg;base64,cropped');component.setIdentityMode('photo');
    vi.spyOn(component as any,'croppedPhoto').mockResolvedValue(photo);
    expect(service.update).not.toHaveBeenCalled();await component.onSubmit();
    const body=service.update.mock.calls[0][1] as FormData;expect(body).toBeInstanceOf(FormData);expect(body.get('foto')).toBe(photo);expect(body.get('publico')).toBe('1');expect(body.get('eliminar_foto')).toBe('0');expect(body.get('nombre')).toBe('Resiliencia');fixture.destroy();
  });
});
