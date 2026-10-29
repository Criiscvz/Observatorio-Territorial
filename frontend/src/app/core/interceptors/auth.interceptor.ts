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

    // Sanctum prepares the session outside /api, on the same trusted server.
    return (
      url.origin === apiUrl.origin &&
      (url.pathname === '/sanctum/csrf-cookie' ||
        apiPath === '/' || url.pathname === apiPath || url.pathname.startsWith(`${apiPath}/`))
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
  const sessionVersion = authService.sessionVersion;

  // Clonar request con headers comunes
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };

  const isApiRequest = isTrustedApiUrl(req.url);
  if (isApiRequest) {
    // Also bypass an older worker that is still controlling this browser tab.
    headers['ngsw-bypass'] = 'true';
  }
  const csrfToken = isApiRequest && requiresCsrfProtection(req.method) ? getXsrfToken() : null;

  if (csrfToken) {
    headers['X-XSRF-TOKEN'] = csrfToken;
  }

  req = req.clone({
    setHeaders: headers,
    withCredentials: isApiRequest,
    ...(isApiRequest ? { cache: 'no-store' as const } : {}),
  });

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (isApiRequest && error.status === 401 && sessionVersion === authService.sessionVersion) {
        // La navegación la resuelve el guard de la ruta. Redirigir desde aquí
        // interrumpe guestGuard al abrir /auth/login o /auth/register.
        authService.clearAuthSilent();
      } else if (isApiRequest && error.status === 403 && authService.isAuthenticated() &&
        !/\/departamentos\/publicaciones\/[^/?]+\/download(?:\?|$)/.test(req.url)) {
        // Sin permisos - redirigir a dashboard
        router.navigate(['/admin/dashboard']);
      }
      return throwError(() => error);
    })
  );
};
