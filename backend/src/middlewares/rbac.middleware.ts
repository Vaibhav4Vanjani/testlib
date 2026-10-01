import { Request, Response, NextFunction } from 'express';
import { UserRole } from '../constants/roles';
import { AuthorizationError, AuthenticationError } from '../utils/customErrors';

export const requireRole = (...allowedRoles: UserRole[]) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AuthenticationError());
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(new AuthorizationError(`Role '${req.user.role}' is not authorized to access this resource`));
    }

    next();
  };
};
