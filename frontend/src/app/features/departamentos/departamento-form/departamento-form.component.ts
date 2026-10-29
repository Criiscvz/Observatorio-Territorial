import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, signal, DestroyRef } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DepartamentoService } from '@core/services/departamento.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";

@Component({
  selector: 'app-departamento-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatSlideToggleModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    TranslateModule,
  ],
  templateUrl: './departamento-form.component.html',
  styleUrl: './departamento-form.component.scss',
})
export class DepartamentoFormComponent implements OnInit {
    private readonly destroyRef = inject(DestroyRef);
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private deptoService = inject(DepartamentoService);
  private translate = inject(TranslateService);

  form: FormGroup = this.fb.group({
    nombre: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(255)]],
    codigo_interno: ['', [Validators.required, Validators.maxLength(50)]],
    descripcion: ['', [Validators.maxLength(1000)]],
    icono: [''],
    publico: [false],
  });

  // Lista de iconos disponibles de Material Icons
  availableIcons = [
    { value: 'groups', labelKey: 'departamentos.icons.social' },
    { value: 'work', labelKey: 'departamentos.icons.work' },
    { value: 'how_to_vote', labelKey: 'departamentos.icons.electoral' },
    { value: 'flight_takeoff', labelKey: 'departamentos.icons.tourism' },
    { value: 'school', labelKey: 'departamentos.icons.education' },
    { value: 'health_and_safety', labelKey: 'departamentos.icons.health' },
    { value: 'agriculture', labelKey: 'departamentos.icons.agriculture' },
    { value: 'engineering', labelKey: 'departamentos.icons.infrastructure' },
    { value: 'account_balance', labelKey: 'departamentos.icons.finance' },
    { value: 'eco', labelKey: 'departamentos.icons.environment' },
    { value: 'favorite', labelKey: 'departamentos.icons.care' },
    { value: 'auto_stories', labelKey: 'departamentos.icons.culture' },
    { value: 'shield', labelKey: 'departamentos.icons.resilience' },
    { value: 'local_hospital', labelKey: 'departamentos.icons.health' },
    { value: 'science', labelKey: 'departamentos.icons.research' },
    { value: 'sports', labelKey: 'departamentos.icons.sports' },
    { value: 'construction', labelKey: 'departamentos.icons.infrastructure' },
    { value: 'storefront', labelKey: 'departamentos.icons.generic' },
    { value: 'directions_car', labelKey: 'departamentos.icons.generic' },
    { value: 'public', labelKey: 'departamentos.icons.generic' },
    { value: 'security', labelKey: 'departamentos.icons.security' },
    { value: 'gavel', labelKey: 'departamentos.icons.generic' },
    { value: 'family_restroom', labelKey: 'departamentos.icons.social' },
  ];

  isEdit = signal(false);
  departamentoId = signal<string | null>(null);
  loading = signal(false);
  error = signal<string | null>(null);
  success = signal<string | null>(null);
  fetching = signal(false);
  identityMode = signal<'icon'|'photo'>('icon');
  photoPreview = signal('');
  photoName = signal('');
  photoError = signal('');
  zoom = signal(1);
  selectedPhoto: File | null = null;
  private photoImage: HTMLImageElement | null = null;
  private photoGeneration = 0;

  ngOnInit(): void {
    const id = this.route.snapshot.params['id'];
    if (id && id !== 'nuevo') {
      this.isEdit.set(true);
      this.departamentoId.set(id);
      this.loadDepartamento(id);
    }
  }

  loadDepartamento(id: string): void {
    this.fetching.set(true);
    this.deptoService.getById(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (departamento) => {
        this.fetching.set(false);
        this.photoPreview.set(departamento.foto_url || '');
        this.identityMode.set(departamento.foto_url ? 'photo' : 'icon');
        this.photoName.set(departamento.foto_url ? 'Foto actual del observatorio' : '');
        this.form.patchValue({
          nombre: departamento.nombre,
          codigo_interno: departamento.codigo_interno,
          descripcion: departamento.descripcion,
          icono: departamento.icono || '',
          publico: departamento.publico,
        });
      },
      error: err => { this.fetching.set(false); this.error.set(this.getErrorMessage(err)); },
    });
  }

  setIdentityMode(mode:'icon'|'photo'):void {if(!this.loading()){this.identityMode.set(mode);this.photoError.set('');}}
  removePhoto():void {
    if(this.loading())return;
    ++this.photoGeneration;this.selectedPhoto=null;this.photoImage=null;this.photoPreview.set('');this.photoName.set('');this.zoom.set(1);this.identityMode.set('icon');this.photoError.set('');
  }
  async selectPhoto(file?:File):Promise<void> {
    if(!file || this.loading())return;
    const generation=++this.photoGeneration;this.photoError.set('');
    if(!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size>2*1024*1024){this.photoError.set('Selecciona una imagen JPG, PNG o WebP de hasta 2 MB.');return;}
    try {
      const data=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error());reader.readAsDataURL(file);});
      const image=await new Promise<HTMLImageElement>((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error());img.src=data;});
      if(generation!==this.photoGeneration)return;
      if(image.naturalWidth>4096 || image.naturalHeight>4096){this.photoError.set('La imagen debe medir como máximo 4096 × 4096 píxeles.');return;}
      this.selectedPhoto=file;this.photoImage=image;this.photoPreview.set(data);this.photoName.set(file.name);this.identityMode.set('photo');this.zoom.set(1);
    } catch {if(generation===this.photoGeneration)this.photoError.set('No se pudo leer la imagen. Prueba con otro archivo.');}
  }
  onDrop(event:DragEvent):void {event.preventDefault();void this.selectPhoto(event.dataTransfer?.files[0]);}
  private async croppedPhoto():Promise<File> {
    const image=this.photoImage!;const canvas=document.createElement('canvas');canvas.width=400;canvas.height=400;
    const ctx=canvas.getContext('2d');if(!ctx)throw new Error();ctx.fillStyle='#fff';ctx.fillRect(0,0,400,400);
    const side=Math.min(image.naturalWidth,image.naturalHeight)/this.zoom();ctx.drawImage(image,(image.naturalWidth-side)/2,(image.naturalHeight-side)/2,side,side,0,0,400,400);
    const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error()),'image/jpeg',.88));
    return new File([blob],'observatorio.jpg',{type:'image/jpeg'});
  }

  getIconLabel(value: string): string {
    const icon = this.availableIcons.find((i) => i.value === value);
    return icon ? this.translate.instant(icon.labelKey) : value;
  }

  get unlistedIcon(): string | null {
    const icon = this.form.get('icono')?.value;
    return icon && !this.availableIcons.some((option) => option.value === icon) ? icon : null;
  }

  async onSubmit(): Promise<void> {
    if(this.loading() || this.fetching())return;
    // Marcar todos los campos como touched para mostrar errores
    this.form.markAllAsTouched();

    if (this.form.invalid || !this.form.value.nombre.trim() || !this.form.value.codigo_interno.trim()) {
      this.error.set(this.translate.instant('departamentos.form.errors.formInvalid'));
      return;
    }

    this.loading.set(true);
    if(this.identityMode()==='photo' && !this.photoPreview()){this.loading.set(false);this.photoError.set('Selecciona una foto o utiliza un icono.');return;}
    if(this.photoError()){this.loading.set(false);return;}
    this.error.set(null);
    this.success.set(null);

    let photo:File|null=null;
    try {if(this.identityMode()==='photo' && this.selectedPhoto)photo=await this.croppedPhoto();}
    catch {this.loading.set(false);this.photoError.set('No se pudo preparar la foto. Vuelve a seleccionarla.');return;}
    const payload=(data:Record<string,any>):any=>{
      data['eliminar_foto']=this.identityMode()==='icon' || !this.photoPreview();
      if(!photo)return data;
      const body=new FormData();Object.entries(data).forEach(([key,value])=>{if(value!==null&&value!==undefined)body.append(key,typeof value==='boolean'?(value?'1':'0'):String(value));});body.append('foto',photo);return body;
    };

    if (this.isEdit()) {
      const updateData = {
        nombre: this.form.value.nombre.trim(),
        codigo_interno: this.form.value.codigo_interno.trim(),
        descripcion: this.form.value.descripcion?.trim() || null,
        icono: this.form.value.icono || null,
        publico: this.form.value.publico || false,
      };

      this.deptoService.update(this.departamentoId()!, payload(updateData)).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: () => {
          this.success.set(this.translate.instant('departamentos.form.success.updated'));
          setTimeout(() => {
            this.router.navigate(['/admin/departamentos', this.departamentoId()]);
          }, 1000);
        },
        error: (err) => {
          this.loading.set(false);
          this.error.set(this.getErrorMessage(err));
        },
      });
    } else {
      const createData = {
        nombre: this.form.value.nombre.trim(),
        codigo_interno: this.form.value.codigo_interno.trim(),
        descripcion: this.form.value.descripcion?.trim() || null,
        icono: this.form.value.icono || null,
        publico: this.form.value.publico || false,
      };

      this.deptoService.create(payload(createData)).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: (departamento) => {
          this.success.set(this.translate.instant('departamentos.form.success.created'));
          setTimeout(() => {
            this.router.navigate(['/admin/departamentos', departamento.id]);
          }, 1000);
        },
        error: (err) => {
          this.loading.set(false);
          this.error.set(this.getErrorMessage(err));
        },
      });
    }
  }

  private getErrorMessage(err: any): string {
    if (err.error?.message) {
      return err.error.message;
    }
    if (err.error?.errors) {
      const errors = Object.values(err.error.errors).flat();
      return errors.join('. ');
    }
    if (err.status === 422) {
      return this.translate.instant('departamentos.form.errors.validationError');
    }
    if (err.status === 403) {
      return this.translate.instant('departamentos.form.errors.permissionDenied');
    }
    if (err.status === 0) {
      return this.translate.instant('departamentos.form.errors.connectionError');
    }
    return this.translate.instant('departamentos.form.errors.unexpectedError');
  }
}
