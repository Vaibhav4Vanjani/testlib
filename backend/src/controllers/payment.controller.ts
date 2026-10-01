import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { PaymentService } from '../services/payment.service';
import { ApiResponse } from '../utils/apiResponse';
import { ValidationError } from '../utils/customErrors';
import { PaymentType } from '../constants/statusEnums';

const submitManualPaymentSchema = z.object({
  amount: z.union([z.string(), z.number()]).transform((val) => (typeof val === 'number' ? val : parseFloat(val))),
  paymentType: z.nativeEnum(PaymentType),
  utrNumber: z.string().optional(),
  targetSeatId: z.string().optional(),
  targetLockerId: z.string().optional(),
  hours: z.union([z.string(), z.number()]).optional().transform((val) => (val !== undefined && val !== null ? (typeof val === 'number' ? val : parseInt(String(val), 10)) : 1)),
  months: z
    .union([z.string(), z.number()])
    .optional()
    .transform((val) => (val !== undefined && val !== null ? (typeof val === 'number' ? val : parseInt(String(val), 10)) : 1))
    .refine((val) => Number.isInteger(val) && val >= 1 && val <= 50, {
      message: 'Reservation duration (months) must be a whole number between 1 and 50.',
    }),
  hasSeat: z.union([z.boolean(), z.string()]).optional().transform((val) => val === true || val === 'true'),
  hasLocker: z.union([z.boolean(), z.string()]).optional().transform((val) => val === true || val === 'true'),
  fromTime: z.string().optional(),
  toTime: z.string().optional(),
});

const rejectPaymentSchema = z.object({
  adminNotes: z.string().min(1, 'Reason for rejection is required'),
});

export class PaymentController {
  static async getPlans(req: Request, res: Response, next: NextFunction) {
    try {
      const libraryId = req.user?.libraryId;
      if (!libraryId) {
        return ApiResponse.error(res, 'Library context required', 400);
      }

      const plans = await PaymentService.getPaymentPlans(libraryId);
      return ApiResponse.success(res, plans, 'Payment plans fetched');
    } catch (error) {
      next(error);
    }
  }

  static async submitManualPayment(req: Request, res: Response, next: NextFunction) {
    try {
      const parseResult = submitManualPaymentSchema.safeParse(req.body);
      if (!parseResult.success) {
        throw new ValidationError(parseResult.error.errors[0].message);
      }

      const libraryId = req.user?.libraryId;
      const studentProfileId = req.user?.studentProfileId;

      if (!libraryId || !studentProfileId) {
        return ApiResponse.error(res, 'Student profile context required', 400);
      }

      const { amount, paymentType, utrNumber, targetSeatId, targetLockerId, hours, months, hasSeat, hasLocker, fromTime, toTime } = parseResult.data;

      // Robust proofFile extraction
      let proofFile: Express.Multer.File | undefined = req.file;
      if (!proofFile && req.files) {
        if (Array.isArray(req.files) && req.files.length > 0) {
          proofFile = req.files[0];
        } else if (typeof req.files === 'object') {
          const filesObj = req.files as Record<string, Express.Multer.File[]>;
          const firstKey = Object.keys(filesObj)[0];
          if (firstKey && filesObj[firstKey] && filesObj[firstKey].length > 0) {
            proofFile = filesObj[firstKey][0];
          }
        }
      }

      const payment = await PaymentService.submitManualPayment(
        libraryId,
        studentProfileId,
        amount,
        paymentType,
        utrNumber,
        targetSeatId,
        targetLockerId,
        proofFile,
        hours,
        months,
        hasSeat,
        hasLocker,
        fromTime,
        toTime
      );

      return ApiResponse.success(res, payment, 'Payment proof submitted successfully. Pending admin approval.');
    } catch (error) {
      next(error);
    }
  }

  static async getPendingPayments(req: Request, res: Response, next: NextFunction) {
    try {
      const libraryId = req.user?.libraryId;
      if (!libraryId) {
        return ApiResponse.error(res, 'Library context required', 400);
      }

      const pending = await PaymentService.getPendingPayments(libraryId);
      return ApiResponse.success(res, pending, 'Pending payments fetched');
    } catch (error) {
      next(error);
    }
  }

  static async approvePayment(req: Request, res: Response, next: NextFunction) {
    try {
      const libraryId = req.user?.libraryId;
      const adminUserId = req.user?.userId;
      const paymentId = req.params.id;

      if (!libraryId || !adminUserId) {
        return ApiResponse.error(res, 'Admin authentication context required', 400);
      }

      const { adminNotes } = req.body;
      const payment = await PaymentService.approvePayment(libraryId, adminUserId, paymentId, adminNotes);
      return ApiResponse.success(res, payment, 'Payment approved and membership activated.');
    } catch (error) {
      next(error);
    }
  }

  static async rejectPayment(req: Request, res: Response, next: NextFunction) {
    try {
      const parseResult = rejectPaymentSchema.safeParse(req.body);
      if (!parseResult.success) {
        throw new ValidationError(parseResult.error.errors[0].message);
      }

      const libraryId = req.user?.libraryId;
      const adminUserId = req.user?.userId;
      const paymentId = req.params.id;

      if (!libraryId || !adminUserId) {
        return ApiResponse.error(res, 'Admin authentication context required', 400);
      }

      const payment = await PaymentService.rejectPayment(libraryId, adminUserId, paymentId, parseResult.data.adminNotes);
      return ApiResponse.success(res, payment, 'Payment rejected.');
    } catch (error) {
      next(error);
    }
  }

  static async getHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const studentProfileId = req.user?.studentProfileId;
      if (!studentProfileId) {
        return ApiResponse.error(res, 'Student profile context required', 400);
      }

      const history = await PaymentService.getPaymentHistory(studentProfileId);
      return ApiResponse.success(res, history, 'Payment history fetched');
    } catch (error) {
      next(error);
    }
  }

  static async getDuePayments(req: Request, res: Response, next: NextFunction) {
    try {
      const libraryId = req.user?.libraryId;
      if (!libraryId) {
        return ApiResponse.error(res, 'Library context required', 400);
      }

      const duePayments = await PaymentService.getDuePayments(libraryId);
      return ApiResponse.success(res, duePayments, 'Due payments fetched');
    } catch (error) {
      next(error);
    }
  }

  static async sendPaymentReminder(req: Request, res: Response, next: NextFunction) {
    try {
      const libraryId = req.user?.libraryId;
      const studentProfileId = req.params.studentId || req.body.studentProfileId;

      if (!libraryId || !studentProfileId) {
        return ApiResponse.error(res, 'Library and student context required', 400);
      }

      const result = await PaymentService.sendPaymentReminder(libraryId, studentProfileId);
      return ApiResponse.success(res, result, 'Payment reminder sent successfully');
    } catch (error) {
      next(error);
    }
  }
}
