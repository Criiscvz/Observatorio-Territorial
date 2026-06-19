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
    perfil: null
  } as any;

  const mockAuthResponse = {
    token: 'fake-jwt-token',
    user: mockUser
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
    
    // Clear session storage before each test
    sessionStorage.clear();
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('login()', () => {
    it('should authenticate user, store token in signal and user in sessionStorage', () => {
      const loginData = { email: 'test@test.com', password: 'password' };

      service.login(loginData).subscribe(response => {
        expect(response).toEqual(mockAuthResponse);
        // Token lives only in signal memory
        expect(service.token()).toBe('fake-jwt-token');
        expect(service.user()).toEqual(mockUser);
        expect(service.isAuthenticated()).toBe(true);
        
        // User is stored in session storage
        const storedUser = JSON.parse(sessionStorage.getItem('auth_user') || '{}');
        expect(storedUser).toEqual(mockUser);
      });

      const req = httpMock.expectOne(`${environment.apiUrl}/login`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(loginData);
      
      req.flush(mockAuthResponse);
    });
  });

  describe('logout()', () => {
    it('should call logout API and clear auth data', () => {
      // Setup initial state
      service['tokenSignal'].set('fake-token');
      service['userSignal'].set(mockUser);
      sessionStorage.setItem('auth_user', JSON.stringify(mockUser));

      service.logout().subscribe(() => {
        expect(service.token()).toBeNull();
        expect(service.user()).toBeNull();
        expect(service.isAuthenticated()).toBe(false);
        expect(sessionStorage.getItem('auth_user')).toBeNull();
        expect(routerSpy.navigate).toHaveBeenCalledWith(['/auth/login']);
      });

      const req = httpMock.expectOne(`${environment.apiUrl}/logout`);
      expect(req.request.method).toBe('POST');
      req.flush({});
    });

    it('should clear auth data even if API fails', () => {
      service['tokenSignal'].set('fake-token');

      service.logout().subscribe(() => {
        expect(service.token()).toBeNull();
        expect(routerSpy.navigate).toHaveBeenCalledWith(['/auth/login']);
      });

      const req = httpMock.expectOne(`${environment.apiUrl}/logout`);
      req.error(new ProgressEvent('Network error'));
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
