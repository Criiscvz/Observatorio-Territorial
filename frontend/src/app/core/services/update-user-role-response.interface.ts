import { User } from '../models/user.interface';

export interface UpdateUserRoleResponse {
  message: string;
  user: User;
}
