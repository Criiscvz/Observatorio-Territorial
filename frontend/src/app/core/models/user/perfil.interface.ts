export interface Perfil {
  id: string;
  user_id: number;
  telefono?: string;
  cargo?: string;
  avatar?: string;
  bio?: string;
  vinculo?: string | null;
  institucion_tipo?: string | null;
  institucion?: string | null;
}
