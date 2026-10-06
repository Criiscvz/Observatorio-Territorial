import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';
import { ApiService } from './api.service';
import { environment } from '../../../environments/environment';

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;
  let routerSpy: any;

  const mockUser = {
    id: '1',
    email: 'test@test.com',
    name: 'Test User',
    rol: 'USER',
    perfil: null,
    departamentos: []
  } as any;

  const mockAuthResponse = {
    user: mockUser,
  };

  beforeEach(() => {
    routerSpy = { navigate: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        AuthService,
        ApiService,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Router, useValue: routerSpy }
      ]
    });

    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
    
    // A cookie-backed session must never leave auth data in browser storage.
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('login()', () => {
    it('should authenticate through a CSRF-protected cookie session without local storage', () => {
      const loginData = { email: 'test@test.com', password: 'password' };

      service.login(loginData).subscribe(response => {
        expect(response).toEqual(mockAuthResponse);
        expect(service.user()).toEqual(mockUser);
        expect(service.isAuthenticated()).toBe(true);
        expect(localStorage.getItem('auth_token')).toBeNull();
        expect(localStorage.getItem('auth_user')).toBeNull();
      });

      const csrf = httpMock.expectOne('http://localhost:8000/sanctum/csrf-cookie');
      expect(csrf.request.withCredentials).toBe(true);
      csrf.flush({});

      const req = httpMock.expectOne(`${environment.apiUrl}/login`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(loginData);
      
      req.flush(mockAuthResponse);
    });
  });

  describe('logout()', () => {
    it('should call logout API and clear auth data', () => {
      // Setup initial state
      service['userSignal'].set(mockUser);

      service.logout().subscribe(() => {
        expect(service.user()).toBeNull();
        expect(service.isAuthenticated()).toBe(false);
        expect(localStorage.getItem('auth_token')).toBeNull();
        expect(localStorage.getItem('auth_user')).toBeNull();
        expect(localStorage.getItem('auth_expires_at')).toBeNull();
        expect(routerSpy.navigate).toHaveBeenCalledWith(['/publico/departamentos']);
      });

      const req = httpMock.expectOne(`${environment.apiUrl}/logout`);
      expect(req.request.method).toBe('POST');
      req.flush({});
    });

    it('should clear auth data even if API fails', () => {
      service['userSignal'].set(mockUser);

      service.logout().subscribe(() => {
        expect(service.user()).toBeNull();
        expect(routerSpy.navigate).toHaveBeenCalledWith(['/publico/departamentos']);
      });

      const req = httpMock.expectOne(`${environment.apiUrl}/logout`);
      req.error(new ProgressEvent('Network error'));
    });
  });

  describe('checkAuth()', () => {
    it('should clear a stale session without redirecting the active navigation', () => {
      service['userSignal'].set(mockUser);
      let authenticated: boolean | undefined;

      service.checkAuth().subscribe((result) => (authenticated = result));

      const req = httpMock.expectOne(`${environment.apiUrl}/user`);
      req.flush({ message: 'Unauthenticated.' }, { status: 401, statusText: 'Unauthorized' });

      expect(authenticated).toBe(false);
      expect(service.user()).toBeNull();
      expect(routerSpy.navigate).not.toHaveBeenCalled();
    });
  });

  describe('Role checking', () => {
    it('should correctly identify roles', () => {
      service['userSignal'].set({ rol: 'ADMIN' } as any);
      
      expect(service.isAdmin()).toBe(true);
      expect(service.isUser()).toBe(false);
      expect(service.hasRole('ADMIN')).toBe(true);
      expect(service.hasAnyRole(['ADMIN', 'USER'])).toBe(true);
      expect(service.hasAnyRole(['USER'])).toBe(false);
    });
  });
});
