export enum UserRole {
  ADMIN = 'ADMIN',
  PARENT = 'PARENT',
  INSTRUCTOR = 'INSTRUCTOR',
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

