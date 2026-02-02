export interface UpdateUserRequest {
  name?: string;
  email?: string;
  password?: string;
  rol?: 'ADMIN' | 'USER';
  is_active?: boolean;
  telefono?: string;
  cargo?: string;
  bio?: string;
}
