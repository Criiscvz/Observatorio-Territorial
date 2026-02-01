import { User, UserRole } from './user.model';

export interface UsersListResponse {
  data: User[];
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
}

export interface UpdateUserRoleRequest {
  rol: UserRole;
}

export interface UpdateUserRoleResponse {
  message: string;
  user: User;
}
