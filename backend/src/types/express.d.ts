import { UserRole } from '../constants/roles';

export interface IAuthUser {
  userId: string;
  role: UserRole;
  libraryId?: string;
  studentProfileId?: string;
  phone: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: IAuthUser;
    }
  }
}
