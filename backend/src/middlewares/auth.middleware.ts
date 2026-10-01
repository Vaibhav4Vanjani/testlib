import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { AuthenticationError } from '../utils/customErrors';
import { IAuthUser } from '../types/express';

export const authenticate = (req: Request, _res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AuthenticationError('Missing or invalid Authorization header');
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      throw new AuthenticationError('Token not provided');
    }

    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as IAuthUser;
    req.user = decoded;
    next();
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      return next(new AuthenticationError('Token has expired', 'TOKEN_EXPIRED'));
    }
    return next(new AuthenticationError('Invalid authentication token', 'INVALID_TOKEN'));
  }
};
