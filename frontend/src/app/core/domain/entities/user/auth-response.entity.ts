import { UserEntity } from './user.entity';

export interface AuthResponse {
  user: UserEntity;
  token: string;
  expires_at: string;
  expires_in: number;
}
