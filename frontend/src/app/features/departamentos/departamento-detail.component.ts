import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { DepartamentoService } from '../../core/services/departamento.service';
import { Departamento, Dataset } from '../../core/models';

@Component({
  selector: 'app-departamento-detail',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './departamento-detail.component.html',
  styleUrl: './departamento-detail.component.scss'
})
export class DepartamentoDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly deptoService = inject(DepartamentoService);

  departamento = signal<Departamento | null>(null);
  datasets = signal<Dataset[]>([]);
  loading = signal(true);

  ngOnInit(): void {
    const id = this.route.snapshot.params['id'];
    this.loadDepartamento(id);
  }

  loadDepartamento(id: string): void {
    this.deptoService.getById(id).subscribe({
      next: (departamento) => {
        this.departamento.set(departamento);
        this.datasets.set(departamento?.datasets || []);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  getEstadoClass(estado: string): string {
    switch (estado) {
      case 'COMPLETADO': return 'bg-green-100 text-green-800';
      case 'PROCESANDO': return 'bg-yellow-100 text-yellow-800';
      case 'ERROR': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  }
}
