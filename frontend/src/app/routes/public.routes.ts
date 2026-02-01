import { Routes } from '@angular/router';

export const PUBLIC_ROUTES: Routes = [
  {
    path: 'departamentos',
    loadComponent: () =>
      import('../features/public/public-departamentos/public-departamentos.component').then(
        (m) => m.PublicDepartamentosComponent,
      ),
    title: 'Departamentos - Observatorio',
  },
  {
    path: 'departamentos/:id',
    loadComponent: () =>
      import('../features/public/public-departamento-detail/public-departamento-detail.component').then(
        (m) => m.PublicDepartamentoDetailComponent,
      ),
    title: 'Detalle del Departamento - Observatorio',
  },
  {
    path: 'datasets/:id',
    loadComponent: () =>
      import('../features/public/public-dataset-view/public-dataset-view.component').then(
        (m) => m.PublicDatasetViewComponent,
      ),
    title: 'Visualización de Dataset - Observatorio',
  },
  {
    path: '',
    redirectTo: 'departamentos',
    pathMatch: 'full',
  },
];
