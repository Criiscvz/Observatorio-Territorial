import { Component, DestroyRef, ElementRef, HostListener, OnInit, ViewChild, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Observable, finalize, map, shareReplay, take } from 'rxjs';
import { AtlasCategoria, AtlasCategoriaService } from '@core/services/atlas-categoria.service';
import { AtlasEnlaceService } from '@core/services/atlas-enlace.service';
import { ObservatorioPublicacion } from '@core/models/publicacion/publicacion.interface';
import { atlasCategoryPresentation } from '@core/utils/atlas-category-presentation';
import { ConfirmDialogComponent } from '@shared/components/confirm-dialog/confirm-dialog.component';
import { publicHttpUrl } from '../components/public-library-publication';
import { powerBiEmbedUrl } from '../components/publication-viewer.component';
import { PublicationViewerService } from '../components/publication-viewer.service';

const nonBlank = (control: AbstractControl) => String(control.value ?? '').trim() ? null : {required:true};
const powerBiLink = (control: AbstractControl) => !control.value || powerBiEmbedUrl(String(control.value).trim()) ? null : {powerBi:true};

@Component({
  selector:'app-atlas-destination',standalone:true,
  imports:[RouterLink,ReactiveFormsModule,MatIconModule],
  templateUrl:'./atlas-destination.component.html',
  styleUrls:['../../admin-workspace/publication-destination.component.scss','./atlas-destination.component.scss'],
})
export class AtlasDestinationComponent implements OnInit {
  private readonly categoriesApi=inject(AtlasCategoriaService);
  private readonly links=inject(AtlasEnlaceService);
  private readonly viewer=inject(PublicationViewerService);
  private readonly dialog=inject(MatDialog);
  private readonly route=inject(ActivatedRoute);
  private readonly router=inject(Router);
  private readonly fb=inject(FormBuilder);
  private readonly destroyRef=inject(DestroyRef);
  private leaveConfirmation?:Observable<boolean>;
  @ViewChild('editor') private editor?:ElementRef<HTMLElement>;
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
  readonly categoryIcon=atlasCategoryPresentation;

  ngOnInit():void {
    const query=this.route.snapshot.queryParamMap;
    // Keep older edit links pointing to the existing category management dialog.
    if(query.get('editar')){
      void this.router.navigate(['/admin/atlas'],{queryParams:{editar:query.get('editar'),categoria:query.get('categoria')},replaceUrl:true});
      return;
    }
    this.destinationForm.controls.categoria.setValue(query.get('categoria') || '');
    this.form.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(()=>this.fieldErrors.set({}));
    this.load();
  }
  load():void {
    if(this.destination())return;
    this.loading.set(true);this.loadError.set(false);
    this.categoriesApi.list().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next:items=>{
        this.categories.set(items);this.loading.set(false);
        if(!items.some(item=>item.id===this.destinationForm.controls.categoria.value))this.destinationForm.controls.categoria.setValue('');
      },error:()=>{this.loading.set(false);this.loadError.set(true);},
    });
  }
  openForm():void {
    if(this.destination() || this.loading() || this.loadError())return;
    const category=this.categories().find(item=>item.id===this.destinationForm.controls.categoria.value);
    if(!category){this.destinationForm.controls.categoria.setErrors({required:true});this.destinationForm.markAllAsTouched();return;}
    this.destination.set(category);this.destinationForm.disable();this.resetForm();this.focusEditor();
  }
  private resetForm():void {
    const now=new Date();
    this.form.reset({titulo:'',fecha_publicacion:`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`,link_url:'',fuente:'',descripcion:''});
    this.form.markAsPristine();this.saved.set(null);this.confirmClose.set(false);this.serverError.set('');this.fieldErrors.set({});
  }
  private focusEditor():void {
    setTimeout(()=>{
      const element=this.editor?.nativeElement;
      element?.querySelector<HTMLInputElement>('input[name=titulo]')?.focus({preventScroll:true});
      if(element && window.innerWidth<700)element.scrollIntoView({block:'start',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
    });
  }
  hasUnsavedChanges():boolean {return !!this.destination() && !this.saved() && this.form.dirty;}
  requestClose():void {if(this.saving())return;if(this.hasUnsavedChanges())this.confirmClose.set(true);else this.closeForm();}
  closeForm():void {if(this.saving())return;this.resetForm();this.destination.set(null);this.destinationForm.enable();}
  createAnother():void {if(this.saving())return;this.resetForm();this.focusEditor();}
  canLeave():boolean|Observable<boolean> {
    if(this.saving())return false;
    if(!this.hasUnsavedChanges())return true;
    if(!this.leaveConfirmation)this.leaveConfirmation=this.dialog.open(ConfirmDialogComponent,{
      width:'min(92vw, 520px)',panelClass:'app-confirm-dialog-panel',backdropClass:'app-confirm-dialog-backdrop',
      data:{title:'¿Salir sin guardar?',message:'El Atlas aún no se ha guardado. Si sales, perderás los cambios.',confirmText:'Salir sin guardar',cancelText:'Seguir editando',icon:'edit_note'},
    }).afterClosed().pipe(take(1),map(value=>value===true),finalize(()=>this.leaveConfirmation=undefined),shareReplay({bufferSize:1,refCount:true}));
    return this.leaveConfirmation;
  }
  @HostListener('window:beforeunload',['$event']) beforeUnload(event:BeforeUnloadEvent):void {
    if(this.saving() || this.hasUnsavedChanges()){event.preventDefault();event.returnValue='';}
  }
  fieldError(name:string):string {
    if(this.fieldErrors()[name])return this.fieldErrors()[name];
    const control=this.form.get(name);
    if(!control?.touched || !control.errors)return '';
    if(control.hasError('required'))return 'Este campo es obligatorio.';
    if(control.hasError('maxlength'))return `Máximo ${control.errors['maxlength'].requiredLength} caracteres.`;
    if(control.hasError('powerBi'))return 'Ingresa un enlace público válido de Power BI: https://app.powerbi.com/view?r=…';
    return 'Introduce un valor válido.';
  }
  preview():void {
    if(this.saving() || !this.destination() || this.form.controls.link_url.invalid)return;
    const values=this.form.getRawValue();const category=this.destination()!;
    this.viewer.open({id:'atlas-link-preview',type:'REPORTE',title:values.titulo.trim() || 'Vista previa del Atlas',
      code:'Sin guardar',date:values.fecha_publicacion || null,authors:'',description:values.descripcion.trim(),
      source:values.fuente.trim(),sourceUrl:publicHttpUrl(values.fuente),reportUrl:powerBiEmbedUrl(values.link_url.trim()),
      download_url:null,sharepoint_url:null,locked:false},category.nombre,'report','atlas');
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
}
