import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AdminService } from '../services/admin.service';
import { ApiResponse } from '../utils/apiResponse';
import { ValidationError } from '../utils/customErrors';

const enrollStudentSchema = z
  .object({
    fullName: z.string().trim().min(2, 'Full name must be at least 2 characters'),
    phone: z.string().trim().regex(/^\d{10}$/, 'Phone number must be exactly 10 numeric digits'),
    aadharNumber: z.string().trim().regex(/^\d{12}$/, 'Aadhar Card number must be exactly 12 numeric digits'),
    fromDate: z.string().refine((val) => val && !isNaN(Date.parse(val)), { message: 'Valid From Date is required' }),
    toDate: z.string().refine((val) => val && !isNaN(Date.parse(val)), { message: 'Valid To Date is required' }),
    fromTime: z.string().optional(),
    toTime: z.string().optional(),
    seatId: z.string().optional(),
    lockerId: z.string().optional(),
    assignedSeatId: z.string().optional(),
    assignedLockerId: z.string().optional(),
    referredBy: z.string().optional(),
    paymentMethod: z.enum(['CASH', 'UPI', 'CARD', 'ONLINE_GATEWAY', 'MANUAL_QR']).optional().default('CASH'),
    totalAmount: z.union([z.string(), z.number()]).optional().transform((val) => val ? parseFloat(String(val)) : undefined),
    dailyHours: z.union([z.string(), z.number()]).optional().transform((val) => val ? parseFloat(String(val)) : 12),
  })
  .refine(
    (data) => {
      const from = new Date(data.fromDate);
      const to = new Date(data.toDate);
      if (isNaN(from.getTime()) || isNaN(to.getTime())) return false;
      if (to <= from) return false;
      const minTo = new Date(from);
      minTo.setMonth(minTo.getMonth() + 1);
      return to >= minTo;
    },
    {
      message: 'To Date must be at least 1 month after From Date.',
      path: ['toDate'],
    }
  );

export class AdminController {
  static async getDashboardMetrics(req: Request, res: Response, next: NextFunction) {
    try {
      const libraryId = req.user?.libraryId;
      if (!libraryId) {
        return ApiResponse.error(res, 'Library context required', 400);
      }

      const metrics = await AdminService.getDashboardMetrics(libraryId);
      return ApiResponse.success(res, metrics, 'Dashboard metrics fetched');
    } catch (error) {
      next(error);
    }
  }

