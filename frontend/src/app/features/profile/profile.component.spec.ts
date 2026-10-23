import { Component, Input, Pipe, PipeTransform } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormGroup } from '@angular/forms';
import { provideRouter } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subject, of, throwError } from 'rxjs';
import { AuthService } from '@core/services/auth.service';
import { ProfileService } from '@core/services/profile.service';
import { ThemeService } from '@core/services/theme.service';
import { CommunityProfileFieldsComponent } from '@shared/components/community-profile-fields/community-profile-fields.component';
import { AccountControlsComponent } from '@shared/components/account-controls/account-controls.component';
import { ProfileComponent } from './profile.component';

@Component({selector: 'app-community-profile-fields', standalone: true, template: ''})
class MockCommunity { @Input() form!: FormGroup; }
@Component({selector: 'app-account-controls', standalone: true, template: ''})
class MockAccount {}
@Pipe({name: 'translate', standalone: true})
class MockTranslate implements PipeTransform { transform(value: string): string { return value; } }

describe('Perfil por pestañas con edición explícita', () => {
  const account = {id: 1, name: 'Usuario de prueba', email: 'perfil@example.test', rol: 'EDITOR',
    created_at: '2026-10-20T12:00:00Z', email_verified_at: '2026-10-20T12:00:00Z',
    perfil: {telefono: '123456', cargo: 'Investigador', bio: 'Descripción', avatar: null, vinculo: 'DOCENTE', institucion_tipo: 'ULEAM', institucion: 'ULEAM'},
    intereses: [{id:'salud',nombre:'Observatorio de la Salud'}], departamentos: [{id:'laboral',nombre:'Observatorio Laboral',rol:'EDITOR'}]};
  beforeEach(() => {
    if (!URL.createObjectURL) URL.createObjectURL = () => '';
    if (!URL.revokeObjectURL) URL.revokeObjectURL = () => {};
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:profile-preview');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  function setup() {
    const service = {getProfile:vi.fn(() => of(account)),updateProfile:vi.fn(),uploadAvatar:vi.fn(),deleteAvatar:vi.fn()};
    const auth = {user:vi.fn(() => account),updateUser:vi.fn()};
    TestBed.overrideComponent(ProfileComponent,{remove:{imports:[TranslateModule,CommunityProfileFieldsComponent,AccountControlsComponent]},add:{imports:[MockTranslate,MockCommunity,MockAccount]}});
    TestBed.configureTestingModule({imports:[ProfileComponent],providers:[provideRouter([]),
      {provide:ProfileService,useValue:service},{provide:AuthService,useValue:auth},
      {provide:ThemeService,useValue:{isDark:()=>true,toggleTheme:vi.fn()}},
      {provide:TranslateService,useValue:{instant:(key:string)=>key}},
    ]});
    const fixture=TestBed.createComponent(ProfileComponent);fixture.detectChanges();
    return {fixture,component:fixture.componentInstance,element:fixture.nativeElement as HTMLElement,service,auth};
  }
  const selectPhoto=(component:ProfileComponent,file=new File(['picture'],'avatar.png',{type:'image/png'}))=>{
    component.onFileSelected({target:{files:[file],value:'avatar.png'}} as unknown as Event); return file;
  };

  it('abre sin campos editables ni guardar y resume la cuenta con fecha, acceso e interés reales',()=>{
    const {component,element,service}=setup();
    expect(component.editing()).toBe(false);expect(component.profileForm.disabled).toBe(true);expect(component.communityForm.disabled).toBe(true);
    expect(element.querySelectorAll('input:not([type="file"]),textarea,select')).toHaveLength(0);
    expect(element.querySelector('[type="submit"]')).toBeNull();
    expect(element.querySelector('.identity-summary')?.textContent).toContain('20/10/2026');
    expect(element.querySelector('.identity-summary')?.textContent).toContain('Observatorio de la Salud');
    component.onSubmit(); selectPhoto(component); component.deleteAvatar();
    expect(service.updateProfile).not.toHaveBeenCalled();expect(service.uploadAvatar).not.toHaveBeenCalled();expect(service.deleteAvatar).not.toHaveBeenCalled();
  });
  it('habilita al editar y al cancelar restaura datos, comunidad y foto sin enviar peticiones',()=>{
    const {component,fixture,element,service}=setup();component.startEditing();fixture.detectChanges();
    expect(component.profileForm.enabled).toBe(true);expect(element.querySelector('[formControlName="name"]')).not.toBeNull();
    component.profileForm.patchValue({name:'Cambio sin guardar'});component.communityForm.patchValue({vinculo:'ESTUDIANTE'});selectPhoto(component);
    component.activeTab.set('community');fixture.detectChanges();component.activeTab.set('personal');fixture.detectChanges();
    expect(component.profileForm.get('name')?.value).toBe('Cambio sin guardar');
    component.cancelEditing();fixture.detectChanges();
    expect(component.profileForm.get('name')?.value).toBe(account.name);expect(component.communityForm.get('vinculo')?.value).toBe('DOCENTE');
    expect(component.avatarPreview()).toBeNull();expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:profile-preview');
    expect(component.editing()).toBe(false);expect(component.hasChanges).toBe(false);expect(service.updateProfile).not.toHaveBeenCalled();expect(service.uploadAvatar).not.toHaveBeenCalled();
  });
  it('valida nombre vacío o con espacios y dirige al campo personal',()=>{
    const {component,service}=setup();component.startEditing();component.activeTab.set('community');component.profileForm.patchValue({name:'   '});component.onSubmit();
    expect(service.updateProfile).not.toHaveBeenCalled();expect(component.activeTab()).toBe('personal');expect(component.saveError()).toBe(true);
  });
  it('valida el nombre de otra institución y dirige a Comunidad',()=>{
    const {component,service}=setup();component.startEditing();component.communityForm.patchValue({institucion_tipo:'OTRA',institucion:''});component.onSubmit();
    expect(service.updateProfile).not.toHaveBeenCalled();expect(component.activeTab()).toBe('community');
  });
  it('guarda los datos y preferencias, actualiza la cuenta y vuelve a consulta sin permitir cambiar correo ni rol',()=>{
    const {component,fixture,element,service,auth}=setup();component.startEditing();component.profileForm.patchValue({name:'  Nuevo nombre  ',bio:'Nueva biografía'});
    const updated={...account,name:'Nuevo nombre',perfil:{...account.perfil,bio:'Nueva biografía'}};service.updateProfile.mockReturnValue(of(updated));
    component.onSubmit();fixture.detectChanges();
    expect(service.updateProfile).toHaveBeenCalledWith({name:'Nuevo nombre',telefono:'123456',cargo:'Investigador',bio:'Nueva biografía',vinculo:'DOCENTE',institucion_tipo:'ULEAM',institucion:null,interes_departamento_id:'salud'});
    expect(auth.updateUser).toHaveBeenCalledWith(updated);expect(component.editing()).toBe(false);expect(component.profileForm.disabled).toBe(true);expect(component.hasChanges).toBe(false);
    expect(element.querySelector('.identity-copy')?.textContent).toContain('Nuevo nombre');expect(component.profileForm.get('email')).toBeNull();expect(component.profileForm.get('rol')).toBeNull();
  });
  it('mantiene el borrador si falla el guardado y bloquea peticiones duplicadas mientras se procesa',()=>{
    const {component,service}=setup();component.startEditing();component.profileForm.patchValue({bio:'Borrador'});
    const pending=new Subject<any>();service.updateProfile.mockReturnValue(pending);component.onSubmit();component.onSubmit();component.cancelEditing();
    expect(service.updateProfile).toHaveBeenCalledOnce();expect(component.saving()).toBe(true);expect(component.editing()).toBe(true);
    pending.error(new Error('offline'));expect(component.saving()).toBe(false);expect(component.profileForm.get('bio')?.value).toBe('Borrador');expect(component.saveError()).toBe(true);
  });
  it('solo sube la foto seleccionada al guardar y conserva intereses que el endpoint de avatar no devuelve',()=>{
    const {component,service}=setup();component.startEditing();const file=selectPhoto(component);
    expect(service.uploadAvatar).not.toHaveBeenCalled();expect(component.avatarUrl()).toBe('blob:profile-preview');
    service.uploadAvatar.mockReturnValue(of({...account,intereses:undefined,perfil:{...account.perfil,avatar:'/api/avatars/foto.png'}}));component.onSubmit();
    expect(service.uploadAvatar).toHaveBeenCalledWith(file);expect(service.updateProfile).not.toHaveBeenCalled();expect(component.user()?.intereses).toEqual(account.intereses);
    expect(component.editing()).toBe(false);expect(component.avatarUrl()).toContain('/api/avatars/foto.png');
  });
  it.each([new File(['x'],'archivo.pdf',{type:'application/pdf'}),new File([new Uint8Array(2*1024*1024+1)],'grande.png',{type:'image/png'})])('rechaza formato o tamaño inválido de foto',file=>{
    const {component,service}=setup();component.startEditing();selectPhoto(component,file);
    expect(component.hasChanges).toBe(false);expect(service.uploadAvatar).not.toHaveBeenCalled();expect(URL.createObjectURL).not.toHaveBeenCalled();
  });
  it('eliminar una foto queda pendiente y cancelar la conserva; guardar llama al endpoint de eliminación',()=>{
    const {component,service}=setup();component.user.set({...account,perfil:{...account.perfil,avatar:'/api/avatars/original.png'}} as any);component.startEditing();component.deleteAvatar();
    expect(component.avatarUrl()).toBeNull();expect(service.deleteAvatar).not.toHaveBeenCalled();component.cancelEditing();expect(component.avatarUrl()).toContain('original.png');
    component.startEditing();component.deleteAvatar();service.deleteAvatar.mockReturnValue(of(account));component.onSubmit();expect(service.deleteAvatar).toHaveBeenCalledOnce();expect(component.editing()).toBe(false);
  });
  it('si solo falla la foto tras guardar datos, informa del resultado parcial y permite reintentar sin repetir los datos',()=>{
    const {component,service}=setup();component.startEditing();component.profileForm.patchValue({name:'Nombre actualizado'});selectPhoto(component);
    const updated={...account,name:'Nombre actualizado'};service.updateProfile.mockReturnValue(of(updated));service.uploadAvatar.mockReturnValue(throwError(()=>new Error('upload failed')));component.onSubmit();
    expect(component.status()).toBe('profile.workspace.partialAvatarError');expect(component.user()?.name).toBe('Nombre actualizado');expect(component.editing()).toBe(true);
    service.uploadAvatar.mockReturnValue(of({...updated,perfil:{...account.perfil,avatar:'/api/avatars/nueva.png'}}));component.onSubmit();
    expect(service.updateProfile).toHaveBeenCalledOnce();expect(service.uploadAvatar).toHaveBeenCalledTimes(2);expect(component.editing()).toBe(false);
  });
  it('mantiene los permisos de consulta y enlaces solo a los observatorios de la cuenta',()=>{
    const {component,fixture,element}=setup();component.activeTab.set('access');fixture.detectChanges();
    expect(element.querySelector('#profile-access input')).toBeNull();expect(element.querySelector('#profile-access select')).toBeNull();
    expect(element.querySelector('a[href="/admin/departamentos/laboral"]')).not.toBeNull();component.startEditing();expect(component.activeTab()).toBe('personal');
  });
});
