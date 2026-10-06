import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { environment } from '../../../environments/environment';

export function isTrustedApiUrl(requestUrl: string): boolean {
  try {
    const appOrigin = globalThis.location?.origin ?? 'http://localhost';
    const apiUrl = new URL(environment.apiUrl, appOrigin);
    const url = new URL(requestUrl, appOrigin);
    const apiPath = apiUrl.pathname.replace(/\/+$/, '') || '/';

    return (
      url.origin === apiUrl.origin &&
      (apiPath === '/' || url.pathname === apiPath || url.pathname.startsWith(`${apiPath}/`))
    );
  } catch {
    return false;
  }
}

function getXsrfToken(): string | null {
  if (typeof document === 'undefined') {
    return null;
  }

  const cookie = document.cookie
    .split('; ')
    .find((entry) => entry.startsWith('XSRF-TOKEN='));

  return cookie ? decodeURIComponent(cookie.substring('XSRF-TOKEN='.length)) : null;
}

function requiresCsrfProtection(method: string): boolean {
  return !['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase());
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const authService = inject(AuthService);

  // Clonar request con headers comunes
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };

  const isApiRequest = isTrustedApiUrl(req.url);
  const csrfToken = isApiRequest && requiresCsrfProtection(req.method) ? getXsrfToken() : null;

  if (csrfToken) {
    headers['X-XSRF-TOKEN'] = csrfToken;
  }

  req = req.clone({ setHeaders: headers, withCredentials: isApiRequest });

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (isApiRequest && error.status === 401) {
        // La navegación la resuelve el guard de la ruta. Redirigir desde aquí
        // interrumpe guestGuard al abrir /auth/login o /auth/register.
        authService.clearAuthSilent();
      } else if (isApiRequest && error.status === 403 && authService.isAuthenticated()) {
        // Sin permisos - redirigir a dashboard
        router.navigate(['/admin/dashboard']);
      }
      return throwError(() => error);
    })
  );
};
