export interface UserEntity {
  id: number;
  name: string;
  email: string;
  createdAt?: string;
}

export interface AuthResponse {
  user: UserEntity;
  token: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  name: string;
  email: string;
  password: string;
  password_confirmation: string;
}
