import { Routes } from '@angular/router';

export const PUBLIC_ROUTES: Routes = [
  {
    path: 'departamentos',
    loadComponent: () =>
      import('../features/public/public-departamentos/public-departamentos.component').then(
        (m) => m.PublicDepartamentosComponent,
      ),
    title: 'Dimensiones - Dimensiones ULEAM',
  },
  {
    path: 'departamentos/:id',
    loadComponent: () =>
      import('../features/public/public-departamento-detail/public-departamento-detail.component').then(
        (m) => m.PublicDepartamentoDetailComponent,
      ),
    title: 'Detalle de Dimensión - Dimensiones ULEAM',
  },
  {
    path: 'datasets/:id',
    loadComponent: () =>
      import('../features/public/public-dataset-view/public-dataset-view.component').then(
        (m) => m.PublicDatasetViewComponent,
      ),
    title: 'Visualización de Dataset - Dimensiones ULEAM',
  },
  {
    path: 'barometro/:codigo',
    loadComponent: () =>
      import('../features/public/barometer-view/barometer-view.component').then(
        (m) => m.BarometerViewComponent,
      ),
    title: 'Barómetro - Dimensiones ULEAM',
  },
  {
    path: '',
    redirectTo: 'departamentos',
    pathMatch: 'full',
  },
];
