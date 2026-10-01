import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AttendanceService } from '../services/attendance.service';
import { ApiResponse } from '../utils/apiResponse';
import { ValidationError } from '../utils/customErrors';

const scanQRSchema = z.object({
  libraryId: z.string().min(1, 'libraryId is required'),
  timestamp: z.number(),
  nonce: z.string().min(1, 'nonce is required'),
  expiry: z.number(),
  signature: z.string().min(1, 'signature is required'),
});

export class AttendanceController {
  static async scanQR(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user || !req.user.userId) {
        return ApiResponse.error(res, 'Unauthenticated', 401);
      }

      let payloadData: any;
      if (req.body && req.body.libraryId) {
        const parseResult = scanQRSchema.safeParse(req.body);
        if (!parseResult.success) {
          throw new ValidationError(parseResult.error.errors[0].message);
        }
        payloadData = parseResult.data;
      }

      const result = await AttendanceService.scanQR(req.user.userId, payloadData);
      return ApiResponse.success(res, result, result.message);
    } catch (error) {
      next(error);
    }
  }

  static async getHistory(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user || !req.user.studentProfileId) {
        return ApiResponse.error(res, 'Student profile context required', 400);
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(50, parseInt(req.query.limit as string) || 20);

      const history = await AttendanceService.getAttendanceHistory(req.user.studentProfileId, page, limit);
      return ApiResponse.success(res, history, 'Attendance history fetched');
    } catch (error) {
      next(error);
    }
  }

  static async getCurrentSession(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user || !req.user.studentProfileId) {
        return ApiResponse.error(res, 'Student profile context required', 400);
      }

      const session = await AttendanceService.getCurrentSession(req.user.studentProfileId);
      return ApiResponse.success(res, session, 'Current session fetched');
    } catch (error) {
      next(error);
    }
  }

  static async getMonthlyStudyReport(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user || !req.user.studentProfileId) {
        return ApiResponse.error(res, 'Student profile context required', 400);
      }

      const month = req.query.month as string;
      const report = await AttendanceService.getMonthlyStudyReport(req.user.studentProfileId, month);
      return ApiResponse.success(res, report, 'Monthly study report fetched');
    } catch (error) {
      next(error);
    }
  }

  static async getActiveLogs(req: Request, res: Response, next: NextFunction) {
    try {
      const libraryId = req.user?.libraryId;
      if (!libraryId) {
        return ApiResponse.error(res, 'Library ID required', 400);
      }

      const date = req.query.date as string;
      const logs = await AttendanceService.getActiveLogs(libraryId.toString(), date);
      return ApiResponse.success(res, logs, 'Active attendance logs fetched');
    } catch (error) {
      next(error);
    }
  }

  static async purgePastLogs(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await AttendanceService.purgePastAttendanceLogs();
      return ApiResponse.success(res, result, 'Past attendance logs purged successfully');
    } catch (error) {
      next(error);
    }
  }

  static async forceCheckout(req: Request, res: Response, next: NextFunction) {
    try {
      const libraryId = req.user?.libraryId;
      const { sessionId } = req.params;

      if (!libraryId) {
        return ApiResponse.error(res, 'Library ID required', 400);
      }

      const result = await AttendanceService.forceCheckoutSession(libraryId.toString(), sessionId);
      return ApiResponse.success(res, result, 'Student checked out successfully');
    } catch (error) {
      next(error);
    }
  }

  static async getPendingRequests(req: Request, res: Response, next: NextFunction) {
    try {
      const libraryId = req.user?.libraryId;
      if (!libraryId) return ApiResponse.error(res, 'Library ID required', 400);

      const requests = await AttendanceService.getPendingAttendanceRequests(libraryId.toString());
      return ApiResponse.success(res, requests, 'Pending attendance requests fetched');
    } catch (error) {
      next(error);
    }
  }

  static async approveRequest(req: Request, res: Response, next: NextFunction) {
    try {
      const libraryId = req.user?.libraryId;
      const adminUserId = req.user?.userId;
      const { requestId } = req.params;

      if (!libraryId || !adminUserId) return ApiResponse.error(res, 'Library context required', 400);

      const result = await AttendanceService.approveAttendanceRequest(libraryId.toString(), adminUserId, requestId);
      return ApiResponse.success(res, result, 'Attendance request approved successfully');
    } catch (error) {
      next(error);
    }
  }

  static async rejectRequest(req: Request, res: Response, next: NextFunction) {
    try {
      const libraryId = req.user?.libraryId;
      const adminUserId = req.user?.userId;
      const { requestId } = req.params;
      const { rejectionReason } = req.body;

      if (!libraryId || !adminUserId) return ApiResponse.error(res, 'Library context required', 400);

      const result = await AttendanceService.rejectAttendanceRequest(libraryId.toString(), adminUserId, requestId, rejectionReason);
      return ApiResponse.success(res, result, 'Attendance request rejected');
    } catch (error) {
      next(error);
    }
  }

  static async directCheckIn(req: Request, res: Response, next: NextFunction) {
    try {
      const libraryId = req.user?.libraryId;
      const adminUserId = req.user?.userId;
      const { studentProfileId } = req.body;

      if (!libraryId || !adminUserId) return ApiResponse.error(res, 'Library context required', 400);
      if (!studentProfileId) return ApiResponse.error(res, 'studentProfileId is required', 400);

      const result = await AttendanceService.directCheckIn(libraryId.toString(), adminUserId, studentProfileId);
      return ApiResponse.success(res, result, result.message);
    } catch (error) {
      next(error);
    }
  }

  static async directCheckOut(req: Request, res: Response, next: NextFunction) {
    try {
      const libraryId = req.user?.libraryId;
      const adminUserId = req.user?.userId;
      const { studentProfileId } = req.body;

      if (!libraryId || !adminUserId) return ApiResponse.error(res, 'Library context required', 400);
      if (!studentProfileId) return ApiResponse.error(res, 'studentProfileId is required', 400);

      const result = await AttendanceService.directCheckOut(libraryId.toString(), adminUserId, studentProfileId);
      return ApiResponse.success(res, result, result.message);
    } catch (error) {
      next(error);
    }
  }
}
