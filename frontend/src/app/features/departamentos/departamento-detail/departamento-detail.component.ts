import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { Dataset, Departamento } from '@core/models';
import { DepartamentoService } from '@core/services/departamento.service';

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
    TranslateModule,
  ],
  templateUrl: './departamento-detail.component.html',
  styleUrl: './departamento-detail.component.scss',
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
      error: () => this.loading.set(false),
    });
  }

  getEstadoClass(estado: string): string {
    switch (estado) {
      case 'COMPLETADO':
        return 'badge-success';
      case 'PROCESANDO':
        return 'badge-warning';
      case 'ERROR':
        return 'badge-error';
      default:
        return 'badge-neutral';
    }
  }
}
