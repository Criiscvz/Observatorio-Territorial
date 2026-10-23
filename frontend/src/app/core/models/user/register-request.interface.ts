import { CommunityProfileData } from './community-profile';

export interface RegisterRequest extends CommunityProfileData {
  name: string;
  email: string;
  password: string;
  password_confirmation: string;
}
