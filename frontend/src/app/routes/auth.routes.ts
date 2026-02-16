import { Routes } from '@angular/router';
import { guestGuard } from '../core/guards/auth.guard';

export const AUTH_ROUTES: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('../features/auth/login/login.component').then((m) => m.LoginComponent),
    canActivate: [guestGuard],
    title: 'Iniciar Sesión - Observatorio',
  },
  {
    path: 'register',
    loadComponent: () =>
      import('../features/auth/register/register.component').then((m) => m.RegisterComponent),
    canActivate: [guestGuard],
    title: 'Registro - Observatorio',
  },
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full',
  },
];
