import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { UserService } from './user.service';
import { ApiService } from './api.service';
import { environment } from '../../../environments/environment';

describe('UserService', () => {
  let service: UserService;
  let httpMock: HttpTestingController;

  const mockUserDetail = {
    id: 42,
    name: 'John Doe',
    email: 'john@test.com',
    rol: 'USER',
    is_active: true
  };

  const mockUsersList = {
    data: [mockUserDetail],
    meta: { current_page: 1, last_page: 1, per_page: 15, total: 1 }
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        UserService,
        ApiService,
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    });
    service = TestBed.inject(UserService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('getUsers()', () => {
    it('should GET with default pagination params', () => {
      service.getUsers().subscribe(res => expect(res).toEqual(mockUsersList));
      const req = httpMock.expectOne(`${environment.apiUrl}/users?per_page=15&page=1`);
      expect(req.request.method).toBe('GET');
      req.flush(mockUsersList);
    });

    it('should GET with custom pagination params', () => {
      service.getUsers(5, 2).subscribe();
      const req = httpMock.expectOne(`${environment.apiUrl}/users?per_page=5&page=2`);
      expect(req.request.method).toBe('GET');
      req.flush(mockUsersList);
    });
  });

  describe('getUserById()', () => {
    it('should GET /users/:id', () => {
      service.getUserById(42).subscribe(res => expect(res).toEqual(mockUserDetail));
      const req = httpMock.expectOne(`${environment.apiUrl}/users/42`);
      expect(req.request.method).toBe('GET');
      req.flush(mockUserDetail);
    });
  });

  describe('createUser()', () => {
    it('should POST to /users', () => {
      const newUser = { name: 'Jane', email: 'jane@test.com', password: 'pass123', rol: 'USER' };
      service.createUser(newUser as any).subscribe(res => expect(res).toEqual(mockUserDetail));
      const req = httpMock.expectOne(`${environment.apiUrl}/users`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(newUser);
      req.flush(mockUserDetail);
    });
  });

  describe('updateUser()', () => {
    it('should PUT to /users/:id', () => {
      const updateData = { name: 'Updated Name' };
      service.updateUser(42, updateData as any).subscribe();
      const req = httpMock.expectOne(`${environment.apiUrl}/users/42`);
      expect(req.request.method).toBe('PUT');
      req.flush(mockUserDetail);
    });
  });

  describe('deleteUser()', () => {
    it('should DELETE /users/:id', () => {
      service.deleteUser(42).subscribe(res => expect(res.message).toBeTruthy());
      const req = httpMock.expectOne(`${environment.apiUrl}/users/42`);
      expect(req.request.method).toBe('DELETE');
      req.flush({ message: 'Eliminado' });
    });
  });

  describe('updateUserRole()', () => {
    it('should PATCH /users/:id/role', () => {
      service.updateUserRole(42, { rol: 'ADMIN' }).subscribe();
      const req = httpMock.expectOne(`${environment.apiUrl}/users/42/role`);
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual({ rol: 'ADMIN' });
      req.flush({ message: 'Rol actualizado' });
    });
  });

  describe('toggleUserStatus()', () => {
    it('should PATCH /users/:id/status with is_active=true', () => {
      service.toggleUserStatus(42, true).subscribe();
      const req = httpMock.expectOne(`${environment.apiUrl}/users/42/status`);
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual({ is_active: true });
      req.flush({ message: 'Estado actualizado', data: mockUserDetail });
    });

    it('should PATCH with empty body if isActive is undefined', () => {
      service.toggleUserStatus(42).subscribe();
      const req = httpMock.expectOne(`${environment.apiUrl}/users/42/status`);
      expect(req.request.body).toEqual({});
      req.flush({ message: 'Estado actualizado', data: mockUserDetail });
    });
  });
});
