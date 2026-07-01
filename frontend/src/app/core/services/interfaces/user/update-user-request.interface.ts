import type { UserRole } from '@core/models';

export interface UpdateUserRequest {
  name?: string;
  email?: string;
  password?: string;
  rol?: UserRole;
  is_active?: boolean;
  telefono?: string;
  cargo?: string;
  bio?: string;
}
