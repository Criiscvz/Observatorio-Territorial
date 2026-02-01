import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/guards/auth.guard';
import { adminGuard } from './core/guards/role.guard';

export const routes: Routes = [
  // Landing page pública (Home)
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./features/public/public-home.component').then(m => m.PublicHomeComponent)
  },

  // Rutas públicas con layout público
  {
    path: 'publico',
    loadComponent: () => import('./features/public/public-layout.component').then(m => m.PublicLayoutComponent),
    children: [
      {
        path: 'departamentos',
        loadComponent: () => import('./features/public/public-departamentos.component').then(m => m.PublicDepartamentosComponent)
      },
      {
        path: 'departamentos/:id',
        loadComponent: () => import('./features/public/public-departamento-detail.component').then(m => m.PublicDepartamentoDetailComponent)
      },
      {
        path: 'datasets/:id',
        loadComponent: () => import('./features/public/public-dataset-view.component').then(m => m.PublicDatasetViewComponent)
      },
      { path: '', redirectTo: 'departamentos', pathMatch: 'full' }
    ]
  },

  // Rutas de autenticación
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

  // Rutas protegidas con layout principal (Panel de administración)
  {
    path: '',
    loadComponent: () => import('./shared/components/layout/main-layout.component').then(m => m.MainLayoutComponent),
    canActivate: [authGuard],
    children: [
      // === RUTAS PARA TODOS LOS USUARIOS AUTENTICADOS ===
      {
        path: 'dashboard',
        loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent)
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
        path: 'datasets/:id',
        loadComponent: () => import('./features/datasets/dataset-view.component').then(m => m.DatasetViewComponent)
      },
      
      // === RUTAS SOLO PARA ADMIN ===
      {
        path: 'departamentos/nuevo',
        loadComponent: () => import('./features/departamentos/departamento-form.component').then(m => m.DepartamentoFormComponent),
        canActivate: [adminGuard]
      },
      {
        path: 'departamentos/:id/editar',
        loadComponent: () => import('./features/departamentos/departamento-form.component').then(m => m.DepartamentoFormComponent),
        canActivate: [adminGuard]
      },
      {
        path: 'datasets/nuevo',
        loadComponent: () => import('./features/datasets/dataset-upload.component').then(m => m.DatasetUploadComponent),
        canActivate: [adminGuard]
      }
    ]
  },

  // Fallback
  { path: '**', redirectTo: '' }
];
