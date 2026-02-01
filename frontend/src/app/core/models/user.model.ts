// Tipos de rol global
export type UserRole = 'ADMIN' | 'USER';

// Tipos de rol por departamento
export type DepartamentoRole = 'ADMIN' | 'EDITOR' | 'LECTOR';

export interface User {
  id: number;
  name: string;
  email: string;
  rol: UserRole;
  email_verified_at?: string;
  created_at?: string;
  updated_at?: string;
  perfil?: Perfil | null;
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
  publico?: boolean;
  rol: DepartamentoRole; // Rol del usuario en este departamento
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
