import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';
import { UserRole } from '../models';
import {
    CreateUserRequest,
    UpdateUserRequest,
    UpdateUserRoleRequest,
    UpdateUserRoleResponse,
    UserDetailResponse,
    UsersListResponse
} from './interfaces';

export interface ToggleStatusResponse {
  message: string;
  data: any;
}

export interface DeleteUserResponse {
  message: string;
}

export interface ChangeUserPasswordResponse { message: string; reauthenticate: boolean; }

@Injectable({
  providedIn: 'root',
})
export class UserService {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);

  /**
   * Obtener lista de usuarios (solo admin)
   */
  getUsers(perPage = 15, page = 1, search?: string, purpose?: 'permissions', role?: UserRole): Observable<UsersListResponse> {
    const scoped = this.auth.user()?.rol === 'ADMIN_OBSERVATORIO';
    let url = `${scoped ? '/observatorio-admin/users' : '/users'}?per_page=${perPage}&page=${page}`;
    if (scoped && purpose) url += `&purpose=${purpose}`;
    if (!scoped && role) url += `&rol=${encodeURIComponent(role)}`;
    if (search) {
      url += `&search=${encodeURIComponent(search)}`;
    }
    return this.api.get<UsersListResponse>(url);
  }

  /**
   * Obtener detalle de un usuario (solo admin)
   */
  getUserById(userId: number): Observable<UserDetailResponse> {
    return this.api.get<UserDetailResponse>(`/users/${userId}`);
  }

  /**
   * Crear un nuevo usuario (solo admin)
   */
  createUser(data: CreateUserRequest): Observable<UserDetailResponse> {
    return this.api.post<UserDetailResponse>('/users', data);
  }

  /**
   * Actualizar un usuario (solo admin)
   */
  updateUser(userId: number, data: UpdateUserRequest): Observable<UserDetailResponse> {
    return this.api.put<UserDetailResponse>(`/users/${userId}`, data);
  }

  /**
   * Eliminar un usuario (solo admin)
   */
  deleteUser(userId: number): Observable<DeleteUserResponse> {
    return this.api.delete<DeleteUserResponse>(`/users/${userId}`);
  }

  /**
   * Cambiar rol de un usuario (solo admin)
   */
  updateUserRole(userId: number, data: UpdateUserRoleRequest): Observable<UpdateUserRoleResponse> {
    return this.api.patch<UpdateUserRoleResponse>(`/users/${userId}/role`, data);
  }

  changePassword(userId: number, password: string, confirmation: string): Observable<ChangeUserPasswordResponse> {
    return this.api.patch<ChangeUserPasswordResponse>(`/users/${userId}/password`, {
      password, password_confirmation: confirmation,
    });
  }

  /**
   * Activar/Desactivar un usuario (solo admin)
   */
  toggleUserStatus(userId: number, isActive?: boolean): Observable<ToggleStatusResponse> {
    const body = isActive !== undefined ? { is_active: isActive } : {};
    return this.api.patch<ToggleStatusResponse>(`/users/${userId}/status`, body);
  }
}
