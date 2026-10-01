import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/customErrors';
import { ApiResponse } from '../utils/apiResponse';
import { logger } from '../config/logger';
import { env } from '../config/env';

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
) => {
  logger.error(`Error processing ${req.method} ${req.originalUrl}:`, err);

  if (err instanceof AppError) {
    return ApiResponse.error(res, err.message, err.statusCode, err.errorCode);
  }

  // Handle Mongoose duplicate key error
  if ((err as any).code === 11000) {
    const field = Object.keys((err as any).keyValue || {})[0] || 'Field';
    return ApiResponse.error(res, `${field} already exists.`, 409, 'DUPLICATE_KEY_ERROR');
  }

  // Handle Mongoose CastError / ValidationError
  if (err.name === 'ValidationError') {
    return ApiResponse.error(res, err.message, 400, 'VALIDATION_ERROR');
  }

  const message = env.NODE_ENV === 'production' ? 'An unexpected internal error occurred.' : err.message;
  return ApiResponse.error(res, message, 500, 'INTERNAL_SERVER_ERROR');
};
