import { Complaint } from '../models/complaint.model';
import { ComplaintStatus } from '../constants/statusEnums';
import { NotFoundError } from '../utils/customErrors';

export class ComplaintService {
  static async createComplaint(
    libraryId: string,
    studentId: string,
    category: string,
    title: string,
    description: string
  ) {
    const complaint = await Complaint.create({
      libraryId,
      studentId,
      category,
      title,
      description,
      status: ComplaintStatus.OPEN,
    });
    return complaint;
  }

  static async getStudentComplaints(studentId: string) {
    return Complaint.find({ studentId }).sort({ createdAt: -1 }).lean();
  }

  static async getLibraryComplaints(libraryId: string) {
    return Complaint.find({ libraryId })
      .populate({
        path: 'studentId',
        select: 'studentIdCardNo userId',
        populate: { path: 'userId', select: 'fullName phone' },
      })
      .sort({ createdAt: -1 })
      .lean();
  }

  static async updateComplaintStatus(
    libraryId: string,
    complaintId: string,
    status: ComplaintStatus,
    adminResponse?: string
  ) {
    const complaint = await Complaint.findOne({ _id: complaintId, libraryId });
    if (!complaint) {
      throw new NotFoundError('Complaint record not found');
    }

    complaint.status = status;
    if (adminResponse) complaint.adminResponse = adminResponse;
    await complaint.save();
    return complaint;
  }
}
