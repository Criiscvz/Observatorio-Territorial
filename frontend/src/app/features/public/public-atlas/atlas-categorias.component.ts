import {
  Component,
  DestroyRef,
  OnInit,
  TemplateRef,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import {
  ATLAS_CATEGORY_ICONS,
  atlasCategoryPresentation,
} from '@core/utils/atlas-category-presentation';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar } from '@angular/material/snack-bar';
import { tap } from 'rxjs';
import { RouterLink } from '@angular/router';
import { AtlasCategoria, AtlasCategoriaService } from '@core/services/atlas-categoria.service';
import {
  ConfirmDialogComponent,
  ConfirmDialogData,
} from '@shared/components/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-atlas-categorias',
  standalone: true,
  imports: [
    RouterLink,
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './atlas-categorias.component.html',
  styleUrl: './atlas-categorias.component.scss',
})
export class AtlasCategoriasComponent implements OnInit {
  private readonly service = inject(AtlasCategoriaService);
  private readonly dialog = inject(MatDialog);
  private readonly snackbar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);
  @ViewChild('categoryEditor') private categoryEditor?: TemplateRef<unknown>;
  private editorRef?: MatDialogRef<unknown>;
  readonly categoryVisual = atlasCategoryPresentation;
  readonly availableIcons = ATLAS_CATEGORY_ICONS;
  readonly categorias = signal<AtlasCategoria[]>([]);
  readonly search = signal('');
  readonly filteredCategorias = computed(() => {
    const normalize = (value: string) =>
      value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLocaleLowerCase('es')
        .trim();
    const query = normalize(this.search());
    return this.categorias().filter((item) =>
      normalize(`${item.nombre} ${item.descripcion ?? ''}`).includes(query),
    );
  });
  readonly editing = signal<string | undefined>(undefined);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly deleting = signal(false);
  readonly error = signal('');
  readonly form = inject(FormBuilder).nonNullable.group({
    nombre: ['', [Validators.required, Validators.pattern(/\S/), Validators.maxLength(150)]],
    descripcion: ['', Validators.maxLength(3000)],
    icono: [''],
    publico: [false],
  });

  ngOnInit(): void {
    this.load();
  }
  iconLabel(value: string): string {
    return (
      this.availableIcons.find((icon) => icon.value === value)?.label ??
      'Automático según el nombre'
    );
  }
  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.service
      .list()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (items) => {
          this.categorias.set(items);
          this.loading.set(false);
        },
        error: () => {
          this.error.set('No se pudieron cargar las categorías. Intenta actualizar.');
          this.loading.set(false);
        },
      });
  }
  create(): void {
    this.reset();
    this.openEditor();
  }
  edit(item: AtlasCategoria): void {
    this.editing.set(item.id);
    this.form.setValue({
      nombre: item.nombre,
      descripcion: item.descripcion ?? '',
      icono: item.icono ?? '',
      publico: item.publico ?? true,
    });
    this.error.set('');
    this.openEditor();
  }
  reset(): void {
    this.editing.set(undefined);
    this.form.reset();
    this.error.set('');
    this.editorRef?.close();
  }
  private openEditor(): void {
    if (!this.categoryEditor || this.editorRef || this.saving() || this.deleting()) return;
    this.editorRef = this.dialog.open(this.categoryEditor, {
      width: '600px',
      maxWidth: 'calc(100vw - 32px)',
      ariaLabelledBy: 'category-editor-title',
      autoFocus: 'input',
    });
    this.editorRef
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.editorRef = undefined;
        this.editing.set(undefined);
        this.form.reset();
        this.error.set('');
      });
  }
  save(): void {
    if (this.saving() || this.deleting()) return;
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.saving.set(true);
    if (this.editorRef) this.editorRef.disableClose = true;
    this.error.set('');
    const values = this.form.getRawValue();
    this.service
      .save(
        {
          nombre: values.nombre.trim().replace(/\s+/g, ' '),
          descripcion: values.descripcion.trim() || null,
          icono: values.icono || null,
          publico: values.publico,
        },
        this.editing(),
      )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.saving.set(false);
          this.reset();
          this.load();
          this.snackbar.open(response.message, 'Cerrar', { duration: 4000 });
        },
        error: (error) => {
          this.saving.set(false);
          if (this.editorRef) this.editorRef.disableClose = false;
          this.error.set(this.message(error));
        },
      });
  }
  remove(item: AtlasCategoria): void {
    if (this.deleting() || this.saving()) return;
    this.deleting.set(true);
    const data: ConfirmDialogData = {
      title: 'Eliminar categoría',
      message: `¿Estás seguro de que deseas eliminar la categoría «${item.nombre}»?`,
      cancelText: 'Cancelar',
      confirmText: 'Eliminar categoría',
      confirmColor: 'warn',
      icon: 'delete',
      confirmAction: () =>
        this.service.delete(item.id).pipe(
          tap((response) => {
            if (this.editing() === item.id) this.reset();
            this.load();
            this.snackbar.open(response.message, 'Cerrar', { duration: 4000 });
          }),
        ),
      onError: (error) => {
        this.error.set(this.message(error));
        this.snackbar.open(this.message(error), 'Cerrar', { duration: 7000 });
      },
    };
    this.dialog
      .open(ConfirmDialogComponent, {
        width: 'min(540px, calc(100vw - 32px))',
        maxWidth: 'calc(100vw - 32px)',
        panelClass: 'app-confirm-dialog-panel',
        backdropClass: 'app-confirm-dialog-backdrop',
        data,
      })
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.deleting.set(false));
  }
  private message(error: any): string {
    if (error?.status === 422) {
      const first = Object.values(error.error?.errors ?? {}).flat()[0];
      return typeof first === 'string' ? first : 'Revisa los datos de la categoría.';
    }
    if (error?.status === 409)
      return error.error?.message || 'La categoría tiene contenido asociado.';
    if (error?.status === 403 || error?.status === 401)
      return 'Necesitas una sesión de administrador para gestionar categorías.';
    return 'No se pudo completar la operación. Inténtalo de nuevo.';
  }
}
