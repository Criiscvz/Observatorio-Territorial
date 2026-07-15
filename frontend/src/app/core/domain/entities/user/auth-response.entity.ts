import { UserEntity } from './user.entity';

export interface AuthResponse {
  user: UserEntity;
  token: string;
  expires_at?: string | null;
  expires_in?: number | null;
}
