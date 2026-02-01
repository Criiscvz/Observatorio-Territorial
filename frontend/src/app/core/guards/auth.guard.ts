import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { map, catchError, of } from 'rxjs';

/**
 * Guard que protege rutas que requieren autenticación.
 * Verifica si el usuario tiene un token válido y opcionalmente valida con el backend.
 */
export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Si no hay token, redirigir a login
  if (!authService.isAuthenticated()) {
    router.navigate(['/auth/login']);
    return false;
  }

  // Si ya tenemos el usuario en memoria, permitir acceso
  if (authService.user()) {
    return true;
  }

  // Si hay token pero no usuario, validar con el backend
  return authService.checkAuth().pipe(
    map((isValid) => {
      if (!isValid) {
        router.navigate(['/auth/login']);
        return false;
      }
      return true;
    }),
    catchError(() => {
      router.navigate(['/auth/login']);
      return of(false);
    })
  );
};

/**
 * Guard que protege rutas públicas (login, register).
 * Redirige a dashboard si el usuario ya está autenticado.
 */
export const guestGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isAuthenticated()) {
    return true;
  }

  router.navigate(['/admin/dashboard']);
  return false;
};
