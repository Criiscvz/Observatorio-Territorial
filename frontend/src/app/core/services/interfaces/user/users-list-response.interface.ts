import { User } from '../../../models';

export interface UsersListResponse {
  data: User[];
  meta: {
    access_capabilities?: {can_assign_editors: boolean};
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
}
