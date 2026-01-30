import { Injectable, inject, signal, computed } from '@angular/core';
import { GetDepartamentosUseCase } from '../../core/domain/usecases/departamento';
import { DepartamentoEntity, DatasetEntity } from '../../core/domain/entities';

@Injectable({ providedIn: 'root' })
export class DashboardViewModel {
  private readonly getDepartamentosUseCase = inject(GetDepartamentosUseCase);

  // State
  readonly departamentos = signal<DepartamentoEntity[]>([]);
  readonly isLoading = signal(false);
  readonly error = signal<string | null>(null);

  // Computed
  readonly totalDepartamentos = computed(() => this.departamentos().length);
  
  readonly totalDatasets = computed(() => 
    this.departamentos().reduce((acc, dep) => acc + (dep.datasets?.length || 0), 0)
  );
  
  readonly totalRegistros = computed(() => 
    this.departamentos().reduce((acc, dep) => 
      acc + (dep.datasets?.reduce((sum, ds) => sum + (ds.total_registros || 0), 0) || 0), 0)
  );
  
  readonly departamentosPublicos = computed(() => 
    this.departamentos().filter(d => d.publico).length
  );
  
  readonly departamentosRecientes = computed(() => 
    [...this.departamentos()]
      .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
      .slice(0, 5)
  );
  
  readonly datasetsRecientes = computed(() => {
    const allDatasets: (DatasetEntity & { departamento_nombre?: string })[] = [];
    this.departamentos().forEach(dep => {
      dep.datasets?.forEach(ds => {
        allDatasets.push({ ...ds, departamento_nombre: dep.nombre });
      });
    });
    return allDatasets
      .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
      .slice(0, 5);
  });

  loadDepartamentos(): void {
    this.isLoading.set(true);
    this.error.set(null);

    this.getDepartamentosUseCase.execute().subscribe({
      next: (data) => {
        this.departamentos.set(data);
        this.isLoading.set(false);
      },
      error: (err) => {
        this.error.set(err.error?.message || 'Error al cargar departamentos');
        this.isLoading.set(false);
      },
    });
  }
}
