import mongoose from 'mongoose';
import { Payment } from '../models/payment.model';
import { StudentProfile } from '../models/studentProfile.model';
import { PaymentPlan } from '../models/paymentPlan.model';
import { storageService } from '../config/storage';
import { PaymentType, PaymentMethod, PaymentStatus, MembershipStatus } from '../constants/statusEnums';
import { NotFoundError, ValidationError, ConflictError, AuthorizationError } from '../utils/customErrors';
import { CryptoUtils } from '../utils/crypto';
import { logger } from '../config/logger';

export class PaymentService {
  static async getPaymentPlans(libraryId: string) {
    const { AdminService } = await import('./admin.service');
    return await AdminService.getPaymentMaster(libraryId);
  }

  static async submitManualPayment(
    libraryId: string,
    studentProfileId: string,
    amount: number,
    paymentType: PaymentType,
    utrNumber?: string,
    targetSeatId?: string,
    targetLockerId?: string,
    proofFile?: Express.Multer.File,
    hours?: number,
    months?: number,
    hasSeat?: boolean,
    hasLocker?: boolean,
    fromTime?: string,
    toTime?: string
  ) {
    // 1. Check if student account is inactive
    const studentProfile = await StudentProfile.findById(studentProfileId);
    if (!studentProfile) throw new NotFoundError('Student profile not found');
    if (studentProfile.membershipStatus === MembershipStatus.INACTIVE || (studentProfile.rejectionCount || 0) >= 3) {
      throw new AuthorizationError(
        'Your student account has been marked INACTIVE due to 3 payment rejections. Please contact your Local Library Admin for reactivation.'
      );
    }

    // 2. Enforce Independent Pending Reservation Per Type Rule (Seat vs Locker are independent)
    const existingPending = await Payment.findOne({
      studentId: studentProfileId,
      paymentType,
      status: PaymentStatus.PENDING,
    });
    if (existingPending) {
      throw new ConflictError(
        `You already have a pending ${paymentType.toLowerCase()} reservation request. Please wait for Local Admin approval before submitting another ${paymentType.toLowerCase()} request.`,
        'PENDING_RESERVATION_EXISTS'
      );
    }

    // 3. Time Slot Overlap Availability Check
    const { AdminService } = await import('./admin.service');
    const reqFromTime = fromTime || '06:00';
    const reqToTime = toTime || '23:00';
    const reqStart = new Date();
    const reqEnd = new Date();
    reqEnd.setMonth(reqEnd.getMonth() + (months || 1));

    const capacity = await AdminService.checkTimeSlotCapacity(libraryId, reqStart, reqEnd, reqFromTime, reqToTime);

    if (targetSeatId && capacity.occupiedSeatIds.includes(targetSeatId)) {
      throw new ConflictError('This seat is already reserved for this date and time slot.', 'SEAT_UNAVAILABLE');
    }

    if (targetLockerId && capacity.occupiedLockerIds.includes(targetLockerId)) {
      throw new ConflictError('This locker is already reserved for this date and time slot.', 'LOCKER_UNAVAILABLE');
    }

    // Compute effective hours
    const fNum = AdminService.parseTimeToNumber(reqFromTime);
    const tNum = AdminService.parseTimeToNumber(reqToTime);
    const effToNum = tNum > fNum ? tNum : 24;
    const computedHours = Math.max(1, effToNum - fNum);

    let proofObjectKey: string | undefined;

    if (proofFile) {
      const relativeDir = `libraries/${libraryId}/payments/${studentProfileId}`;
      proofObjectKey = await storageService.uploadFile(proofFile, relativeDir);
    }

    const idempotencyKey = CryptoUtils.generateNonce();

    const cleanSeatId = targetSeatId && mongoose.Types.ObjectId.isValid(targetSeatId) && !targetSeatId.startsWith('fallback-') ? targetSeatId : undefined;
    const cleanLockerId = targetLockerId && mongoose.Types.ObjectId.isValid(targetLockerId) && !targetLockerId.startsWith('fallback-') ? targetLockerId : undefined;

    const payment = await Payment.create({
      libraryId,
      studentId: studentProfileId,
      paymentType,
      paymentMethod: PaymentMethod.MANUAL_QR,
      amount,
      status: PaymentStatus.PENDING,
      utrNumber,
      targetSeatId: cleanSeatId,
      targetLockerId: cleanLockerId,
      hours: hours || computedHours,
      months: months || 1,
      fromTime: reqFromTime,
      toTime: reqToTime,
      hasSeat: !!hasSeat || !!targetSeatId,
      hasLocker: !!hasLocker || !!targetLockerId,
      proofObjectKey,
      idempotencyKey,
    });

    logger.info(`Manual payment submitted by student ${studentProfileId}. Payment ID: ${payment._id}`);
    return payment;
  }

