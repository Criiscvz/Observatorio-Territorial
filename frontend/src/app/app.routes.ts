import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { ADMIN_ROUTES, AUTH_ROUTES, PUBLIC_ROUTES } from './routes';

export const routes: Routes = [
  // Landing page (Home)
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () =>
      import('./features/public/public-home/public-home.component').then(
        (m) => m.PublicHomeComponent,
      ),
    title: 'Inicio - Observatorio',
  },

  // Public routes with public layout
  {
    path: 'publico',
    loadComponent: () =>
      import('./features/public/public-layout/public-layout.component').then(
        (m) => m.PublicLayoutComponent,
      ),
    children: PUBLIC_ROUTES,
  },

  // Authentication routes
  {
    path: 'auth',
    children: AUTH_ROUTES,
  },

  // Profile route (protected)
  {
    path: 'perfil',
    loadComponent: () =>
      import('./features/profile/profile.component').then((m) => m.ProfileComponent),
    canActivate: [authGuard],
    title: 'Mi Perfil - Observatorio',
  },

  // Protected admin routes with main layout
  {
    path: 'admin',
    loadComponent: () =>
      import('./shared/components/layout/main-layout.component').then((m) => m.MainLayoutComponent),
    canActivate: [authGuard],
    children: ADMIN_ROUTES,
  },

  // Fallback - redirect to home
  {
    path: '**',
    redirectTo: '',
  },
];
