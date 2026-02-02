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
import { TranslateModule, TranslateService } from '@ngx-translate/core';

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
          codigo_interno: departamento.codigo_interno,
          descripcion: departamento.descripcion,
          icono: departamento.icono || '',
          publico: departamento.publico,
        });
      },
    });
  }

  getIconLabel(value: string): string {
    const icon = this.availableIcons.find((i) => i.value === value);
    return icon ? this.translate.instant(icon.labelKey) : value;
  }

  onSubmit(): void {
    // Marcar todos los campos como touched para mostrar errores
    this.form.markAllAsTouched();

    if (this.form.invalid) {
      this.error.set(this.translate.instant('departamentos.form.errors.formInvalid'));
      return;
    }

    this.loading.set(true);
    this.error.set(null);
    this.success.set(null);

    if (this.isEdit()) {
      const updateData = {
        nombre: this.form.value.nombre.trim(),
        codigo_interno: this.form.value.codigo_interno.trim(),
        descripcion: this.form.value.descripcion?.trim() || null,
        icono: this.form.value.icono || null,
        publico: this.form.value.publico || false,
      };

      this.deptoService.update(this.departamentoId()!, updateData).subscribe({
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

      this.deptoService.create(createData).subscribe({
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