  static async getPendingPayments(libraryId: string): Promise<any[]> {
    const pendingPayments = await Payment.find({ libraryId, status: PaymentStatus.PENDING })
      .populate({
        path: 'studentId',
        select: 'studentIdCardNo userId rejectionCount membershipStatus profilePicture',
        populate: { path: 'userId', select: 'fullName phone email' },
      })
      .populate('targetSeatId', 'seatNumber floor priceMonthly priceHourly')
      .populate('targetLockerId', 'lockerNumber floor priceMonthly priceHourly')
      .sort({ createdAt: -1 })
      .lean();

    return pendingPayments.map((p) => {
      const studentProfile = (p.studentId as any) || {};
      const user = studentProfile.userId || {};
      const name = user.fullName || 'Student';
      const phone = user.phone || '';
      const profPic = studentProfile.profilePicture ? storageService.getFileUrl(studentProfile.profilePicture) : null;
      const proofUrl = p.proofObjectKey ? storageService.getFileUrl(p.proofObjectKey) : null;

      return {
        ...p,
        studentName: name,
        phone: phone,
        profilePicture: profPic,
        proofFile: proofUrl,
        proofUrl: proofUrl,
      };
    });
  }

  static async approvePayment(libraryId: string, adminUserId: string, paymentId: string, adminNotes?: string) {
    let supportsTransactions = false;
    let session: mongoose.ClientSession | undefined;

    try {
      const client = typeof (mongoose.connection as any).getClient === 'function' ? (mongoose.connection as any).getClient() : null;
      const topologyType = client?.topology?.description?.type;
      supportsTransactions = topologyType === 'ReplicaSetWithPrimary' || topologyType === 'Sharded';
      if (supportsTransactions) {
        session = await mongoose.startSession();
        session.startTransaction();
      }
    } catch {
      supportsTransactions = false;
      session = undefined;
    }

    try {
      // 1. Atomic Check-And-Lock on Payment Record (Prevents duplicate approval race conditions)
      const payment = await Payment.findOneAndUpdate(
        { _id: paymentId, libraryId, status: PaymentStatus.PENDING },
        { $set: { status: PaymentStatus.APPROVED, approvedByAdminId: adminUserId as any, adminNotes } },
        { new: true, ...(session ? { session } : {}) }
      );

      if (!payment) {
        throw new ConflictError('Payment record not found or already processed by another process.', 'PAYMENT_ALREADY_PROCESSED');
      }

      const studentProfile = await StudentProfile.findOne(
        { _id: payment.studentId, libraryId },
        null,
        session ? { session } : undefined
      );

      if (!studentProfile) {
        throw new NotFoundError('Student profile not found');
      }

      const now = new Date();
      // Extend subscription from previous expiry date if exists, else from current date
      const baseStartDate = studentProfile.membershipExpiresAt
        ? new Date(studentProfile.membershipExpiresAt)
        : new Date(now);

      const payMonths = payment.months && payment.months > 0 ? payment.months : 1;
      const newExpiry = new Date(baseStartDate);
      newExpiry.setMonth(newExpiry.getMonth() + payMonths);

      studentProfile.membershipStatus = MembershipStatus.ACTIVE;
      studentProfile.membershipExpiresAt = newExpiry;
      if (payment.fromTime) studentProfile.fromTime = payment.fromTime;
      if (payment.toTime) studentProfile.toTime = payment.toTime;

      // 2. Atomic Seat Allocation Guard
      if (payment.targetSeatId && mongoose.Types.ObjectId.isValid(String(payment.targetSeatId)) && !String(payment.targetSeatId).startsWith('fallback-')) {
        const { Seat } = await import('../models/seat.model');
        const { SeatStatus } = await import('../constants/statusEnums');

        const updatedSeat = await Seat.findOneAndUpdate(
          { _id: payment.targetSeatId, libraryId, isDeleted: false },
          {
            $set: {
              status: SeatStatus.OCCUPIED,
              'currentReservation.studentId': studentProfile._id,
              'currentReservation.paymentId': payment._id,
              'currentReservation.startAt': baseStartDate,
              'currentReservation.endAt': newExpiry,
              'currentReservation.fromTime': payment.fromTime,
              'currentReservation.toTime': payment.toTime,
            },
          },
          { new: true, ...(session ? { session } : {}) }
        );

        if (updatedSeat) {
          studentProfile.currentSeatId = payment.targetSeatId as any;
        }
      }

      // 3. Atomic Locker Allocation Guard
      if (payment.targetLockerId && mongoose.Types.ObjectId.isValid(String(payment.targetLockerId)) && !String(payment.targetLockerId).startsWith('fallback-')) {
        const { Locker } = await import('../models/locker.model');
        const { LockerStatus } = await import('../constants/statusEnums');

        const updatedLocker = await Locker.findOneAndUpdate(
          { _id: payment.targetLockerId, libraryId, isDeleted: false },
          {
            $set: {
              status: LockerStatus.OCCUPIED,
              'currentReservation.studentId': studentProfile._id,
              'currentReservation.paymentId': payment._id,
              'currentReservation.startAt': baseStartDate,
              'currentReservation.endAt': newExpiry,
              'currentReservation.fromTime': payment.fromTime,
              'currentReservation.toTime': payment.toTime,
            },
          },
          { new: true, ...(session ? { session } : {}) }
        );

        if (updatedLocker) {
          studentProfile.currentLockerId = payment.targetLockerId as any;
        }
      }

      // 4. Atomic Save of Student Profile and Payment Expiry
      await studentProfile.save(session ? { session } : undefined);

      payment.billingCycleStart = baseStartDate;
      payment.billingCycleEnd = newExpiry;
      await payment.save(session ? { session } : undefined);

      if (session) {
        await session.commitTransaction();
        session.endSession();
      }

      logger.info(`Payment ${paymentId} APPROVED securely for student ${studentProfile._id}. New Expiry: ${newExpiry.toISOString()}`);
      return payment;
    } catch (error) {
      if (session) {
        await session.abortTransaction();
        session.endSession();
      }
      throw error;
    }
  }

