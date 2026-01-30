import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  // Rutas públicas de autenticación
  {
    path: 'auth',
    children: [
      {
        path: 'login',
        loadComponent: () => import('./features/auth/login.component').then(m => m.LoginComponent),
        canActivate: [guestGuard]
      },
      {
        path: 'register',
        loadComponent: () => import('./features/auth/register.component').then(m => m.RegisterComponent),
        canActivate: [guestGuard]
      },
      { path: '', redirectTo: 'login', pathMatch: 'full' }
    ]
  },

  // Rutas protegidas con layout principal
  {
    path: '',
    loadComponent: () => import('./shared/components/layout/main-layout.component').then(m => m.MainLayoutComponent),
    canActivate: [authGuard],
    children: [
      {
        path: 'dashboard',
        loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent)
      },
      {
        path: 'departamentos/nuevo',
        loadComponent: () => import('./features/departamentos/departamento-form.component').then(m => m.DepartamentoFormComponent)
      },
      {
        path: 'departamentos/:id/editar',
        loadComponent: () => import('./features/departamentos/departamento-form.component').then(m => m.DepartamentoFormComponent)
      },
      {
        path: 'departamentos/:id',
        loadComponent: () => import('./features/departamentos/departamento-detail.component').then(m => m.DepartamentoDetailComponent)
      },
      {
        path: 'datasets',
        loadComponent: () => import('./features/datasets/dataset-list.component').then(m => m.DatasetListComponent)
      },
      {
        path: 'datasets/nuevo',
        loadComponent: () => import('./features/datasets/dataset-upload.component').then(m => m.DatasetUploadComponent)
      },
      {
        path: 'datasets/:id',
        loadComponent: () => import('./features/datasets/dataset-view.component').then(m => m.DatasetViewComponent)
      },
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' }
    ]
  },

  // Fallback
  { path: '**', redirectTo: 'auth/login' }
];
