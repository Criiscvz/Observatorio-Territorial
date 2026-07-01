import type { UserRole } from '@core/models';

export interface CreateUserRequest {
  name: string;
  email: string;
  password: string;
  rol?: UserRole;
  is_active?: boolean;
  telefono?: string;
  cargo?: string;
  bio?: string;
}
