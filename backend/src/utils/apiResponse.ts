import { Response } from 'express';

export interface ISuccessResponse<T> {
  success: true;
  data: T;
  message: string;
}

export interface IErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
  };
}

export class ApiResponse {
  static success<T>(res: Response, data: T, message = 'Success', statusCode = 200): Response {
    const payload: ISuccessResponse<T> = {
      success: true,
      data,
      message,
    };
    return res.status(statusCode).json(payload);
  }

  static error(res: Response, message: string, statusCode = 500, code = 'INTERNAL_ERROR', details?: any): Response {
    const payload: IErrorResponse = {
      success: false,
      error: {
        code,
        message,
        ...(details ? { details } : {}),
      },
    };
    return res.status(statusCode).json(payload);
  }
}
