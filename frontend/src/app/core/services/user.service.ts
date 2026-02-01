import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { UpdateUserRoleRequest } from './update-user-role-request.interface';
import { UpdateUserRoleResponse } from './update-user-role-response.interface';
import { UsersListResponse } from './users-list-response.interface';

@Injectable({
  providedIn: 'root',
})
export class UserService {
  private readonly api = inject(ApiService);

  /**
   * Obtener lista de usuarios (solo admin)
   */
  getUsers(perPage = 15, page = 1): Observable<UsersListResponse> {
    return this.api.get<UsersListResponse>(`/users?per_page=${perPage}&page=${page}`);
  }

  /**
   * Cambiar rol de un usuario (solo admin)
   */
  updateUserRole(userId: number, data: UpdateUserRoleRequest): Observable<UpdateUserRoleResponse> {
    return this.api.patch<UpdateUserRoleResponse>(`/users/${userId}/role`, data);
  }
}
