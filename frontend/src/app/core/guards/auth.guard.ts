import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { AuthService } from '../services/auth.service';

/**
 * Guard que protege rutas que requieren autenticacion.
 */
export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isAuthenticated()) {
    router.navigate(['/auth/login']);
    return false;
  }

  if (authService.user()) {
    return true;
  }

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
    }),
  );
};

/**
 * Guard que protege rutas publicas de autenticacion.
 */
export const guestGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isAuthenticated()) {
    return true;
  }

  const redirectAuthenticatedUser = (): false => {
    if (authService.isAdmin() || authService.isEditor()) {
      router.navigate(['/admin/dashboard']);
    } else {
      router.navigate(['/publico/departamentos']);
    }
    return false;
  };

  if (authService.user()) {
    return redirectAuthenticatedUser();
  }

  return authService.checkAuth().pipe(
    map((isValid) => (isValid ? redirectAuthenticatedUser() : true)),
    catchError(() => of(true)),
  );
};
