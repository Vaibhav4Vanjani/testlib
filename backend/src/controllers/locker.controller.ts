import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { LockerService } from '../services/locker.service';
import { ApiResponse } from '../utils/apiResponse';
import { ValidationError } from '../utils/customErrors';

const reserveLockerSchema = z.object({
  lockerId: z.string().min(1, 'lockerId is required'),
  durationMonths: z.number().min(1).max(12).default(1),
});

export class LockerController {
  static async getLockers(req: Request, res: Response, next: NextFunction) {
    try {
      const libraryId = req.user?.libraryId;
      if (!libraryId) {
        return ApiResponse.error(res, 'Library context required', 400);
      }

      const lockers = await LockerService.getLockers(libraryId);
      return ApiResponse.success(res, lockers, 'Lockers fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  static async reserveLocker(req: Request, res: Response, next: NextFunction) {
    try {
      const parseResult = reserveLockerSchema.safeParse(req.body);
      if (!parseResult.success) {
        throw new ValidationError(parseResult.error.errors[0].message);
      }

      const libraryId = req.user?.libraryId;
      const studentProfileId = req.user?.studentProfileId;

      if (!libraryId || !studentProfileId) {
        return ApiResponse.error(res, 'Student profile context required', 400);
      }

      const { lockerId, durationMonths } = parseResult.data;
      const updatedLocker = await LockerService.reserveLocker(libraryId, lockerId, studentProfileId, durationMonths);

      return ApiResponse.success(res, updatedLocker, 'Locker reserved successfully');
    } catch (error) {
      next(error);
    }
  }
}
