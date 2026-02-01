import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
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
  ],
  templateUrl: './departamento-form.component.html',
  styleUrl: './departamento-form.component.scss',
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
    icono: [''],
    publico: [false],
  });

  // Lista de iconos disponibles de Material Icons
  availableIcons = [
    { value: 'groups', label: 'Social / Grupos' },
    { value: 'work', label: 'Laboral / Trabajo' },
    { value: 'how_to_vote', label: 'Electoral / Voto' },
    { value: 'flight_takeoff', label: 'Turístico / Viajes' },
    { value: 'school', label: 'Educación' },
    { value: 'health_and_safety', label: 'Salud' },
    { value: 'agriculture', label: 'Agricultura' },
    { value: 'engineering', label: 'Ingeniería' },
    { value: 'account_balance', label: 'Finanzas / Gobierno' },
    { value: 'eco', label: 'Medio Ambiente' },
    { value: 'local_hospital', label: 'Hospital / Médico' },
    { value: 'science', label: 'Ciencia' },
    { value: 'sports', label: 'Deportes' },
    { value: 'construction', label: 'Construcción' },
    { value: 'storefront', label: 'Comercio' },
    { value: 'directions_car', label: 'Transporte' },
    { value: 'public', label: 'Público / Global' },
    { value: 'security', label: 'Seguridad' },
    { value: 'gavel', label: 'Legal / Justicia' },
    { value: 'family_restroom', label: 'Familia' },
  ];

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
          icono: departamento.icono || '',
          publico: departamento.publico,
        });
      },
    });
  }

  getIconLabel(value: string): string {
    const icon = this.availableIcons.find((i) => i.value === value);
    return icon?.label || value;
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
        icono: this.form.value.icono || null,
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
