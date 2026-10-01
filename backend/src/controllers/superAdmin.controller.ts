import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { SuperAdminService } from '../services/superAdmin.service';
import { ApiResponse } from '../utils/apiResponse';
import { ValidationError } from '../utils/customErrors';

const createLibrarySchema = z.object({
  name: z.string().min(2, 'Library name is required'),
  code: z.string().optional(),
  address: z.string().optional(),
  contactPhone: z.string().refine((val) => !val || /^\d{10}$/.test(val.trim()), { message: 'Library Contact Phone must be exactly 10 numeric digits' }).optional(),
  openingTime: z.string().optional(),
  closingTime: z.string().optional(),
  adminName: z.string().min(2, 'Admin name is required'),
  adminPhone: z.string().regex(/^\d{10}$/, 'Local Admin Phone Number must be exactly 10 numeric digits'),
  adminPassword: z.string().optional(),
  saasPlanType: z.enum(['MONTHLY', 'YEARLY']).optional(),
  saasAmount: z.number().min(0).optional(),
});

export class SuperAdminController {
  static async getNextLibraryCode(req: Request, res: Response, next: NextFunction) {
    try {
      const prefix = (req.query.prefix as string) || 'LIB';
      const nextCode = await SuperAdminService.getNextLibraryCode(prefix);
      return ApiResponse.success(res, { nextCode }, 'Next library code generated');
    } catch (error) {
      next(error);
    }
  }

  static async getPlatformOverview(_req: Request, res: Response, next: NextFunction) {
    try {
      const overview = await SuperAdminService.getPlatformOverview();
      return ApiResponse.success(res, overview, 'Super Admin platform overview fetched');
    } catch (error) {
      next(error);
    }
  }

  static async createLibraryTenant(req: Request, res: Response, next: NextFunction) {
    try {
      const parseResult = createLibrarySchema.safeParse(req.body);
      if (!parseResult.success) {
        throw new ValidationError(parseResult.error.errors[0].message);
      }

      const result = await SuperAdminService.createLibraryTenant(parseResult.data);
      return ApiResponse.success(res, result, 'New Library tenant and Library Admin onboarded successfully!');
    } catch (error) {
      next(error);
    }
  }

  static async getLibrariesSummary(_req: Request, res: Response, next: NextFunction) {
    try {
      const summary = await SuperAdminService.getLibrariesSummary();
      return ApiResponse.success(res, summary, 'Local libraries summary fetched');
    } catch (error) {
      next(error);
    }
  }

  static async updateLocalAdminStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { libraryId } = req.params;
      const { isActive } = req.body;
      const result = await SuperAdminService.updateLocalAdminStatus(libraryId, Boolean(isActive));
      return ApiResponse.success(res, result, result.message);
    } catch (error) {
      next(error);
    }
  }

  static async getPlatformEarnings(_req: Request, res: Response, next: NextFunction) {
    try {
      const earnings = await SuperAdminService.getPlatformEarnings();
      return ApiResponse.success(res, earnings, 'Platform earnings fetched');
    } catch (error) {
      next(error);
    }
  }

  static async broadcastNotification(req: Request, res: Response, next: NextFunction) {
    try {
      const { targetLibraryId, title, body } = req.body;
      const result = await SuperAdminService.broadcastNotification(targetLibraryId, title, body);
      return ApiResponse.success(res, result, 'Broadcast sent');
    } catch (error) {
      next(error);
    }
  }

  static async getNotifications(_req: Request, res: Response, next: NextFunction) {
    try {
      const notifs = await SuperAdminService.getNotifications();
      return ApiResponse.success(res, notifs, 'Super Admin notifications fetched');
    } catch (error) {
      next(error);
    }
  }

  static async hideNotification(req: Request, res: Response, next: NextFunction) {
    try {
      const { notificationId } = req.params;
      const result = await SuperAdminService.hideNotification(notificationId);
      return ApiResponse.success(res, result, result.message);
    } catch (error) {
      next(error);
    }
  }

  static async updateFeatureFlags(req: Request, res: Response, next: NextFunction) {
    try {
      const libraryId = req.params.id;
      const { featureFlags } = req.body;
      const updated = await SuperAdminService.updateFeatureFlags(libraryId, featureFlags);
      return ApiResponse.success(res, updated, 'Library feature flags updated');
    } catch (error) {
      next(error);
    }
  }

  static async getSaaSPayments(req: Request, res: Response, next: NextFunction) {
    try {
      const statusFilter = (req.query.status as string) || 'ALL';
      const payments = await SuperAdminService.getSaaSPayments(statusFilter);
      return ApiResponse.success(res, payments, 'SaaS payments fetched');
    } catch (error) {
      next(error);
    }
  }

  static async approveSaaSPayment(req: Request, res: Response, next: NextFunction) {
    try {
      const { paymentId } = req.params;
      const superAdminUserId = req.user!.userId;
      const result = await SuperAdminService.approveSaaSPayment(paymentId, superAdminUserId);
      return ApiResponse.success(res, result, result.message);
    } catch (error) {
      next(error);
    }
  }

  static async rejectSaaSPayment(req: Request, res: Response, next: NextFunction) {
    try {
      const { paymentId } = req.params;
      const { rejectionReason } = req.body;
      const superAdminUserId = req.user!.userId;
      const result = await SuperAdminService.rejectSaaSPayment(paymentId, rejectionReason, superAdminUserId);
      return ApiResponse.success(res, result, result.message);
    } catch (error) {
      next(error);
    }
  }

  static async updateLocalAdminDetails(req: Request, res: Response, next: NextFunction) {
    try {
      const { libraryId } = req.params;
      const { adminName, adminPhone, saasPlanType, saasAmount } = req.body;
      const result = await SuperAdminService.updateLocalAdminDetails(libraryId, {
        adminName,
        adminPhone,
        saasPlanType,
        saasAmount: saasAmount !== undefined ? parseFloat(saasAmount) : undefined,
      });
      return ApiResponse.success(res, result, result.message);
    } catch (error) {
      next(error);
    }
  }
}
