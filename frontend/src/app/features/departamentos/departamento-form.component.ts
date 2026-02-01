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
  templateUrl: './departamento-form.component.html',
  styleUrl: './departamento-form.component.scss'
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
