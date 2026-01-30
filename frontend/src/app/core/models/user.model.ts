export interface User {
  id: number;
  name: string;
  email: string;
  email_verified_at?: string;
  created_at: string;
  updated_at: string;
  perfil?: Perfil;
  departamentos?: DepartamentoConRol[];
}

export interface Perfil {
  id: string;
  user_id: number;
  telefono?: string;
  cargo?: string;
  avatar?: string;
  bio?: string;
}

export interface DepartamentoConRol {
  id: string;
  nombre: string;
  codigo_interno: string;
  descripcion?: string;
  publico: boolean;
  pivot: {
    rol: 'ADMIN' | 'EDITOR' | 'LECTOR';
  };
}

export interface AuthResponse {
  message: string;
  user: User;
  token: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
  password_confirmation: string;
}
