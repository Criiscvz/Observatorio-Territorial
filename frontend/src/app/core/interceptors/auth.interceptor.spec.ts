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
        { provide: AuthService, useValue: { clearAuthSilent: vi.fn() } },
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
});
