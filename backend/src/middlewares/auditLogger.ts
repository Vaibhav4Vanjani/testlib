import { Request, Response, NextFunction } from 'express';
import { AuditLog } from '../models/auditLog.model';
import { logger } from '../config/logger';

export const auditLog = (action: string, resource: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Intercept res.json to log after successful execution
    const originalJson = res.json.bind(res);

    res.json = (body: any): Response => {
      if (res.statusCode >= 200 && res.statusCode < 300 && req.user) {
        AuditLog.create({
          libraryId: req.user.libraryId,
          actorUserId: req.user.userId,
          action,
          resource,
          resourceId: req.params.id || body?.data?._id,
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
          metadata: { path: req.originalUrl, method: req.method },
        }).catch((err) => logger.error('Failed to create AuditLog:', err));
      }
      return originalJson(body);
    };

    next();
  };
};
