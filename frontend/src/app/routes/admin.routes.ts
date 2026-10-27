import { Routes } from '@angular/router';
import { adminGuard, roleGuard } from '../core/guards/role.guard';
import { publicationDraftGuard } from '../core/guards/publication-draft.guard';

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
      import('../features/admin-workspace/admin-workspace.component').then((m) => m.WorkspaceEntryComponent),
    title: 'Dashboard - Observatorio',
  },

  {path:'publicaciones/nueva',canActivate:[roleGuard('ADMIN','EDITOR','ADMIN_OBSERVATORIO')],canDeactivate:[publicationDraftGuard],loadComponent:()=>import('../features/admin-workspace/publication-destination.component').then(m=>m.PublicationDestinationComponent),title:'Nueva publicación - Observatorio'},
  {path:'publicaciones',canActivate:[roleGuard('ADMIN','EDITOR','ADMIN_OBSERVATORIO')],loadComponent:()=>import('../features/admin-workspace/admin-workspace.component').then(m=>m.WorkspacePublicationsComponent),title:'Publicaciones - Observatorio'},
  {path:'configuracion',canActivate:[adminGuard],loadComponent:()=>import('../features/admin-workspace/admin-workspace.component').then(m=>m.SiteSettingsComponent),title:'Configuración del sitio - Observatorio'},
  // Departamentos
  {
    path: 'departamentos',
    canActivate: [roleGuard('ADMIN','EDITOR','ADMIN_OBSERVATORIO')],
    loadComponent: () =>
      import('../features/departamentos/departamento-list/departamento-list.component').then(
        (m) => m.DepartamentoListComponent,
      ),
    title: 'Gestión de Observatorios - Observatorio',
  },
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
    canActivate: [roleGuard('ADMIN','USER','SUBSCRIBER')],
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
    canActivate: [adminGuard],
    title: 'Subir Dataset - Observatorio',
  },
  {
      path: 'atlas/categorias', pathMatch: 'full', redirectTo: 'atlas',
    },
    {
      path: 'atlas/categorias/:categoria',
      loadComponent: () => import('../features/public/public-atlas/atlas-workspace.component').then(m => m.AtlasWorkspaceComponent),
      canActivate: [adminGuard], title: 'Categoría de Atlas - Observatorio',
  },
  {
    path: 'atlas',
    loadComponent: () =>
        import('../features/public/public-atlas/atlas-workspace.component').then(
          (m) => m.AtlasWorkspaceComponent,
      ),
    canActivate: [adminGuard],
    title: 'Gestión de Atlas - Observatorio',
  },
  {
    path: 'atlas/subir',
    loadComponent: () =>
        import('../features/public/public-atlas/atlas-workspace.component').then(
          (m) => m.AtlasWorkspaceComponent,
      ),
    canActivate: [adminGuard],
      title: 'Agregar enlace de Atlas - Observatorio',
  },
  {
    path: 'datasets/:id',
    canActivate: [roleGuard('ADMIN','USER','SUBSCRIBER')],
    loadComponent: () =>
      import('../features/datasets/dataset-view/dataset-view.component').then(
        (m) => m.DatasetViewComponent,
      ),
    title: 'Visualización de Dataset - Observatorio',
  },
  {
    path: 'datasets/:id/variable/:variableId',
    canActivate: [roleGuard('ADMIN','USER','SUBSCRIBER')],
    loadComponent: () =>
      import('../features/datasets/admin-variable-analysis/admin-variable-analysis.component').then(
        (m) => m.AdminVariableAnalysisComponent,
      ),
    title: 'Análisis de Variable - Observatorio',
  },

  // Usuarios (solo admin)
  {
    path: 'usuarios',
    canActivate: [roleGuard('ADMIN', 'ADMIN_OBSERVATORIO')],
    loadComponent: () =>
      import('../features/usuarios/usuario-list/usuario-list.component').then(
        (m) => m.UsuarioListComponent,
      ),
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
        (m) => m.AdminPermissionsComponent,
      ),
    canActivate: [roleGuard('ADMIN', 'ADMIN_OBSERVATORIO')],
    title: 'Permisos de Roles - Observatorio',
  },
];
