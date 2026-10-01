import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { SeatService } from '../services/seat.service';
import { ApiResponse } from '../utils/apiResponse';
import { ValidationError } from '../utils/customErrors';
import { SeatStatus } from '../constants/statusEnums';

const reserveSeatSchema = z.object({
  seatId: z.string().min(1, 'seatId is required'),
  durationMonths: z.number().min(1).max(12).default(1),
});

const updateSeatStatusSchema = z.object({
  status: z.nativeEnum(SeatStatus),
});

export class SeatController {
  static async getSeats(req: Request, res: Response, next: NextFunction) {
    try {
      const libraryId = req.user?.libraryId;
      if (!libraryId) {
        return ApiResponse.error(res, 'Library context required', 400);
      }

      const seats = await SeatService.getSeats(libraryId);
      return ApiResponse.success(res, seats, 'Seats fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  static async reserveSeat(req: Request, res: Response, next: NextFunction) {
    try {
      const parseResult = reserveSeatSchema.safeParse(req.body);
      if (!parseResult.success) {
        throw new ValidationError(parseResult.error.errors[0].message);
      }

      const libraryId = req.user?.libraryId;
      const studentProfileId = req.user?.studentProfileId;

      if (!libraryId || !studentProfileId) {
        return ApiResponse.error(res, 'Student profile context required', 400);
      }

      const { seatId, durationMonths } = parseResult.data;
      const updatedSeat = await SeatService.reserveSeat(libraryId, seatId, studentProfileId, durationMonths);

      return ApiResponse.success(res, updatedSeat, 'Seat reserved successfully');
    } catch (error) {
      next(error);
    }
  }

  static async updateSeatStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const parseResult = updateSeatStatusSchema.safeParse(req.body);
      if (!parseResult.success) {
        throw new ValidationError(parseResult.error.errors[0].message);
      }

      const libraryId = req.user?.libraryId;
      const seatId = req.params.id;

      if (!libraryId) {
        return ApiResponse.error(res, 'Library context required', 400);
      }

      const updatedSeat = await SeatService.updateSeatStatus(libraryId, seatId, parseResult.data.status);
      return ApiResponse.success(res, updatedSeat, 'Seat status updated');
    } catch (error) {
      next(error);
    }
  }
}
