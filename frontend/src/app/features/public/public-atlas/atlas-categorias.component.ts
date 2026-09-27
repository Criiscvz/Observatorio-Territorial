import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar } from '@angular/material/snack-bar';
import { tap } from 'rxjs';
import { RouterLink } from '@angular/router';
import { AtlasCategoria, AtlasCategoriaService } from '@core/services/atlas-categoria.service';
import { ConfirmDialogComponent, ConfirmDialogData } from '@shared/components/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-atlas-categorias',
  standalone: true,
  imports: [RouterLink, ReactiveFormsModule, MatButtonModule, MatDialogModule, MatFormFieldModule, MatInputModule],
  template: `
    <section aria-labelledby="atlas-categorias-title">
      <header><h2 id="atlas-categorias-title">Categorías de Atlas</h2>
        <button mat-stroked-button type="button" (click)="load()" [disabled]="loading() || saving() || deleting()">Actualizar categorías</button>
      </header>
      <form [formGroup]="form" (ngSubmit)="save()">
        <h3>{{ editing() ? 'Editar categoría' : 'Nueva categoría' }}</h3>
        <mat-form-field appearance="outline"><mat-label>Nombre</mat-label>
          <input matInput formControlName="nombre" maxlength="150" />
          <mat-error>Escribe un nombre de hasta 150 caracteres.</mat-error>
        </mat-form-field>
        <mat-form-field appearance="outline"><mat-label>Descripción (opcional)</mat-label>
          <textarea matInput formControlName="descripcion" rows="2" maxlength="3000"></textarea>
        </mat-form-field>
        <div class="actions">
          <button mat-flat-button type="submit" [disabled]="saving() || deleting()">{{ saving() ? 'Guardando…' : 'Guardar categoría' }}</button>
          @if (editing()) { <button mat-button type="button" [disabled]="saving()" (click)="reset()">Cancelar edición</button> }
        </div>
      </form>
      @if (error()) { <p role="alert">{{ error() }}</p> }
      @if (loading()) { <p role="status">Cargando categorías…</p> }
      @else {
        <div class="categories">
          @for (item of categorias(); track item.id) {
            <article>
              <div><h3>{{ item.nombre }}</h3><p>{{ item.descripcion || 'Sin descripción' }}</p></div>
              <div class="actions">
                <a mat-stroked-button routerLink="/admin/atlas" [queryParams]="{ categoria: item.id }">Ver archivos</a>
                <a mat-flat-button routerLink="/admin/atlas/subir" [queryParams]="{ categoria: item.id }">Subir archivo</a>
                <button mat-button type="button" [disabled]="saving() || deleting()" (click)="edit(item)">Editar</button>
                <button mat-button color="warn" type="button" [disabled]="saving() || deleting()" (click)="remove(item)">Eliminar categoría</button>
              </div>
            </article>
          } @empty { @if (!error()) { <p>No hay categorías de Atlas. Puedes crear la primera.</p> } }
        </div>
      }
    </section>
  `,
  styles: [`
    section { padding: 1.5rem; margin-bottom: 1.5rem; background: var(--bg-secondary); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 18px; }
    header, article, .actions { display: flex; align-items: center; justify-content: space-between; gap: .75rem; flex-wrap: wrap; }
    form { display: grid; gap: .5rem; max-width: 640px; margin: 1rem 0; }
    .actions { justify-content: flex-start; }
    .categories { display: grid; gap: .75rem; }
    article { border-top: 1px solid var(--border-color); padding-top: .75rem; }
    article > div { min-width: 0; }
    h3, p { overflow-wrap: anywhere; }
    p { color: var(--text-secondary); white-space: pre-wrap; }
    [role=alert] { color: var(--error-500, #c8102e); }
    @media(max-width: 600px) { section { padding: 1rem; } article { align-items: flex-start; flex-direction: column; } }
  `],
})
export class AtlasCategoriasComponent implements OnInit {
  private readonly service = inject(AtlasCategoriaService);
  private readonly dialog = inject(MatDialog);
  private readonly snackbar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);
  readonly categorias = signal<AtlasCategoria[]>([]);
  readonly editing = signal<string | undefined>(undefined);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly deleting = signal(false);
  readonly error = signal('');
  readonly form = inject(FormBuilder).nonNullable.group({
    nombre: ['', [Validators.required, Validators.pattern(/\S/), Validators.maxLength(150)]],
    descripcion: ['', Validators.maxLength(3000)],
  });

  ngOnInit(): void { this.load(); }
  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.service.list().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: items => { this.categorias.set(items); this.loading.set(false); },
      error: () => { this.error.set('No se pudieron cargar las categorías. Intenta actualizar.'); this.loading.set(false); },
    });
  }
  edit(item: AtlasCategoria): void {
    this.editing.set(item.id);
    this.form.setValue({ nombre: item.nombre, descripcion: item.descripcion ?? '' });
    this.error.set('');
  }
  reset(): void { this.editing.set(undefined); this.form.reset(); }
  save(): void {
    if (this.saving() || this.deleting()) return;
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.saving.set(true);
    this.error.set('');
    const values = this.form.getRawValue();
    this.service.save({ nombre: values.nombre.trim().replace(/\s+/g, ' '), descripcion: values.descripcion.trim() || null }, this.editing())
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: response => { this.saving.set(false); this.reset(); this.load(); this.snackbar.open(response.message, 'Cerrar', { duration: 4000 }); },
        error: error => { this.saving.set(false); this.error.set(this.message(error)); },
      });
  }
  remove(item: AtlasCategoria): void {
    if (this.deleting() || this.saving()) return;
    this.deleting.set(true);
    const data: ConfirmDialogData = {
      title: 'Eliminar categoría',
      message: `¿Estás seguro de que deseas eliminar la categoría «${item.nombre}»?`,
      cancelText: 'Cancelar', confirmText: 'Eliminar categoría', confirmColor: 'warn', icon: 'delete',
      confirmAction: () => this.service.delete(item.id).pipe(tap(response => {
        if (this.editing() === item.id) this.reset();
        this.load();
        this.snackbar.open(response.message, 'Cerrar', { duration: 4000 });
      })),
      onError: error => { this.error.set(this.message(error)); this.snackbar.open(this.message(error), 'Cerrar', { duration: 7000 }); },
    };
    this.dialog.open(ConfirmDialogComponent, {
      width: 'min(540px, calc(100vw - 32px))', maxWidth: 'calc(100vw - 32px)',
      panelClass: 'app-confirm-dialog-panel', backdropClass: 'app-confirm-dialog-backdrop', data,
    }).afterClosed().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.deleting.set(false));
  }
  private message(error: any): string {
    if (error?.status === 422) {
      const first = Object.values(error.error?.errors ?? {}).flat()[0];
      return typeof first === 'string' ? first : 'Revisa los datos de la categoría.';
    }
    if (error?.status === 409) return error.error?.message || 'La categoría tiene contenido asociado.';
    if (error?.status === 403 || error?.status === 401) return 'Necesitas una sesión de administrador para gestionar categorías.';
    return 'No se pudo completar la operación. Inténtalo de nuevo.';
  }
}
