import { AtlasDestinationFacade } from './atlas-destination.facade';
import { Component, DestroyRef, ElementRef, HostListener, OnInit, ViewChild, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Observable, finalize, map, shareReplay, take } from 'rxjs';
import { atlasCategoryPresentation } from '@core/utils/atlas-category-presentation';
import { ConfirmDialogComponent } from '@shared/components/confirm-dialog/confirm-dialog.component';
import { publicHttpUrl } from '../components/public-library-publication';
import { powerBiEmbedUrl } from '../components/publication-viewer.component';
import { PublicationViewerService } from '../components/publication-viewer.service';

@Component({
  selector:'app-atlas-destination',standalone:true,
  providers:[AtlasDestinationFacade],
  imports:[RouterLink,ReactiveFormsModule,MatIconModule],
  templateUrl:'./atlas-destination.component.html',
  styleUrls:['../../admin-workspace/publication-destination.component.scss','./atlas-destination.component.scss'],
})
export class AtlasDestinationComponent implements OnInit {
  private readonly state=inject(AtlasDestinationFacade);

  private readonly viewer=inject(PublicationViewerService);
  private readonly dialog=inject(MatDialog);
  private readonly route=inject(ActivatedRoute);
  private readonly router=inject(Router);

  private readonly destroyRef=inject(DestroyRef);
  private leaveConfirmation?:Observable<boolean>;
  @ViewChild('editor') private editor?:ElementRef<HTMLElement>;
  readonly categories=this.state.categories;
  readonly loading=this.state.loading;
  readonly loadError=this.state.loadError;
  readonly destination=this.state.destination;
  readonly saving=this.state.saving;
  readonly confirmClose=this.state.confirmClose;
  readonly saved=this.state.saved;
  readonly serverError=this.state.serverError;
  readonly fieldErrors=this.state.fieldErrors;
  readonly destinationForm=this.state.destinationForm;
  readonly form=this.state.form;
  readonly categoryIcon=atlasCategoryPresentation;

  ngOnInit():void {
    const query=this.route.snapshot.queryParamMap;
    // Keep older edit links pointing to the existing category management dialog.
    if(query.get('editar')){
      void this.router.navigate(['/admin/atlas'],{queryParams:{editar:query.get('editar'),categoria:query.get('categoria')},replaceUrl:true});
      return;
    }
    this.state.start(query.get('categoria') || '');
  }
  load():void {return this.state.load();}
  openForm():void {if(this.state.openForm())this.focusEditor();}

  private focusEditor():void {
    setTimeout(()=>{
      const element=this.editor?.nativeElement;
      element?.querySelector<HTMLInputElement>('input[name=titulo]')?.focus({preventScroll:true});
      if(element && window.innerWidth<700)element.scrollIntoView({block:'start',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
    });
  }
  hasUnsavedChanges():boolean {return this.state.hasUnsavedChanges();}
  requestClose():void {return this.state.requestClose();}
  closeForm():void {return this.state.closeForm();}
  createAnother():void {if(this.saving())return;this.state.resetForm();this.focusEditor();}
  canLeave():boolean|Observable<boolean> {
    if(this.saving())return false;
    if(!this.hasUnsavedChanges())return true;
    if(!this.leaveConfirmation)this.leaveConfirmation=this.dialog.open(ConfirmDialogComponent,{
      width:'min(92vw, 520px)',panelClass:'app-confirm-dialog-panel',backdropClass:'app-confirm-dialog-backdrop',
      data:{title:'¿Salir sin guardar?',message:'El Atlas aún no se ha guardado. Si sales, perderás los cambios.',confirmText:'Salir sin guardar',cancelText:'Seguir editando',icon:'edit_note'},
    }).afterClosed().pipe(take(1),takeUntilDestroyed(this.destroyRef),map(value=>value===true),finalize(()=>this.leaveConfirmation=undefined),shareReplay({bufferSize:1,refCount:true}));
    return this.leaveConfirmation;
  }
  @HostListener('window:beforeunload',['$event']) beforeUnload(event:BeforeUnloadEvent):void {
    if(this.saving() || this.hasUnsavedChanges()){event.preventDefault();event.returnValue='';}
  }
  fieldError(name:string):string {return this.state.fieldError(name);}
  preview():void {
    if(this.saving() || !this.destination() || this.form.controls.link_url.invalid)return;
    const values=this.form.getRawValue();const category=this.destination()!;
    this.viewer.open({id:'atlas-link-preview',type:'REPORTE',title:values.titulo.trim() || 'Vista previa del Atlas',
      code:'Sin guardar',date:values.fecha_publicacion || null,authors:'',description:values.descripcion.trim(),
      source:values.fuente.trim(),sourceUrl:publicHttpUrl(values.fuente),reportUrl:powerBiEmbedUrl(values.link_url.trim()),
      download_url:null,sharepoint_url:null,locked:false},category.nombre,'report','atlas');
  }
  submit():void {return this.state.submit();}
}
