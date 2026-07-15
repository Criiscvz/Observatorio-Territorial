import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { UserRole } from '../models';
import { AuthService } from '../services/auth.service';

/**
 * Guard que verifica si el usuario tiene rol ADMIN.
 */
export const adminGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAdmin()) {
    return true;
  }

  if (!authService.isAuthenticated()) {
    router.navigate(['/auth/login']);
    return false;
  }

  if (!authService.user()) {
    return authService.checkAuth().pipe(
      map((isValid) => {
        if (isValid && authService.isAdmin()) {
          return true;
        }
        router.navigate(['/admin/dashboard']);
        return false;
      }),
      catchError(() => {
        router.navigate(['/auth/login']);
        return of(false);
      }),
    );
  }

  router.navigate(['/admin/dashboard']);
  return false;
};

/**
 * Guard configurable que verifica si el usuario tiene alguno de los roles especificados.
 */
export function roleGuard(...allowedRoles: UserRole[]): CanActivateFn {
  return () => {
    const authService = inject(AuthService);
    const router = inject(Router);

    if (authService.hasAnyRole(allowedRoles)) {
      return true;
    }

    if (authService.isAuthenticated() && !authService.user()) {
      return authService.checkAuth().pipe(
        map((isValid) => {
          if (isValid && authService.hasAnyRole(allowedRoles)) {
            return true;
          }
          const userRole = authService.userRole();
          router.navigate([userRole ? '/admin/dashboard' : '/auth/login']);
          return false;
        }),
        catchError(() => {
          router.navigate(['/auth/login']);
          return of(false);
        }),
      );
    }

    const userRole = authService.userRole();
    router.navigate([userRole ? '/admin/dashboard' : '/auth/login']);
    return false;
  };
}
