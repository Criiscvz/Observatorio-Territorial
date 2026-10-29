import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import { AuthService } from '../services/auth.service';
import { authInterceptor, isTrustedApiUrl } from './auth.interceptor';

describe('isTrustedApiUrl', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: AuthService, useValue: { clearAuthSilent: vi.fn(), isAuthenticated: () => true, sessionVersion: 0 } },
      ],
    });

    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    document.cookie = 'XSRF-TOKEN=csrf-token; path=/';
  });

  afterEach(() => {
    httpMock.verify();
    document.cookie = 'XSRF-TOKEN=; Max-Age=0; path=/';
  });

  it('accepts requests within the configured API path', () => {
    expect(isTrustedApiUrl(`${environment.apiUrl}/profile`)).toBe(true);
    expect(isTrustedApiUrl(`${environment.apiUrl}/datasets?per_page=10`)).toBe(true);
  });

  it('bypasses both service-worker and HTTP caches for trusted API reads', () => {
    http.get(`${environment.apiUrl}/datasets/qa-only`).subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/datasets/qa-only`);
    expect(req.request.headers.get('ngsw-bypass')).toBe('true');
    expect(req.request.cache).toBe('no-store');
    expect(req.request.withCredentials).toBe(true);
    req.flush({});
  });

  it('keeps the bypass on writes and the Sanctum preparation request', () => {
    const csrfUrl = new URL('/sanctum/csrf-cookie', environment.apiUrl).toString();
    for (const url of [csrfUrl, `${environment.apiUrl}/logout`]) {
      http.post(url, {}).subscribe();
      const req = httpMock.expectOne(url);
      expect(req.request.headers.get('ngsw-bypass')).toBe('true');
      expect(req.request.cache).toBe('no-store');
      req.flush({});
    }
  });

  it('does not alter caching for unrelated static resources', () => {
    http.get('https://cdn.example.org/assets.json', { cache: 'force-cache' }).subscribe();
    const req = httpMock.expectOne('https://cdn.example.org/assets.json');
    expect(req.request.headers.has('ngsw-bypass')).toBe(false);
    expect(req.request.cache).toBe('force-cache');
    req.flush({});
  });

  it('rejects third-party origins and lookalike paths', () => {
    expect(isTrustedApiUrl('https://cdn.example.org/assets.json')).toBe(false);
    expect(isTrustedApiUrl(`${environment.apiUrl}.attacker.example/profile`)).toBe(false);
    expect(isTrustedApiUrl(`${environment.apiUrl}-private/profile`)).toBe(false);
  });

  it('trusts only the exact Sanctum cookie endpoint on the configured server', () => {
    const csrfUrl = new URL('/sanctum/csrf-cookie', environment.apiUrl).toString();
    expect(isTrustedApiUrl(csrfUrl)).toBe(true);
    expect(isTrustedApiUrl(`${csrfUrl}-private`)).toBe(false);
    expect(isTrustedApiUrl('https://cdn.example.org/sanctum/csrf-cookie')).toBe(false);
  });

  it('preserves credentials when preparing the cross-port local session', () => {
    const csrfUrl = new URL('/sanctum/csrf-cookie', environment.apiUrl).toString();
    http.get(csrfUrl, { withCredentials: true }).subscribe();
    const csrfRequest = httpMock.expectOne(csrfUrl);
    expect(csrfRequest.request.withCredentials).toBe(true);
    expect(csrfRequest.request.headers.has('X-XSRF-TOKEN')).toBe(false);
    csrfRequest.flush(null);
  });

  it('does not forward cookies to an external endpoint even if credentials are requested', () => {
    const externalUrl = 'https://cdn.example.org/sanctum/csrf-cookie';
    http.get(externalUrl, { withCredentials: true }).subscribe();
    const externalRequest = httpMock.expectOne(externalUrl);
    expect(externalRequest.request.withCredentials).toBe(false);
    expect(externalRequest.request.headers.has('X-XSRF-TOKEN')).toBe(false);
    externalRequest.flush(null);
  });

  it('sends cookies and the CSRF header only to the configured API', () => {
    http.post(`${environment.apiUrl}/profile`, {}).subscribe();

    const apiRequest = httpMock.expectOne(`${environment.apiUrl}/profile`);
    expect(apiRequest.request.withCredentials).toBe(true);
    expect(apiRequest.request.headers.get('X-XSRF-TOKEN')).toBe('csrf-token');
    apiRequest.flush({});

    http.get('https://cdn.example.org/assets.json').subscribe();

    const externalRequest = httpMock.expectOne('https://cdn.example.org/assets.json');
    expect(externalRequest.request.withCredentials).toBe(false);
    expect(externalRequest.request.headers.has('X-XSRF-TOKEN')).toBe(false);
    externalRequest.flush({});
  });

  it('keeps a denied PDF in the reader instead of navigating away from the library', () => {
    const url = `${environment.apiUrl}/departamentos/publicaciones/private-pdf/download`;
    http.get(url, {responseType:'arraybuffer'}).subscribe({error: () => undefined});
    httpMock.expectOne(url).flush(null, {status:403,statusText:'Forbidden'});
    expect(TestBed.inject(Router).navigate).not.toHaveBeenCalled();
  });

  it('clears a rejected current session without redirecting the active public page', () => {
    http.get(`${environment.apiUrl}/user`).subscribe({error: () => undefined});
    httpMock.expectOne(`${environment.apiUrl}/user`).flush({}, {status:401,statusText:'Unauthorized'});
    expect(TestBed.inject(AuthService).clearAuthSilent).toHaveBeenCalledOnce();
    expect(TestBed.inject(Router).navigate).not.toHaveBeenCalled();
  });

  it('does not clear a new login when an older request returns 401 late', () => {
    http.get(`${environment.apiUrl}/user`).subscribe({error: () => undefined});
    const pending = httpMock.expectOne(`${environment.apiUrl}/user`);
    (TestBed.inject(AuthService) as any).sessionVersion = 1;
    pending.flush({}, {status:401,statusText:'Unauthorized'});
    expect(TestBed.inject(AuthService).clearAuthSilent).not.toHaveBeenCalled();
  });
});
