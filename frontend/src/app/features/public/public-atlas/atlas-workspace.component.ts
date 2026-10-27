import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, TemplateRef, ViewChild, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Observable, combineLatest, forkJoin, tap } from 'rxjs';
import { AtlasCategoria, AtlasCategoriaService } from '@core/services/atlas-categoria.service';
import { AtlasEnlaceService } from '@core/services/atlas-enlace.service';
import { PublicacionService } from '@core/services/publicacion.service';
import { ObservatorioPublicacion } from '@core/models/publicacion/publicacion.interface';
import { ATLAS_CATEGORY_ICONS, atlasCategoryPresentation } from '@core/utils/atlas-category-presentation';
import { ConfirmDialogComponent, ConfirmDialogData } from '@shared/components/confirm-dialog/confirm-dialog.component';

export function atlasHttpUrl(control: AbstractControl) {
  try { return ['https:', 'http:'].includes(new URL(String(control.value).trim()).protocol) ? null : {httpUrl:true}; }
  catch { return {httpUrl:true}; }
}

@Component({
  selector: 'app-atlas-workspace', standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, MatDialogModule, MatIconModule, MatProgressSpinnerModule, MatSnackBarModule],
  templateUrl: './atlas-workspace.component.html', styleUrl: './atlas-workspace.component.scss',
})
export class AtlasWorkspaceComponent implements OnInit {
  private readonly categoryService = inject(AtlasCategoriaService);
  private readonly publicationService = inject(PublicacionService);
  private readonly linkService = inject(AtlasEnlaceService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly snackbar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);
  @ViewChild('editor', {static:true}) editor!: TemplateRef<unknown>;
  private editorRef?: MatDialogRef<unknown>;
  readonly categories = signal<AtlasCategoria[]>([]);
  readonly publications = signal<ObservatorioPublicacion[]>([]);
  readonly categoryId = signal('');
  readonly category = computed(() => this.categories().find(c => c.id === this.categoryId()));
  readonly unassigned = computed(() => this.publications().filter(p => !p.atlas_categoria_id));
  readonly inCategory = computed(() => !!this.categoryId());
  readonly loading = signal(true);
  readonly error = signal('');
  readonly saving = signal(false);
  readonly busy = signal(false);
  readonly search = signal('');
  readonly page = signal(0);
  readonly pageSize = computed(() => this.inCategory() ? 20 : 10);
  readonly normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es').trim();
  readonly filteredCategories = computed(() => this.categories().filter(c => this.normalize(`${c.nombre} ${c.descripcion||''}`).includes(this.normalize(this.search()))));
  readonly categoryItems = computed(() => this.publications().filter(p => this.categoryId() === 'sin-categoria' ? !p.atlas_categoria_id : p.atlas_categoria_id === this.categoryId()));
  readonly filteredItems = computed(() => this.categoryItems().filter(p => this.normalize(`${p.titulo} ${p.codigo} ${p.fuente||''}`).includes(this.normalize(this.search()))));
  readonly total = computed(() => this.inCategory() ? this.filteredItems().length : this.filteredCategories().length);
  readonly pageCount = computed(() => Math.max(1, Math.ceil(this.total()/this.pageSize())));
  readonly currentPage = computed(() => Math.min(this.page(), this.pageCount()-1));
  readonly visibleCategories = computed(() => this.filteredCategories().slice(this.currentPage()*10, (this.currentPage()+1)*10));
  readonly visibleItems = computed(() => this.filteredItems().slice(this.currentPage()*20, (this.currentPage()+1)*20));
  readonly rangeStart = computed(() => this.total() ? this.currentPage()*this.pageSize()+1 : 0);
  readonly rangeEnd = computed(() => Math.min((this.currentPage()+1)*this.pageSize(),this.total()));
  readonly icon = atlasCategoryPresentation;
  readonly availableIcons = ATLAS_CATEGORY_ICONS;
  readonly editorMode = signal<'category'|'link'>('link');
  readonly editingCategory = signal<AtlasCategoria|null>(null);
  readonly editingLink = signal<ObservatorioPublicacion|null>(null);
  readonly formError = signal('');
  readonly discard = signal(false);
  readonly categoryForm = this.fb.nonNullable.group({
    nombre:['',[Validators.required,Validators.pattern(/\S/),Validators.maxLength(150)]],
    descripcion:['',Validators.maxLength(3000)],icono:[''],publico:[false],
  });
  readonly linkForm = this.fb.nonNullable.group({
    titulo:['',[Validators.required,Validators.pattern(/\S/),Validators.maxLength(255)]],
    atlas_categoria_id:['',Validators.required],fecha_publicacion:['',[Validators.required,Validators.pattern(/^\d{4}-\d{2}-\d{2}$/)]],
    link_url:['',[Validators.required,atlasHttpUrl,Validators.maxLength(2048)]],
    fuente:['',Validators.maxLength(255)],descripcion:['',Validators.maxLength(3000)],
  });
  get form() { return this.editorMode() === 'category' ? this.categoryForm : this.linkForm; }

