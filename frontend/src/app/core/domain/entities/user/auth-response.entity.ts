import { UserEntity } from './user.entity';

export interface AuthResponse {
  user: UserEntity;
  token: string;
}
