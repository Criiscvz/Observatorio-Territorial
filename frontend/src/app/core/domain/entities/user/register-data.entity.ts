import { CommunityProfileData } from '@core/models/user/community-profile';

export interface RegisterData extends CommunityProfileData {
  name: string;
  email: string;
  password: string;
  password_confirmation: string;
}