  constructor() { this.destroyRef.onDestroy(() => this.editorRef?.close()); }
  ngOnInit() {
    combineLatest([this.route.paramMap,this.route.queryParamMap]).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(([params,query]) => {
      this.categoryId.set(params.get('categoria') || query.get('categoria') || ''); this.updateSearch('');
    });
    this.load(() => {
      const query=this.route.snapshot.queryParamMap;
      const editId=query.get('editar');
      if(editId) { const item=this.publications().find(p=>p.id===editId); if(item)this.openLink(item); }
      else if(this.route.snapshot.url.some(s=>s.path==='subir')) this.openLink();
    });
  }
  load(done?:()=>void) {
    this.loading.set(true); this.error.set('');
    forkJoin([this.categoryService.list(),this.publicationService.getGlobalAtlas()]).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next:([categories,publications])=>{this.categories.set(categories);this.publications.set(publications);this.loading.set(false);done?.();},
      error:()=>{this.loading.set(false);this.error.set('No se pudo cargar Atlas. Intenta actualizar.');},
    });
  }
  updateSearch(value:string) { this.search.set(value);this.page.set(0); }
  changePage(delta:number) { this.page.set(Math.max(0,Math.min(this.currentPage()+delta,this.pageCount()-1))); }
  count(category:AtlasCategoria) { return this.publications().filter(p=>p.atlas_categoria_id===category.id).length; }
  safeUrl(value?:string|null):string|null { if(!value)return null;try { return ['http:','https:'].includes(new URL(value).protocol) ? value : null; }catch{return null;} }
  openAtlas(item:ObservatorioPublicacion) {
    const url=this.safeUrl(item.link_url);
    if(url) window.open(url,'_blank','noopener,noreferrer');
    else this.publicationService.openPdf(item).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(opened=>{if(!opened)this.snackbar.open('Este Atlas no tiene un enlace o archivo disponible.','Cerrar',{duration:4500});});
  }
  openCategory(item?:AtlasCategoria) {
    if(this.saving()||this.busy())return;
    this.editorMode.set('category');this.editingCategory.set(item||null);
    this.categoryForm.reset({nombre:item?.nombre||'',descripcion:item?.descripcion||'',icono:item?.icono||'',publico:item?.publico??false});this.openEditor();
  }
  openLink(item?:ObservatorioPublicacion) {
    if(this.saving()||this.busy())return;
    this.editorMode.set('link');this.editingLink.set(item||null);
    const today=new Date(); const localDate=`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
    this.linkForm.reset({titulo:item?.titulo||'',atlas_categoria_id:item?.atlas_categoria_id||this.category()?.id||'',
      fecha_publicacion:item?.fecha_publicacion?.slice(0,10)||localDate,link_url:item?.link_url||'',fuente:item?.fuente||'',descripcion:item?.descripcion||''});this.openEditor();
  }
  private openEditor() {
    if(this.editorRef)return;
    this.formError.set('');this.discard.set(false);
    this.editorRef=this.dialog.open(this.editor,{width:'720px',maxWidth:'calc(100vw - 24px)',maxHeight:'calc(100dvh - 24px)',panelClass:'atlas-workspace-dialog',disableClose:true,ariaLabel:'Formulario de Atlas',autoFocus:'first-tabbable'});
    this.editorRef.backdropClick().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(()=>this.closeEditor());
    this.editorRef.keydownEvents().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(event=>{if(event.key==='Escape'){event.preventDefault();this.closeEditor();}});
    this.editorRef.afterClosed().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(()=>{this.editorRef=undefined;});
  }
  closeEditor(force=false) { if(this.saving())return;if(!force&&this.form.dirty){this.discard.set(true);return;}this.editorRef?.close();this.discard.set(false); }
  save() {
    if(this.saving())return;this.form.markAllAsTouched();if(this.form.invalid)return;
    this.saving.set(true);this.formError.set('');
    const values=this.linkForm.getRawValue(); const categoryValues=this.categoryForm.getRawValue();
    const request: Observable<unknown>=this.editorMode()==='category'
      ?this.categoryService.save({...categoryValues,nombre:categoryValues.nombre.trim(),descripcion:categoryValues.descripcion.trim()||null,icono:categoryValues.icono||null},this.editingCategory()?.id)
      :this.linkService.save({...values,titulo:values.titulo.trim(),link_url:values.link_url.trim(),fuente:values.fuente.trim(),descripcion:values.descripcion.trim()},this.editingLink()?.id);
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next:()=>{this.saving.set(false);this.closeEditor(true);this.load();this.snackbar.open('Cambios guardados correctamente.','Cerrar',{duration:3500});},
      error:error=>{this.saving.set(false);this.formError.set(this.message(error));},
    });
  }
  deleteCategory(item:AtlasCategoria) {
    this.confirm({title:'Eliminar categoría',message:`¿Eliminar «${item.nombre}»? Si tiene Atlas asociados, primero debes reasignarlos o eliminarlos.`,confirmText:'Eliminar categoría',confirmColor:'warn',icon:'delete_outline',confirmAction:()=>this.categoryService.delete(item.id).pipe(tap(()=>{if(this.categoryId()===item.id)this.router.navigate(['/admin/atlas']);this.load();}))});
  }
  deleteLink(item:ObservatorioPublicacion) {
    this.confirm({title:'Eliminar Atlas',message:`¿Eliminar permanentemente «${item.titulo}»?${item.download_url?' También se eliminará el PDF almacenado en la plataforma.':''} El sitio externo no se eliminará.`,confirmText:'Eliminar Atlas',confirmColor:'warn',icon:'delete_outline',confirmAction:()=>this.publicationService.delete(item.id).pipe(tap(()=>this.load()))});
  }
  private confirm(data:ConfirmDialogData) {
    if(this.busy()||this.saving())return;this.busy.set(true);
    this.dialog.open(ConfirmDialogComponent,{width:'540px',maxWidth:'calc(100vw - 24px)',panelClass:'app-confirm-dialog-panel',backdropClass:'app-confirm-dialog-backdrop',data:{...data,cancelText:'Cancelar',onError:(error:unknown)=>this.snackbar.open(this.message(error),'Cerrar',{duration:6000})}}).afterClosed().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(()=>this.busy.set(false));
  }
  private message(error:any) { const first=Object.values(error?.error?.errors||{}).flat()[0]; return typeof first==='string'?first:error?.error?.message||'No se pudo guardar el cambio. Inténtalo de nuevo.'; }
}