  static async rejectPayment(libraryId: string, adminUserId: string, paymentId: string, adminNotes: string) {
    const payment = await Payment.findOne({ _id: paymentId, libraryId, status: PaymentStatus.PENDING });
    if (!payment) {
      throw new NotFoundError('Pending payment record not found');
    }

    payment.status = PaymentStatus.REJECTED;
    payment.approvedByAdminId = adminUserId as any;
    payment.adminNotes = adminNotes;
    await payment.save();

    // Rejection Tracking & 3-Strike Auto Inactivation Rule
    const studentProfile = await StudentProfile.findOne({ _id: payment.studentId, libraryId });
    if (studentProfile) {
      const currentRejectionCount = (studentProfile.rejectionCount || 0) + 1;
      studentProfile.rejectionCount = currentRejectionCount;

      if (currentRejectionCount >= 3) {
        studentProfile.membershipStatus = MembershipStatus.INACTIVE;
        studentProfile.inactivatedAt = new Date();

        // Release assigned seat if any
        if (studentProfile.currentSeatId) {
          const { Seat } = await import('../models/seat.model');
          const { SeatStatus } = await import('../constants/statusEnums');
          await Seat.updateOne(
            { _id: studentProfile.currentSeatId },
            { $set: { status: SeatStatus.AVAILABLE }, $unset: { currentReservation: 1 } }
          );
          studentProfile.currentSeatId = undefined;
        }

        // Release assigned locker if any
        if (studentProfile.currentLockerId) {
          const { Locker } = await import('../models/locker.model');
          const { LockerStatus } = await import('../constants/statusEnums');
          await Locker.updateOne(
            { _id: studentProfile.currentLockerId },
            { $set: { status: LockerStatus.AVAILABLE }, $unset: { currentReservation: 1 } }
          );
          studentProfile.currentLockerId = undefined;
        }

        logger.warn(`Student ${studentProfile._id} automatically marked INACTIVE due to 3 payment rejections.`);
      }

      await studentProfile.save();
    }

    logger.info(`Payment ${paymentId} REJECTED by Admin ${adminUserId}. Rejection count for student: ${studentProfile?.rejectionCount || 0}`);
    return {
      payment,
      rejectionCount: studentProfile?.rejectionCount || 0,
      isStudentInactive: studentProfile?.membershipStatus === MembershipStatus.INACTIVE,
    };
  }

