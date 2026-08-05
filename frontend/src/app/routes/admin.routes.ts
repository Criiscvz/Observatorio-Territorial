import { Routes } from '@angular/router';
import { adminGuard, roleGuard } from '../core/guards/role.guard';

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
    title: 'Dashboard - Observatorio',
  },

  // Departamentos
  {
    path: 'departamentos/nuevo',
    loadComponent: () =>
      import('../features/departamentos/departamento-form/departamento-form.component').then(
        (m) => m.DepartamentoFormComponent,
      ),
    canActivate: [adminGuard],
    title: 'Nuevo Departamento - Observatorio',
  },
  {
    path: 'departamentos/:id/editar',
    loadComponent: () =>
      import('../features/departamentos/departamento-form/departamento-form.component').then(
        (m) => m.DepartamentoFormComponent,
      ),
    canActivate: [adminGuard],
    title: 'Editar Departamento - Observatorio',
  },
  {
    path: 'departamentos/:id',
    loadComponent: () =>
      import('../features/departamentos/departamento-detail/departamento-detail.component').then(
        (m) => m.DepartamentoDetailComponent,
      ),
    title: 'Detalle del Departamento - Observatorio',
  },

  // Datasets
  {
    path: 'datasets',
    loadComponent: () =>
      import('../features/datasets/dataset-list/dataset-list.component').then(
        (m) => m.DatasetListComponent,
      ),
    title: 'Datasets - Observatorio',
  },
  {
    path: 'datasets/nuevo',
    loadComponent: () =>
      import('../features/datasets/dataset-upload/dataset-upload.component').then(
        (m) => m.DatasetUploadComponent,
      ),
    canActivate: [roleGuard('ADMIN', 'EDITOR')],
    title: 'Subir Dataset - Observatorio',
  },
  {
    path: 'atlas',
    loadComponent: () =>
      import('../features/public/public-atlas/global-atlas-management.component').then(
        (m) => m.GlobalAtlasManagementComponent,
      ),
    canActivate: [adminGuard],
    title: 'Gestión de Atlas - Observatorio',
  },
  {
    path: 'atlas/subir',
    loadComponent: () =>
      import('../features/public/public-atlas/global-atlas-upload.component').then(
        (m) => m.GlobalAtlasUploadComponent,
      ),
    canActivate: [adminGuard],
    title: 'Subir Atlas - Observatorio',
  },
  {
    path: 'datasets/:id',
    loadComponent: () =>
      import('../features/datasets/dataset-view/dataset-view.component').then(
        (m) => m.DatasetViewComponent,
      ),
    title: 'Visualización de Dataset - Observatorio',
  },
  {
    path: 'datasets/:id/variable/:variableId',
    loadComponent: () =>
      import('../features/datasets/admin-variable-analysis/admin-variable-analysis.component').then(
        (m) => m.AdminVariableAnalysisComponent,
      ),
    title: 'Análisis de Variable - Observatorio',
  },

  // Usuarios (solo admin)
  {
    path: 'usuarios',
    loadComponent: () =>
      import('../features/usuarios/usuario-list/usuario-list.component').then(
        (m) => m.UsuarioListComponent,
      ),
    canActivate: [adminGuard],
    title: 'Usuarios - Observatorio',
  },
  {
    path: 'usuarios/nuevo',
    loadComponent: () =>
      import('../features/usuarios/usuario-form/usuario-form.component').then(
        (m) => m.UsuarioFormComponent,
      ),
    canActivate: [adminGuard],
    title: 'Nuevo Usuario - Observatorio',
  },
  {
    path: 'usuarios/:id',
    loadComponent: () =>
      import('../features/usuarios/usuario-form/usuario-form.component').then(
        (m) => m.UsuarioFormComponent,
      ),
    canActivate: [adminGuard],
    title: 'Editar Usuario - Observatorio',
  },
  {
    path: 'permisos',
    loadComponent: () =>
      import('../features/permisos/admin-permissions.component').then(
        (m) => m.AdminPermissionsComponent
      ),
    canActivate: [adminGuard],
    title: 'Permisos de Roles - Observatorio',
  },
];