  static async searchStudents(req: Request, res: Response, next: NextFunction) {
    try {
      const libraryId = req.user?.libraryId;
      if (!libraryId) {
        return ApiResponse.error(res, 'Library context required', 400);
      }

      const { search, status, page, limit } = req.query;
      const result = await AdminService.searchStudents(
        libraryId,
        search as string,
        status as string,
        page ? parseInt(page as string, 10) : 1,
        limit ? parseInt(limit as string, 10) : 20
      );

      return ApiResponse.success(res, result, 'Students fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  static async updateStudentStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const libraryId = req.user?.libraryId;
      if (!libraryId) return ApiResponse.error(res, 'Library context required', 400);

      const { studentProfileId } = req.params;
      const { status } = req.body;

      if (!status || !['ACTIVE', 'INACTIVE'].includes(status)) {
        throw new ValidationError('Valid status (ACTIVE or INACTIVE) is required');
      }

      const result = await AdminService.updateStudentStatus(libraryId, studentProfileId, status);
      return ApiResponse.success(res, result, result.message);
    } catch (error) {
      next(error);
    }
  }

  static async updateStudentProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const libraryId = req.user?.libraryId;
      if (!libraryId) return ApiResponse.error(res, 'Library context required', 400);

      const { studentProfileId } = req.params;
      const { storageService } = require('../config/storage');

      let profilePicturePath: string | undefined;
      if (req.file) {
        if (req.file.buffer) {
          profilePicturePath = await storageService.uploadFile(
            req.file,
            `libraries/${libraryId}/students/${studentProfileId}`
          );
        } else if (req.file.filename) {
          profilePicturePath = req.file.filename;
        }
      }

      const result = await AdminService.updateStudentProfile(libraryId, studentProfileId, {
        fullName: req.body.fullName,
        phone: req.body.phone,
        aadharNumber: req.body.aadharNumber,
        newPassword: req.body.newPassword,
        profilePicturePath,
        fromTime: req.body.fromTime,
        toTime: req.body.toTime,
        fromDate: req.body.fromDate,
        toDate: req.body.toDate,
      });

      return ApiResponse.success(res, result, 'Student profile updated successfully');
    } catch (error) {
      next(error);
    }
  }

  static async extendStudentMembership(req: Request, res: Response, next: NextFunction) {
    try {
      const libraryId = req.user?.libraryId;
      if (!libraryId) return ApiResponse.error(res, 'Library context required', 400);

      const { studentProfileId } = req.params;
      const months = req.body.months ? parseInt(req.body.months, 10) : undefined;
      const newToDate = req.body.newToDate;
      const baseDate = req.body.baseDate;
      const recordPayment = req.body.recordPayment !== false;
      const fromTime = req.body.fromTime;
      const toTime = req.body.toTime;

      const result = await AdminService.extendStudentMembership(
        libraryId,
        studentProfileId,
        months,
        newToDate,
        recordPayment,
        fromTime,
        toTime,
        baseDate
      );
      return ApiResponse.success(res, result, result.message || 'Membership extended successfully');
    } catch (error) {
      next(error);
    }
  }

  static async getEntryExitLogs(req: Request, res: Response, next: NextFunction) {
    try {
      const libraryId = req.user?.libraryId;
      if (!libraryId) return ApiResponse.error(res, 'Library context required', 400);

      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;

      const logs = await AdminService.getEntryExitLogs(libraryId, page, limit);
      return ApiResponse.success(res, logs, 'Audit logs fetched');
    } catch (error) {
      next(error);
    }
  }

  static async getQRPayload(req: Request, res: Response, next: NextFunction) {
    try {
      const libraryId = req.user?.libraryId;
      if (!libraryId) {
        return ApiResponse.error(res, 'Library context required', 400);
      }

      const qrPayload = await AdminService.getAdminQRPayload(libraryId);
      return ApiResponse.success(res, qrPayload, 'Dynamic QR payload generated');
    } catch (error) {
      next(error);
    }
  }

  static async updateAnnouncement(req: Request, res: Response, next: NextFunction) {
    try {
      const libraryId = req.user?.libraryId;
      if (!libraryId) {
        return ApiResponse.error(res, 'Library context required', 400);
      }

      const { status, announcement } = req.body;
      const updatedLibrary = await AdminService.updateLibraryAnnouncement(libraryId, status, announcement);
      return ApiResponse.success(res, updatedLibrary, 'Library status updated');
    } catch (error) {
      next(error);
    }
  }

  static async updatePaymentPlan(req: Request, res: Response, next: NextFunction) {
    try {
      const libraryId = req.user?.libraryId;
      if (!libraryId) {
        return ApiResponse.error(res, 'Library context required', 400);
      }

      const plan = await AdminService.updatePaymentPlan(libraryId, req.body);
      return ApiResponse.success(res, plan, 'Payment Master pricing updated successfully');
    } catch (error) {
      next(error);
    }
  }

  static async getAuditLogs(req: Request, res: Response, next: NextFunction) {
    try {
      const libraryId = req.user?.libraryId;
      if (!libraryId) {
        return ApiResponse.error(res, 'Library context required', 400);
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(50, parseInt(req.query.limit as string) || 20);

      const logs = await AdminService.getAuditLogs(libraryId, page, limit);
      return ApiResponse.success(res, logs, 'Audit logs fetched');
    } catch (error) {
      next(error);
    }
  }

  static async getEnrollmentOptions(req: Request, res: Response, next: NextFunction) {
    try {
      const libraryId = req.user?.libraryId;
      if (!libraryId) return ApiResponse.error(res, 'Library context required', 400);

      const { fromDate, toDate, fromTime, toTime } = req.query;
      const options = await AdminService.getEnrollmentOptions(
        libraryId,
        fromDate as string,
        toDate as string,
        fromTime as string,
        toTime as string
      );
      return ApiResponse.success(res, options, 'Enrollment options fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  static async validateReferralCode(req: Request, res: Response, next: NextFunction) {
    try {
      const libraryId = req.user?.libraryId;
      if (!libraryId) return ApiResponse.error(res, 'Library context required', 400);

      const code = req.query.code as string;
      const result = await AdminService.validateReferralCode(libraryId, code);
      return ApiResponse.success(res, result, 'Referral code validated successfully');
    } catch (error) {
      next(error);
    }
  }

  static async enrollStudent(req: Request, res: Response, next: NextFunction) {
    try {
      const libraryId = req.user?.libraryId;
      if (!libraryId) return ApiResponse.error(res, 'Library context required', 400);

      const { storageService } = require('../config/storage');
      let profilePicturePath: string | undefined;
      if (req.file) {
        if (req.file.buffer) {
          profilePicturePath = await storageService.uploadFile(
            req.file,
            `libraries/${libraryId}/students/enrollment`
          );
        } else if (req.file.filename) {
          profilePicturePath = req.file.filename;
        }
      }

      const validatedPayload = enrollStudentSchema.parse(req.body);
      const result = await AdminService.enrollStudent(libraryId, {
        ...req.body,
        ...validatedPayload,
        profilePicturePath,
      });
      return ApiResponse.success(res, result, 'Student enrolled successfully');
    } catch (error) {
      next(error);
    }
  }

  static async getEarnings(req: Request, res: Response, next: NextFunction) {
    try {
      const libraryId = req.user?.libraryId;
      if (!libraryId) return ApiResponse.error(res, 'Library context required', 400);

      const fromDate = req.query.fromDate as string | undefined;
      const toDate = req.query.toDate as string | undefined;

      const earnings = await AdminService.getDetailedEarnings(libraryId, fromDate, toDate);
      return ApiResponse.success(res, earnings, 'Detailed earnings fetched');
    } catch (error) {
      next(error);
    }
  }

  static async getPaymentMaster(req: Request, res: Response, next: NextFunction) {
    try {
      const libraryId = req.user?.libraryId;
      if (!libraryId) return ApiResponse.error(res, 'Library context required', 400);

      const master = await AdminService.getPaymentMaster(libraryId);
      return ApiResponse.success(res, master, 'Payment master fetched');
    } catch (error) {
      next(error);
    }
  }

  static async updatePaymentMaster(req: Request, res: Response, next: NextFunction) {
    try {
      const libraryId = req.user?.libraryId;
      if (!libraryId) return ApiResponse.error(res, 'Library context required', 400);

      const master = await AdminService.updatePaymentMaster(libraryId, req.body);
      return ApiResponse.success(res, master, 'Payment master updated');
    } catch (error) {
      next(error);
    }
  }

  static async sendNotification(req: Request, res: Response, next: NextFunction) {
    try {
      const libraryId = req.user?.libraryId;
      if (!libraryId) return ApiResponse.error(res, 'Library context required', 400);

      const notif = await AdminService.sendNotification(libraryId, req.body);
      return ApiResponse.success(res, notif, 'Notification broadcasted successfully');
    } catch (error) {
      next(error);
    }
  }

  static async getSentNotifications(req: Request, res: Response, next: NextFunction) {
    try {
      const libraryId = req.user?.libraryId;
      if (!libraryId) return ApiResponse.error(res, 'Library context required', 400);

      const list = await AdminService.getSentNotifications(libraryId);
      return ApiResponse.success(res, list, 'Sent notifications fetched');
    } catch (error) {
      next(error);
    }
  }

  static async hideNotification(req: Request, res: Response, next: NextFunction) {
    try {
      const libraryId = req.user?.libraryId;
      if (!libraryId) return ApiResponse.error(res, 'Library context required', 400);

      const { notificationId } = req.params;
      const result = await AdminService.hideNotification(libraryId, notificationId);
      return ApiResponse.success(res, result, result.message);
    } catch (error) {
      next(error);
    }
  }

  static async referToOtherLibrary(req: Request, res: Response, next: NextFunction) {
    try {
      const { studentProfileId, targetLibraryId, notes } = req.body;
      const result = await AdminService.referStudentToOtherLibrary(studentProfileId, targetLibraryId, notes);
      return ApiResponse.success(res, result, 'Student referral created');
    } catch (error) {
      next(error);
    }
  }

  // --- SEAT MASTER CONTROLLER ---
  static async getSeatsMaster(req: Request, res: Response, next: NextFunction) {
    try {
      const libraryId = req.user?.libraryId;
      if (!libraryId) return ApiResponse.error(res, 'Library context required', 400);

      const { fromTime, toTime, search, floor, fromDate, toDate } = req.query;
      const master = await AdminService.getSeatsMaster(libraryId, {
        fromTime: fromTime as string,
        toTime: toTime as string,
        search: search as string,
        floor: floor ? parseInt(floor as string, 10) : undefined,
        fromDate: fromDate as string,
        toDate: toDate as string,
      });
      return ApiResponse.success(res, master, 'Seats Master fetched');
    } catch (error) {
      next(error);
    }
  }

  static async manageSeatMaster(req: Request, res: Response, next: NextFunction) {
    try {
      const libraryId = req.user?.libraryId;
      if (!libraryId) return ApiResponse.error(res, 'Library context required', 400);

      const result = await AdminService.manageSeatMaster(libraryId, req.body);
      return ApiResponse.success(res, result, 'Seat Master updated');
    } catch (error) {
      next(error);
    }
  }

  // --- LOCKER MASTER CONTROLLER ---
  static async getLockersMaster(req: Request, res: Response, next: NextFunction) {
    try {
      const libraryId = req.user?.libraryId;
      if (!libraryId) return ApiResponse.error(res, 'Library context required', 400);

      const { fromTime, toTime, search, floor, fromDate, toDate } = req.query;
      const master = await AdminService.getLockersMaster(libraryId, {
        fromTime: fromTime as string,
        toTime: toTime as string,
        search: search as string,
        floor: floor ? parseInt(floor as string, 10) : undefined,
        fromDate: fromDate as string,
        toDate: toDate as string,
      });
      return ApiResponse.success(res, master, 'Lockers Master fetched');
    } catch (error) {
      next(error);
    }
  }

  static async manageLockerMaster(req: Request, res: Response, next: NextFunction) {
    try {
      const libraryId = req.user?.libraryId;
      if (!libraryId) return ApiResponse.error(res, 'Library context required', 400);

      const result = await AdminService.manageLockerMaster(libraryId, req.body);
      return ApiResponse.success(res, result, 'Locker Master updated');
    } catch (error) {
      next(error);
    }
  }

  static async triggerAutoCheckout(req: Request, res: Response, next: NextFunction) {
    try {
      const { AutoCheckoutService } = require('../services/autoCheckout.service');
      const result = await AutoCheckoutService.executeDailyCheckout();
      return ApiResponse.success(res, result, 'Daily auto-checkout job executed successfully');
    } catch (error) {
      next(error);
    }
  }

  static async submitSaaSPayment(req: Request, res: Response, next: NextFunction) {
    try {
      const libraryId = req.user?.libraryId;
      const adminUserId = req.user?.userId;
      if (!libraryId || !adminUserId) return ApiResponse.error(res, 'Library admin context required', 400);

      const proofImage = req.file ? `/uploads/${req.file.filename}` : req.body.proofImage;
      const amount = req.body.amount ? parseFloat(req.body.amount) : undefined;

      const result = await AdminService.submitSaaSPayment(libraryId, adminUserId, {
        amount,
        paymentMethod: req.body.paymentMethod,
        transactionRef: req.body.transactionRef,
        proofImage,
      });

      return ApiResponse.success(res, result, result.message);
    } catch (error) {
      next(error);
    }
  }

  static async getSaaSPaymentDetails(req: Request, res: Response, next: NextFunction) {
    try {
      const libraryId = req.user?.libraryId;
      if (!libraryId) return ApiResponse.error(res, 'Library context required', 400);

      const details = await AdminService.getSaaSPaymentDetails(libraryId);
      return ApiResponse.success(res, details, 'SaaS payment details fetched');
    } catch (error) {
      next(error);
    }
  }

  static async seedOverdueTestStudent(req: Request, res: Response, next: NextFunction) {
    try {
      const libraryId = req.user?.libraryId;
      if (!libraryId) return ApiResponse.error(res, 'Library context required', 400);

      const result = await AdminService.seedOverdueTestStudent(libraryId);
      return ApiResponse.success(res, result, 'Test overdue student seeded');
    } catch (error) {
      next(error);
    }
  }
}
