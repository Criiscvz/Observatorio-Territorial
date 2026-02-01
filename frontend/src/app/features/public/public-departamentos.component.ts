import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RouterLink } from '@angular/router';
import { Departamento } from '@core/models';
import { DepartamentoService } from '@core/services/departamento.service';

@Component({
  selector: 'app-public-departamentos',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatChipsModule,
  ],
  templateUrl: './public-departamentos.component.html',
  styleUrl: './public-departamentos.component.scss',
})
export class PublicDepartamentosComponent implements OnInit {
  private deptoService = inject(DepartamentoService);

  departamentos = signal<Departamento[]>([]);
  filteredDepartamentos = signal<Departamento[]>([]);
  loading = signal(true);
  searchTerm = '';

  private deptoGradients = [
    'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)',
    'linear-gradient(135deg, #EC4899 0%, #DB2777 100%)',
    'linear-gradient(135deg, #14B8A6 0%, #0D9488 100%)',
    'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
    'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)',
    'linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)',
    'linear-gradient(135deg, #06B6D4 0%, #0891B2 100%)',
    'linear-gradient(135deg, #84CC16 0%, #65A30D 100%)',
  ];

  ngOnInit(): void {
    this.loadDepartamentos();
  }

  loadDepartamentos(): void {
    this.deptoService.getPublicos().subscribe({
      next: (deptos) => {
        this.departamentos.set(deptos || []);
        this.filteredDepartamentos.set(deptos || []);
        this.loading.set(false);
      },
      error: () => {
        this.departamentos.set([]);
        this.filteredDepartamentos.set([]);
        this.loading.set(false);
      },
    });
  }

  filterDepartamentos(): void {
    const term = this.searchTerm.toLowerCase().trim();
    if (!term) {
      this.filteredDepartamentos.set(this.departamentos());
      return;
    }

    const filtered = this.departamentos().filter(
      (d) =>
        d.nombre.toLowerCase().includes(term) ||
        (d.descripcion && d.descripcion.toLowerCase().includes(term)),
    );
    this.filteredDepartamentos.set(filtered);
  }

  clearSearch(): void {
    this.searchTerm = '';
    this.filteredDepartamentos.set(this.departamentos());
  }

  getDeptoGradient(index: number): string {
    return this.deptoGradients[index % this.deptoGradients.length];
  }
}
