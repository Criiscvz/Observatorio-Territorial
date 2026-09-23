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
