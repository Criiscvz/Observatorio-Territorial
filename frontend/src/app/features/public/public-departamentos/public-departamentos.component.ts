import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Component, computed, inject, OnInit, PLATFORM_ID, signal, DestroyRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RouterLink } from '@angular/router';

import { Departamento } from '@core/models';
import { DepartamentoService } from '@core/services/departamento.service';
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";

@Component({
  selector: 'app-public-departamentos',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    FormsModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './public-departamentos.component.html',
  styleUrl: './public-departamentos.component.scss',
})
export class PublicDepartamentosComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly deptoService = inject(DepartamentoService);

  departamentos = signal<Departamento[]>([]);
  filteredDepartamentos = signal<Departamento[]>([]);
  loading = signal(true);
  searchTerm = '';
  readonly page = signal(0);
  readonly pageSize = 5;
  readonly loadError = signal(false);
  readonly pageCount = computed(() => Math.max(1, Math.ceil(this.filteredDepartamentos().length / this.pageSize)));
  readonly currentPage = computed(() => Math.min(this.page(), this.pageCount() - 1));
  readonly visible = computed(() => this.filteredDepartamentos().slice(this.currentPage() * this.pageSize, (this.currentPage() + 1) * this.pageSize));
  readonly rangeStart = computed(() => this.filteredDepartamentos().length ? this.currentPage() * this.pageSize + 1 : 0);
  readonly rangeEnd = computed(() => Math.min((this.currentPage() + 1) * this.pageSize, this.filteredDepartamentos().length));

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.loadDepartamentos();
    } else {
      this.loading.set(false);
    }
  }

  loadDepartamentos(): void {
    this.loading.set(true);
    this.loadError.set(false);
    this.deptoService.getPublicos().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (deptos) => {
        this.departamentos.set(deptos || []);
        this.filteredDepartamentos.set(deptos || []);
        this.page.set(0);
        this.loading.set(false);
      },
      error: () => {
        this.loadError.set(true);
        this.departamentos.set([]);
        this.filteredDepartamentos.set([]);
        this.loading.set(false);
      },
    });
  }

  filterDepartamentos(): void {
    this.page.set(0);
    const term = this.normalize(this.searchTerm);
    if (!term) {
      this.filteredDepartamentos.set(this.departamentos());
      return;
    }

    const filtered = this.departamentos().filter(
      (d) =>
        this.normalize(d.nombre).includes(term) ||
        (d.descripcion && this.normalize(d.descripcion).includes(term)),
    );
    this.filteredDepartamentos.set(filtered);
  }

  clearSearch(): void {
    this.searchTerm = '';
    this.page.set(0);
    this.filteredDepartamentos.set(this.departamentos());
  }

  changePage(delta: number): void {
    this.page.set(Math.max(0, Math.min(this.currentPage() + delta, this.pageCount() - 1)));
  }
  private normalize(value: string): string {
    return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es').trim();
  }
}
