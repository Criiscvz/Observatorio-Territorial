import { Injectable, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, FormBuilder, Validators } from '@angular/forms';
import { Subscription } from 'rxjs';
import { AtlasCategoria, AtlasCategoriaService } from '@core/services/atlas-categoria.service';
import { AtlasEnlaceService } from '@core/services/atlas-enlace.service';
import { ObservatorioPublicacion } from '@core/models/publicacion/publicacion.interface';
import { powerBiEmbedUrl } from '../components/publication-viewer.component';

const nonBlank = (control: AbstractControl) => String(control.value ?? '').trim() ? null : {required:true};
const powerBiLink = (control: AbstractControl) => !control.value || powerBiEmbedUrl(String(control.value).trim()) ? null : {powerBi:true};


/** Link-only Atlas creation; legacy PDF upload routes are not changed. */
@Injectable()
export class AtlasDestinationFacade {
  private readonly categoriesApi=inject(AtlasCategoriaService);
  private readonly links=inject(AtlasEnlaceService);
  private readonly fb=inject(FormBuilder);
  private readonly destroyRef=inject(DestroyRef);
  private loadRequest?: Subscription;
  private started=false;
  readonly categories=signal<AtlasCategoria[]>([]);

  readonly loading=signal(true);

  readonly loadError=signal(false);

  readonly destination=signal<AtlasCategoria|null>(null);

  readonly saving=signal(false);

  readonly confirmClose=signal(false);

  readonly saved=signal<ObservatorioPublicacion|null>(null);

  readonly serverError=signal('');

  readonly fieldErrors=signal<Record<string,string>>({});

  readonly destinationForm=this.fb.nonNullable.group({categoria:['',Validators.required]});

  readonly form=this.fb.nonNullable.group({
    titulo:['',[nonBlank,Validators.maxLength(255)]],
    fecha_publicacion:['',[Validators.required,Validators.pattern(/^\d{4}-\d{2}-\d{2}$/)]],
    link_url:['',[nonBlank,powerBiLink,Validators.maxLength(2048)]],
    fuente:['',Validators.maxLength(255)],descripcion:['',Validators.maxLength(3000)],
  });

  load():void {
    if(this.destination())return;
    this.loadRequest?.unsubscribe();
    this.loading.set(true);this.loadError.set(false);
    this.loadRequest=this.categoriesApi.list().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next:items=>{
        this.categories.set(items);this.loading.set(false);
        if(!items.some(item=>item.id===this.destinationForm.controls.categoria.value))this.destinationForm.controls.categoria.setValue('');
      },error:()=>{this.loading.set(false);this.loadError.set(true);},
    });
  }

  openForm():boolean {
    if(this.destination() || this.loading() || this.loadError())return false;
    const category=this.categories().find(item=>item.id===this.destinationForm.controls.categoria.value);
    if(!category){this.destinationForm.controls.categoria.setErrors({required:true});this.destinationForm.markAllAsTouched();return false;}
    this.destination.set(category);this.destinationForm.disable();this.resetForm();return true;
  }

  resetForm():void {
    if (this.saving()) return;
    const now=new Date();
    this.form.reset({titulo:'',fecha_publicacion:`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`,link_url:'',fuente:'',descripcion:''});
    this.form.markAsPristine();this.saved.set(null);this.confirmClose.set(false);this.serverError.set('');this.fieldErrors.set({});
  }

  hasUnsavedChanges():boolean {return !!this.destination() && !this.saved() && this.form.dirty;}

  requestClose():void {if(this.saving())return;if(this.hasUnsavedChanges())this.confirmClose.set(true);else this.closeForm();}

  closeForm():void {if(this.saving())return;this.resetForm();this.destination.set(null);this.destinationForm.enable();}

  fieldError(name:string):string {
    if(this.fieldErrors()[name])return this.fieldErrors()[name];
    const control=this.form.get(name);
    if(!control?.touched || !control.errors)return '';
    if(control.hasError('required'))return 'Este campo es obligatorio.';
    if(control.hasError('maxlength'))return `Máximo ${control.errors['maxlength'].requiredLength} caracteres.`;
    if(control.hasError('powerBi'))return 'Ingresa un enlace público válido de Power BI: https://app.powerbi.com/view?r=…';
    return 'Introduce un valor válido.';
  }

  submit():void {
    const category=this.destination();
    if(!category || this.saving() || this.saved())return;
    this.form.markAllAsTouched();if(this.form.invalid)return;
    this.saving.set(true);this.serverError.set('');this.fieldErrors.set({});
    const values=this.form.getRawValue();
    this.links.save({...values,atlas_categoria_id:category.id,titulo:values.titulo.trim(),link_url:values.link_url.trim(),fuente:values.fuente.trim(),descripcion:values.descripcion.trim()})
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next:item=>{this.saving.set(false);this.saved.set(item);this.form.markAsPristine();},
        error:error=>{
          this.saving.set(false);
          const errors:Record<string,string>={};
          for(const [key,messages] of Object.entries(error?.error?.errors || {}))if(Array.isArray(messages) && typeof messages[0]==='string')errors[key]=messages[0];
          this.fieldErrors.set(errors);
          this.serverError.set(error?.error?.message || 'No se pudo guardar el Atlas. Conservamos tus datos; inténtalo de nuevo.');
        },
      });
  }

  start(category: string): void {
    if (this.started) return; this.started=true;
    this.destinationForm.controls.categoria.setValue(category);
    this.form.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(()=>this.fieldErrors.set({}));
    this.load();
  }
}