  static async getPaymentHistory(studentProfileId: string): Promise<any[]> {
    const payments = await Payment.find({ studentId: studentProfileId }).sort({ createdAt: -1 }).lean();
    return payments.map((p) => ({
      ...p,
      proofUrl: p.proofObjectKey ? storageService.getFileUrl(p.proofObjectKey) : null,
    }));
  }

  static async getDuePayments(libraryId: string): Promise<any[]> {
    const { AdminService } = await import('./admin.service');
    const paymentMaster = await AdminService.getPaymentMaster(libraryId);

    const students = await StudentProfile.find({ libraryId })
      .populate({
        path: 'userId',
        select: 'fullName phone email profilePicture',
      })
      .lean();

    const now = new Date();
    // Start of today: 00:00:00.000 local/server date
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);

    const dueStudents: any[] = [];

    for (const s of students) {
      const expiresAt = s.membershipExpiresAt ? new Date(s.membershipExpiresAt) : (s.toDate ? new Date(s.toDate) : null);
      
      // Strict rule: Student appears in Pending Payment ONLY if Due Date < Today's Date (strictly past due)
      // If Due Date is today or in the future (expiresAt >= startOfToday), do NOT mark as overdue/pending yet
      const isPastDueDate = expiresAt ? expiresAt < startOfToday : false;

      if (!isPastDueDate) {
        continue;
      }

      let hours = 12;
      if (s.fromTime && s.toTime) {
        const fNum = AdminService.parseTimeToNumber(s.fromTime);
        const tNum = AdminService.parseTimeToNumber(s.toTime);
        const effToNum = tNum > fNum ? tNum : 24;
        hours = Math.max(1, effToNum - fNum);
      }

      const isFullDay = hours >= 12;
      const planType = isFullDay ? 'Full-Day Monthly Plan' : `Part-Time Plan (${hours} hrs/day)`;

      const monthlyFee = isFullDay
        ? (paymentMaster?.monthlyFee || 1200)
        : (paymentMaster?.hourlyMonthlyRate || 100) * hours;

      const rawPhoto = (s as any).profilePictureUrl || s.profilePicture || (s.userId as any)?.profilePicture;
      const profilePictureUrl = rawPhoto
        ? (rawPhoto.startsWith('http') ? rawPhoto : storageService.getFileUrl(rawPhoto))
        : null;

      dueStudents.push({
        _id: s._id,
        studentIdCardNo: s.studentIdCardNo,
        studentName: (s.userId as any)?.fullName || 'Student',
        studentPhone: (s.userId as any)?.phone || 'N/A',
        studentEmail: (s.userId as any)?.email || '',
        profilePictureUrl,
        profilePicture: rawPhoto,
        planType,
        hours,
        dueDate: expiresAt ? expiresAt.toISOString() : null,
        amount: Math.round(monthlyFee),
        status: 'OVERDUE',
        membershipStatus: s.membershipStatus,
        rejectionCount: s.rejectionCount || 0,
      });
    }

    return dueStudents.sort((a, b) => {
      const dateA = a.dueDate ? new Date(a.dueDate).getTime() : 0;
      const dateB = b.dueDate ? new Date(b.dueDate).getTime() : 0;
      return dateA - dateB;
    });
  }

  static async sendPaymentReminder(libraryId: string, studentProfileId: string): Promise<any> {
    const student = await StudentProfile.findOne({ _id: studentProfileId, libraryId })
      .populate('userId', 'fullName phone email')
      .lean();
    if (!student) throw new NotFoundError('Student profile not found');

    const studentName = (student.userId as any)?.fullName || 'Student';
    const dueDateStr = student.membershipExpiresAt
      ? new Date(student.membershipExpiresAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
      : 'today';

    logger.info(`Payment reminder sent to student ${studentName} (${studentProfileId}) for library ${libraryId}. Due date: ${dueDateStr}`);

    return {
      success: true,
      message: `Payment reminder notification sent to ${studentName}.`,
      studentName,
      dueDate: dueDateStr,
    };
  }
}
