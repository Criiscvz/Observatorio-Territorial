import { Routes } from '@angular/router';

export const PUBLIC_ROUTES: Routes = [
  {
    path: 'departamentos',
    loadComponent: () =>
      import('../features/public/public-departamentos/public-departamentos.component').then(
        (m) => m.PublicDepartamentosComponent,
      ),
    title: 'Observatorios - Observatorio ULEAM',
  },
  {
    path: 'departamentos/:id',
    loadComponent: () =>
      import('../features/public/public-departamento-detail/public-departamento-detail.component').then(
        (m) => m.PublicDepartamentoDetailComponent,
      ),
    title: 'Detalle de Observatorio - Observatorio ULEAM',
  },
  {
    path: 'datasets',
    loadComponent: () =>
      import('../features/public/public-datasets/public-datasets.component').then(
        (m) => m.PublicDatasetsComponent,
      ),
    title: 'Datasets - Observatorio ULEAM',
  },
  {
    path: 'datasets/:id',
    loadComponent: () =>
      import('../features/public/public-dataset-view/public-dataset-view.component').then(
        (m) => m.PublicDatasetViewComponent,
      ),
    title: 'Visualización de Dataset - Observatorio ULEAM',
  },
  {
    path: 'barometro/:codigo',
    loadComponent: () =>
      import('../features/public/barometer-view/barometer-view.component').then(
        (m) => m.BarometerViewComponent,
      ),
    title: 'Barómetro - Observatorio ULEAM',
  },
  {
    path: '',
    redirectTo: 'departamentos',
    pathMatch: 'full',
  },
];
