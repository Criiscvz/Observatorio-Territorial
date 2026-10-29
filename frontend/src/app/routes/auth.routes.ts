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
    path: 'verificar-correo',
    loadComponent: () => import('../features/auth/verify-email/verify-email.component').then((m) => m.VerifyEmailComponent),
    title: 'Verifica tu correo - Observatorio',
  },
  {
    path: 'google/callback',
    loadComponent: () => import('../features/auth/google-callback/google-callback.component').then((m) => m.GoogleCallbackComponent),
    title: 'Acceso con Google - Observatorio',
  },
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full',
  },
];
