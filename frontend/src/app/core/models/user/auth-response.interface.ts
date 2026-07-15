import { User } from './user.interface';

export interface AuthResponse {
  message: string;
  user: User;
  token: string;
  expires_at: string;
  expires_in: number;
}
