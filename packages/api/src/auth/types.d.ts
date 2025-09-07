export interface User {
  id: string;
  username: string;
  email: string;
  created: Date;
  password: string;
  avatarUrl?: string;
  lasLogin?: Date;
}
