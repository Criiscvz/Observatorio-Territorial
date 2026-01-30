import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { Router } from '@angular/router';

const TOKEN_KEY = 'auth_token';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const token = typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;

  // Clonar request con token si existe
  if (token) {
    req = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      }
    });
  } else {
    req = req.clone({
      setHeaders: {
        Accept: 'application/json',
      }
    });
  }

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401) {
        // Token expirado o inválido
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem('auth_user');
        router.navigate(['/auth/login']);
      }
      return throwError(() => error);
    })
  );
};
