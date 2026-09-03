import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const authService = inject(AuthService);
  const token = authService.getToken();

  // Clonar request con headers comunes
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };

  // Agregar token si existe
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  req = req.clone({ setHeaders: headers });

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401) {
        // Token expirado o inválido - limpiar autenticación
        authService.clearAuthSilent();
        router.navigate(['/auth/login']);
      } else if (error.status === 403 && !!token) {
        // Sin permisos - redirigir a dashboard
        router.navigate(['/admin/dashboard']);
      }
      return throwError(() => error);
    })
  );
};
