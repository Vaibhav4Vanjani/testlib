import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ComplaintService } from '../services/complaint.service';
import { ApiResponse } from '../utils/apiResponse';
import { ValidationError } from '../utils/customErrors';
import { ComplaintStatus } from '../constants/statusEnums';

const createComplaintSchema = z.object({
  category: z.string().min(1, 'Category is required'),
  title: z.string().min(2, 'Title is required'),
  description: z.string().min(5, 'Description is required'),
});

const updateComplaintStatusSchema = z.object({
  status: z.nativeEnum(ComplaintStatus),
  adminResponse: z.string().optional(),
});

export class ComplaintController {
  static async createComplaint(req: Request, res: Response, next: NextFunction) {
    try {
      const parseResult = createComplaintSchema.safeParse(req.body);
      if (!parseResult.success) {
        throw new ValidationError(parseResult.error.errors[0].message);
      }

      const libraryId = req.user?.libraryId;
      const studentProfileId = req.user?.studentProfileId;

      if (!libraryId || !studentProfileId) {
        return ApiResponse.error(res, 'Student context required', 400);
      }

      const { category, title, description } = parseResult.data;
      const complaint = await ComplaintService.createComplaint(libraryId, studentProfileId, category, title, description);

      return ApiResponse.success(res, complaint, 'Complaint submitted successfully');
    } catch (error) {
      next(error);
    }
  }

  static async getStudentComplaints(req: Request, res: Response, next: NextFunction) {
    try {
      const studentProfileId = req.user?.studentProfileId;
      if (!studentProfileId) {
        return ApiResponse.error(res, 'Student context required', 400);
      }

      const complaints = await ComplaintService.getStudentComplaints(studentProfileId);
      return ApiResponse.success(res, complaints, 'Complaints fetched');
    } catch (error) {
      next(error);
    }
  }

  static async getLibraryComplaints(req: Request, res: Response, next: NextFunction) {
    try {
      const libraryId = req.user?.libraryId;
      if (!libraryId) {
        return ApiResponse.error(res, 'Library context required', 400);
      }

      const complaints = await ComplaintService.getLibraryComplaints(libraryId);
      return ApiResponse.success(res, complaints, 'Library complaints fetched');
    } catch (error) {
      next(error);
    }
  }

  static async updateStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const parseResult = updateComplaintStatusSchema.safeParse(req.body);
      if (!parseResult.success) {
        throw new ValidationError(parseResult.error.errors[0].message);
      }

      const libraryId = req.user?.libraryId;
      const complaintId = req.params.id;

      if (!libraryId) {
        return ApiResponse.error(res, 'Library context required', 400);
      }

      const updated = await ComplaintService.updateComplaintStatus(
        libraryId,
        complaintId,
        parseResult.data.status,
        parseResult.data.adminResponse
      );

      return ApiResponse.success(res, updated, 'Complaint status updated');
    } catch (error) {
      next(error);
    }
  }
}
