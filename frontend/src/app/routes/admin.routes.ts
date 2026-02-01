import { Routes } from '@angular/router';
import { adminGuard } from '../core/guards/role.guard';

export const ADMIN_ROUTES: Routes = [
  // Dashboard
  {
    path: '',
    redirectTo: 'dashboard',
    pathMatch: 'full',
  },
  {
    path: 'dashboard',
    loadComponent: () =>
      import('../features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
    title: 'Dashboard - Panel de Administración',
  },

  // Departamentos
  {
    path: 'departamentos/nuevo',
    loadComponent: () =>
      import('../features/departamentos/departamento-form.component').then(
        (m) => m.DepartamentoFormComponent,
      ),
    canActivate: [adminGuard],
    title: 'Nuevo Departamento - Panel de Administración',
  },
  {
    path: 'departamentos/:id/editar',
    loadComponent: () =>
      import('../features/departamentos/departamento-form.component').then(
        (m) => m.DepartamentoFormComponent,
      ),
    canActivate: [adminGuard],
    title: 'Editar Departamento - Panel de Administración',
  },
  {
    path: 'departamentos/:id',
    loadComponent: () =>
      import('../features/departamentos/departamento-detail.component').then(
        (m) => m.DepartamentoDetailComponent,
      ),
    title: 'Detalle del Departamento - Panel de Administración',
  },

  // Datasets
  {
    path: 'datasets',
    loadComponent: () =>
      import('../features/datasets/dataset-list.component').then((m) => m.DatasetListComponent),
    title: 'Datasets - Panel de Administración',
  },
  {
    path: 'datasets/nuevo',
    loadComponent: () =>
      import('../features/datasets/dataset-upload.component').then((m) => m.DatasetUploadComponent),
    canActivate: [adminGuard],
    title: 'Subir Dataset - Panel de Administración',
  },
  {
    path: 'datasets/:id',
    loadComponent: () =>
      import('../features/datasets/dataset-view.component').then((m) => m.DatasetViewComponent),
    title: 'Visualización de Dataset - Panel de Administración',
  },
];
