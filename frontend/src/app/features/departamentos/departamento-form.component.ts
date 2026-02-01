import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { DepartamentoService } from '../../core/services/departamento.service';

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
  ],
  template: `
    <div class="max-w-2xl mx-auto">
      <h1 class="text-2xl font-bold text-[var(--text-primary)] mb-6">
        {{ isEdit() ? 'Editar Departamento' : 'Nuevo Departamento' }}
      </h1>

      <mat-card>
        <mat-card-content>
          @if (error()) {
            <div class="bg-[var(--error-bg)] border border-[var(--error-border)] text-[var(--error-color)] px-4 py-3 rounded mb-4">
              {{ error() }}
            </div>
          }

          @if (success()) {
            <div class="bg-[var(--success-bg)] border border-[var(--success-border)] text-[var(--success-color)] px-4 py-3 rounded mb-4">
              {{ success() }}
            </div>
          }

          <form [formGroup]="form" (ngSubmit)="onSubmit()" class="space-y-4">
            <mat-form-field class="w-full" appearance="outline">
              <mat-label>Nombre del Departamento</mat-label>
              <input matInput formControlName="nombre" placeholder="Ej: Bienestar Estudiantil" maxlength="255">
              <mat-icon matSuffix>business</mat-icon>
              <mat-hint align="end">{{ form.get('nombre')?.value?.length || 0 }}/255</mat-hint>
              @if (form.get('nombre')?.hasError('required') && form.get('nombre')?.touched) {
                <mat-error>El nombre es requerido</mat-error>
              }
              @if (form.get('nombre')?.hasError('minlength')) {
                <mat-error>El nombre debe tener al menos 3 caracteres</mat-error>
              }
              @if (form.get('nombre')?.hasError('maxlength')) {
                <mat-error>El nombre no puede exceder 255 caracteres</mat-error>
              }
            </mat-form-field>

            @if (!isEdit()) {
              <mat-form-field class="w-full" appearance="outline">
                <mat-label>Código Interno</mat-label>
                <input matInput formControlName="codigo_interno" placeholder="Ej: BIENESTAR-2024" maxlength="50">
                <mat-icon matSuffix>tag</mat-icon>
                <mat-hint>Identificador único del departamento</mat-hint>
                @if (form.get('codigo_interno')?.hasError('required') && form.get('codigo_interno')?.touched) {
                  <mat-error>El código interno es requerido</mat-error>
                }
                @if (form.get('codigo_interno')?.hasError('maxlength')) {
                  <mat-error>El código no puede exceder 50 caracteres</mat-error>
                }
              </mat-form-field>
            }

            <mat-form-field class="w-full" appearance="outline">
              <mat-label>Descripción (opcional)</mat-label>
              <textarea matInput formControlName="descripcion" rows="4" 
                        placeholder="Describe el propósito del departamento..." maxlength="1000"></textarea>
              <mat-hint align="end">{{ form.get('descripcion')?.value?.length || 0 }}/1000</mat-hint>
            </mat-form-field>

            <div class="flex items-center gap-4 pt-2">
              <mat-slide-toggle formControlName="publico" color="primary">
                Departamento Público
              </mat-slide-toggle>
            </div>
            <p class="text-sm text-[var(--text-secondary)]">
              Los departamentos públicos pueden ser vistos por usuarios externos sin autenticación.
            </p>
          </form>
        </mat-card-content>

        <mat-card-actions align="end" class="px-4 pb-4">
          <button mat-button type="button" routerLink="/admin/dashboard" [disabled]="loading()">
            Cancelar
          </button>
          <button mat-raised-button color="primary" 
                  [disabled]="form.invalid || loading()"
                  (click)="onSubmit()">
            @if (loading()) {
              <mat-spinner diameter="20" class="inline-block mr-2"></mat-spinner>
              Guardando...
            } @else {
              {{ isEdit() ? 'Guardar Cambios' : 'Crear Departamento' }}
            }
          </button>
        </mat-card-actions>
      </mat-card>
    </div>
  `
})
export class DepartamentoFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private deptoService = inject(DepartamentoService);

  form: FormGroup = this.fb.group({
    nombre: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(255)]],
    codigo_interno: ['', [Validators.required, Validators.maxLength(50)]],
    descripcion: ['', [Validators.maxLength(1000)]],
    publico: [false],
  });

  isEdit = signal(false);
  departamentoId = signal<string | null>(null);
  loading = signal(false);
  error = signal<string | null>(null);
  success = signal<string | null>(null);

  ngOnInit(): void {
    const id = this.route.snapshot.params['id'];
    if (id && id !== 'nuevo') {
      this.isEdit.set(true);
      this.departamentoId.set(id);
      this.loadDepartamento(id);
    }
  }

  loadDepartamento(id: string): void {
    this.deptoService.getById(id).subscribe({
      next: (departamento) => {
        this.form.patchValue({
          nombre: departamento.nombre,
          descripcion: departamento.descripcion,
          publico: departamento.publico,
        });
      }
    });
  }

  onSubmit(): void {
    // Marcar todos los campos como touched para mostrar errores
    this.form.markAllAsTouched();
    
    // En edición, codigo_interno no es requerido
    const isValid = this.isEdit() 
      ? this.form.get('nombre')?.valid && this.form.get('descripcion')?.valid
      : this.form.valid;
    
    if (!isValid) {
      this.error.set('Por favor, corrige los errores en el formulario');
      return;
    }

    this.loading.set(true);
    this.error.set(null);
    this.success.set(null);

    if (this.isEdit()) {
      const updateData = {
        nombre: this.form.value.nombre.trim(),
        descripcion: this.form.value.descripcion?.trim() || null,
        publico: this.form.value.publico || false,
      };
      
      this.deptoService.update(this.departamentoId()!, updateData).subscribe({
        next: () => {
          this.success.set('Departamento actualizado exitosamente');
          setTimeout(() => {
            this.router.navigate(['/admin/departamentos', this.departamentoId()]);
          }, 1000);
        },
        error: (err) => {
          this.loading.set(false);
          this.error.set(this.getErrorMessage(err));
        }
      });
    } else {
      const createData = {
        nombre: this.form.value.nombre.trim(),
        codigo_interno: this.form.value.codigo_interno.trim(),
        descripcion: this.form.value.descripcion?.trim() || null,
        publico: this.form.value.publico || false,
      };
      
      this.deptoService.create(createData).subscribe({
        next: (departamento) => {
          this.success.set('Departamento creado exitosamente');
          setTimeout(() => {
            this.router.navigate(['/admin/departamentos', departamento.id]);
          }, 1000);
        },
        error: (err) => {
          this.loading.set(false);
          this.error.set(this.getErrorMessage(err));
        }
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
      return 'Error de validación. Verifica los datos ingresados.';
    }
    if (err.status === 403) {
      return 'No tienes permisos para realizar esta acción.';
    }
    if (err.status === 0) {
      return 'Error de conexión. Verifica que el servidor esté funcionando.';
    }
    return 'Ocurrió un error inesperado. Intenta de nuevo.';
  }
}
