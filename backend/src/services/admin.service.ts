import { StudentProfile } from '../models/studentProfile.model';
import { Seat, ISeatReservation } from '../models/seat.model';
import { Locker, ILockerReservation } from '../models/locker.model';
import { Payment } from '../models/payment.model';
import { AttendanceSession } from '../models/attendanceSession.model';
import { AuditLog } from '../models/auditLog.model';
import { Library } from '../models/library.model';
import { PaymentPlan } from '../models/paymentPlan.model';
import { sortItemsNaturally } from '../utils/sorting';
import { CryptoUtils } from '../utils/crypto';
import { ValidationError, NotFoundError, ForbiddenError } from '../utils/customErrors';
import { UserRole } from '../constants/roles';
import { PaymentMethod, PaymentType } from '../constants/statusEnums';
import { SeatStatus, LockerStatus, PaymentStatus, AttendanceStatus, MembershipStatus } from '../constants/statusEnums';
import { QRService } from './qr.service';

export class AdminService {
  static async getDashboardMetrics(libraryId: string): Promise<any> {
    const library = await Library.findById(libraryId).select('name code address city state featureFlags').lean();

    const totalStudents = await StudentProfile.countDocuments({ libraryId });
    const activeStudents = await StudentProfile.countDocuments({ libraryId, membershipStatus: MembershipStatus.ACTIVE });

    const totalSeats = await Seat.countDocuments({ libraryId, isDeleted: false });
    const occupiedSeats = await Seat.countDocuments({ libraryId, isDeleted: false, status: { $in: [SeatStatus.RESERVED, SeatStatus.OCCUPIED] } });

    const totalLockers = await Locker.countDocuments({ libraryId, isDeleted: false });
    const occupiedLockers = await Locker.countDocuments({ libraryId, isDeleted: false, status: { $in: [LockerStatus.RESERVED, LockerStatus.OCCUPIED] } });

    const pendingPayments = await Payment.countDocuments({ libraryId, status: PaymentStatus.PENDING });

    // Active Super Admin Announcements / Broadcasts for this library
    const { Notification } = require('../models/notification.model');
    const now = new Date();
    const activeAnnouncements = await Notification.find({
      libraryId,
      type: { $in: ['SUPER_ADMIN_BROADCAST', 'SUPER_ADMIN_ANNOUNCEMENT'] },
      status: 'ACTIVE',
      expiresAt: { $gt: now },
    })
      .sort({ createdAt: -1 })
      .lean();

    // Financial earnings aggregation
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const todayEarningsAgg = await Payment.aggregate([
      { $match: { libraryId: new (require('mongoose').Types.ObjectId)(libraryId), status: PaymentStatus.APPROVED, createdAt: { $gte: startOfToday } } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);

    const monthlyEarningsAgg = await Payment.aggregate([
      { $match: { libraryId: new (require('mongoose').Types.ObjectId)(libraryId), status: PaymentStatus.APPROVED, createdAt: { $gte: startOfMonth } } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);

    const todayEarnings = todayEarningsAgg[0]?.total || 0;
    const monthlyEarnings = monthlyEarningsAgg[0]?.total || 0;

    return {
      libraryName: library?.name || 'Library Dashboard',
      libraryCode: library?.code || '',
      libraryAddress: library?.address || '',
      announcements: activeAnnouncements || [],
      activeStudents,
      totalStudents,
      seatOccupancy: {
        occupied: occupiedSeats,
        total: totalSeats,
        available: Math.max(0, totalSeats - occupiedSeats),
        occupancyRate: totalSeats > 0 ? Math.round((occupiedSeats / totalSeats) * 100) : 0,
      },
      lockerOccupancy: {
        occupied: occupiedLockers,
        total: totalLockers,
        available: Math.max(0, totalLockers - occupiedLockers),
        occupancyRate: totalLockers > 0 ? Math.round((occupiedLockers / totalLockers) * 100) : 0,
      },
      pendingPayments,
      todayEarnings,
      monthlyEarnings,
      featureFlags: library?.featureFlags || {
        enableReservedSeats: true,
        enableLockers: true,
        enableReferrals: true,
      },
    };
  }

  static async searchStudents(libraryId: string, search?: string, status?: string, page = 1, limit = 20): Promise<any> {
    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(100, Math.max(1, Number(limit) || 20));

    const andConditions: any[] = [{ libraryId }];

    if (status === 'EXPIRED') {
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      andConditions.push({
        $or: [
          { membershipStatus: 'EXPIRED' },
          { toDate: { $ne: null, $lt: startOfToday } },
          { membershipExpiresAt: { $ne: null, $lt: startOfToday } },
        ],
      });
    } else if (status === 'ACTIVE') {
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      andConditions.push({
        membershipStatus: 'ACTIVE',
        $and: [
          { $or: [{ toDate: null }, { toDate: { $exists: false } }, { toDate: { $gte: startOfToday } }] },
          { $or: [{ membershipExpiresAt: null }, { membershipExpiresAt: { $exists: false } }, { membershipExpiresAt: { $gte: startOfToday } }] },
        ],
      });
    } else if (status) {
      andConditions.push({ membershipStatus: status });
    }

    if (search && search.trim()) {
      const cleanSearch = search.trim();
      const { User } = require('../models/user.model');
      const matchingUsers = await User.find({
        $or: [
          { fullName: { $regex: cleanSearch, $options: 'i' } },
          { phone: { $regex: cleanSearch, $options: 'i' } },
        ],
      }).select('_id').lean();

      const userIds = matchingUsers.map((u: any) => u._id);

      andConditions.push({
        $or: [
          { studentIdCardNo: { $regex: cleanSearch, $options: 'i' } },
          { userId: { $in: userIds } },
        ],
      });
    }

    const query = andConditions.length === 1 ? andConditions[0] : { $and: andConditions };

    const skip = (pageNum - 1) * limitNum;
    const { Payment } = require('../models/payment.model');

    const [rawStudents, total] = await Promise.all([
      StudentProfile.find(query)
        .populate('userId', 'fullName phone email isActive')
        .populate('currentSeatId', 'seatNumber floor priceMonthly currentReservation')
        .populate('currentLockerId', 'lockerNumber floor priceMonthly currentReservation')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      StudentProfile.countDocuments(query),
    ]);

    const studentIds = rawStudents.map((s: any) => s._id);
    const latestPaymentsMap: Record<string, any> = {};
    const paymentsHistoryMap: Record<string, any[]> = {};
    const { storageService } = require('../config/storage');

    if (studentIds.length > 0) {
      const allPayments = await Payment.find({ studentId: { $in: studentIds } }).sort({ createdAt: -1 }).lean();
      allPayments.forEach((p: any) => {
        const sId = p.studentId.toString();
        if (!paymentsHistoryMap[sId]) paymentsHistoryMap[sId] = [];
        const formattedPay = {
          _id: p._id,
          amount: p.amount,
          paymentMethod: p.paymentMethod,
          paymentType: p.paymentType,
          status: p.status,
          utrNumber: p.utrNumber || null,
          months: p.months || null,
          hours: p.hours || null,
          fromTime: p.fromTime || null,
          toTime: p.toTime || null,
          adminNotes: p.adminNotes || p.rejectionReason || null,
          proofImageUrl: (p.proofImage || p.proofUrl) ? storageService.getFileUrl(p.proofImage || p.proofUrl) : null,
          createdAt: p.createdAt,
        };
        paymentsHistoryMap[sId].push(formattedPay);

        if (!latestPaymentsMap[sId]) {
          latestPaymentsMap[sId] = formattedPay;
        }
      });
    }

    let activeSessionsMap: Record<string, any> = {};
    let pendingRequestsMap: Record<string, any> = {};
    if (studentIds.length > 0) {
      const { AttendanceSession } = require('../models/attendanceSession.model');
      const { AttendanceRequest } = require('../models/attendanceRequest.model');
      const { AttendanceStatus } = require('../constants/statusEnums');

      const [activeSessions, pendingRequests] = await Promise.all([
        AttendanceSession.find({
          libraryId,
          studentId: { $in: studentIds },
          status: AttendanceStatus.ACTIVE,
        }).lean(),
        AttendanceRequest.find({
          libraryId,
          studentProfileId: { $in: studentIds },
          status: 'PENDING',
        }).lean(),
      ]);

      activeSessions.forEach((sess: any) => {
        activeSessionsMap[sess.studentId.toString()] = sess;
      });

      pendingRequests.forEach((req: any) => {
        pendingRequestsMap[req.studentProfileId.toString()] = req;
      });
    }

    const students = rawStudents.map((student: any) => ({
      ...student,
      profilePictureUrl: student.profilePicture ? storageService.getFileUrl(student.profilePicture) : null,
      latestPayment: latestPaymentsMap[student._id.toString()] || null,
      paymentsHistory: paymentsHistoryMap[student._id.toString()] || [],
      activeAttendanceSession: activeSessionsMap[student._id.toString()] || null,
      pendingAttendanceRequest: pendingRequestsMap[student._id.toString()] || null,
      isCheckedIn: !!activeSessionsMap[student._id.toString()],
    }));

    return {
      students,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
        hasMore: pageNum * limitNum < total,
      },
    };
  }

  static async updateStudentStatus(libraryId: string, studentProfileId: string, status: string): Promise<any> {
    const { User } = require('../models/user.model');
    const { ValidationError } = require('../utils/customErrors');
    const { MembershipStatus, SeatStatus, LockerStatus } = require('../constants/statusEnums');

    const profile = await StudentProfile.findOne({ _id: studentProfileId, libraryId });
    if (!profile) {
      throw new ValidationError('Student profile not found');
    }

    if (status === 'INACTIVE') {
      profile.membershipStatus = MembershipStatus.INACTIVE;
      profile.inactivatedAt = new Date();

      // Deactivate associated user
      await User.findByIdAndUpdate(profile.userId, { isActive: false });

      // Release reserved seat if assigned
      if (profile.currentSeatId) {
        await Seat.findByIdAndUpdate(profile.currentSeatId, {
          status: SeatStatus.AVAILABLE,
          $unset: { currentReservation: 1 },
        });
        profile.currentSeatId = undefined;
      }

      // Release reserved locker if assigned
      if (profile.currentLockerId) {
        await Locker.findByIdAndUpdate(profile.currentLockerId, {
          status: LockerStatus.AVAILABLE,
          $unset: { currentReservation: 1 },
        });
        profile.currentLockerId = undefined;
      }
    } else if (status === 'ACTIVE') {
      profile.membershipStatus = MembershipStatus.ACTIVE;
      profile.inactivatedAt = undefined;
      profile.rejectionCount = 0;
      await User.findByIdAndUpdate(profile.userId, { isActive: true });
    }

    await profile.save();
    return {
      success: true,
      message: `Student status updated to ${status} successfully`,
      student: profile,
    };
  }

  static async updateStudentProfile(
    libraryId: string,
    studentProfileId: string,
    payload: {
      fullName?: string;
      phone?: string;
      aadharNumber?: string;
      newPassword?: string;
      profilePicturePath?: string;
      fromTime?: string;
      toTime?: string;
      fromDate?: string;
      toDate?: string;
    }
  ): Promise<any> {
    const { User } = require('../models/user.model');
    const { CryptoUtils } = require('../utils/crypto');
    const { ValidationError, NotFoundError } = require('../utils/customErrors');
    const { storageService } = require('../config/storage');
    const { Payment } = require('../models/payment.model');

    const profile = await StudentProfile.findOne({ _id: studentProfileId, libraryId });
    if (!profile) {
      throw new NotFoundError('Student profile not found');
    }

    const user = await User.findById(profile.userId);
    if (!user) {
      throw new NotFoundError('Student user account not found');
    }

    if (payload.fullName && payload.fullName.trim()) {
      user.fullName = payload.fullName.trim();
    }

    if (payload.phone && payload.phone.trim()) {
      const cleanPhone = payload.phone.trim();
      if (cleanPhone !== user.phone) {
        const libraryProfiles = await StudentProfile.find({ libraryId, _id: { $ne: studentProfileId } }).select('userId');
        const userIds = libraryProfiles.map((p) => p.userId);
        const duplicate = await User.findOne({ _id: { $in: userIds }, phone: cleanPhone });
        if (duplicate) {
          throw new ValidationError(`A student with phone number ${cleanPhone} is already enrolled in this library.`);
        }
        user.phone = cleanPhone;
      }
    }

    let passwordUpdated = false;
    if (payload.newPassword && payload.newPassword.trim()) {
      const cleanPassword = payload.newPassword.trim();
      if (cleanPassword.length < 4) {
        throw new ValidationError('New password must be at least 4 characters long.');
      }
      user.passwordHash = await CryptoUtils.hashPassword(cleanPassword);
      passwordUpdated = true;
    }

    await user.save();

    if (payload.aadharNumber !== undefined) {
      profile.aadharNumber = payload.aadharNumber.trim() || undefined;
    }

    if (payload.profilePicturePath) {
      profile.profilePicture = payload.profilePicturePath;
    }

    if (payload.fromTime !== undefined) {
      profile.fromTime = payload.fromTime.trim() || undefined;
    }

    if (payload.toTime !== undefined) {
      profile.toTime = payload.toTime.trim() || undefined;
    }

    if (payload.fromDate) {
      const fD = new Date(payload.fromDate);
      if (!isNaN(fD.getTime())) {
        profile.fromDate = fD;
      }
    }

    if (payload.toDate) {
      const tD = new Date(payload.toDate);
      if (!isNaN(tD.getTime())) {
        profile.toDate = tD;
        profile.membershipExpiresAt = tD;
      }
    }

    await profile.save();

    const updatedRaw = await StudentProfile.findById(profile._id)
      .populate('userId', 'fullName phone email isActive')
      .populate('currentSeatId', 'seatNumber floor priceMonthly currentReservation')
      .populate('currentLockerId', 'lockerNumber floor priceMonthly currentReservation')
      .lean();

    const latestPayment = await Payment.findOne({ studentId: profile._id })
      .sort({ createdAt: -1 })
      .select('amount paymentMethod paymentType status createdAt')
      .lean();

    const updatedStudent = {
      ...updatedRaw,
      profilePictureUrl: profile.profilePicture ? storageService.getFileUrl(profile.profilePicture) : null,
      latestPayment: latestPayment || null,
    };

    return {
      student: updatedStudent,
      passwordUpdated,
      tempPassword: passwordUpdated ? payload.newPassword!.trim() : null,
    };
  }

  static calculateSlotDurationHours(fromVal: string, toVal: string): number {
    const f = AdminService.parseTimeToNumber(fromVal);
    const t = AdminService.parseTimeToNumber(toVal);
    const effT = t > f ? t : 24;
    return Math.max(1, effT - f);
  }

  static async extendStudentMembership(
    libraryId: string,
    studentProfileId: string,
    months?: number,
    requestedNewToDate?: string,
    recordPayment: boolean = true,
    requestedFromTime?: string,
    requestedToTime?: string,
    requestedBaseDate?: string
  ): Promise<any> {
    const { ValidationError, NotFoundError } = require('../utils/customErrors');
    const { storageService } = require('../config/storage');

    const profile = await StudentProfile.findOne({ _id: studentProfileId, libraryId }).populate('userId');
    if (!profile) throw new NotFoundError('Student profile not found');

    const now = new Date();
    now.setHours(0, 0, 0, 0);

    let baseYear = now.getFullYear();
    let baseMonth = now.getMonth();
    let baseDay = now.getDate();
    let baseDate = now;

    if (requestedBaseDate && typeof requestedBaseDate === 'string' && /^\d{4}-\d{2}-\d{2}/.test(requestedBaseDate.trim())) {
      const clean = requestedBaseDate.trim().split('T')[0];
      const parts = clean.split('-').map((p: string) => parseInt(p, 10));
      if (parts.length === 3 && !parts.some(isNaN)) {
        baseDate = new Date(parts[0], parts[1] - 1, parts[2]);
        baseYear = baseDate.getFullYear();
        baseMonth = baseDate.getMonth();
        baseDay = baseDate.getDate();
      }
    } else {
      const expiryRaw: any = profile.toDate || profile.membershipExpiresAt;
      if (expiryRaw) {
        let expiryD: Date;
        if (typeof expiryRaw === 'string') {
          const clean = expiryRaw.split('T')[0];
          const parts = clean.split('-').map((p: string) => parseInt(p, 10));
          if (parts.length === 3 && !parts.some(isNaN)) {
            expiryD = new Date(parts[0], parts[1] - 1, parts[2]);
          } else {
            expiryD = new Date(expiryRaw);
          }
        } else {
          expiryD = new Date(expiryRaw);
        }
        if (!isNaN(expiryD.getTime())) {
          baseYear = expiryD.getFullYear();
          baseMonth = expiryD.getMonth();
          baseDay = expiryD.getDate();
          baseDate = expiryD;
        }
      }
    }

    let newExpiry: Date;
    let newToDateStr: string;

    if (requestedNewToDate && typeof requestedNewToDate === 'string' && /^\d{4}-\d{2}-\d{2}/.test(requestedNewToDate.trim())) {
      newToDateStr = requestedNewToDate.trim().split('T')[0];
      const parts = newToDateStr.split('-').map((p: string) => parseInt(p, 10));
      newExpiry = new Date(parts[0], parts[1] - 1, parts[2]);
    } else {
      const numMonths = Math.max(1, Math.min(50, parseInt(String(months || 1), 10) || 1));
      const targetMonthIndex = baseMonth + numMonths;
      const targetYear = baseYear + Math.floor(targetMonthIndex / 12);
      const normalizedMonth = ((targetMonthIndex % 12) + 12) % 12;

      const maxDaysInTargetMonth = new Date(targetYear, normalizedMonth + 1, 0).getDate();
      const targetDay = Math.min(baseDay, maxDaysInTargetMonth);

      newExpiry = new Date(targetYear, normalizedMonth, targetDay);

      const yearStr = targetYear;
      const monthStr = String(normalizedMonth + 1).padStart(2, '0');
      const dayStr = String(targetDay).padStart(2, '0');
      newToDateStr = `${yearStr}-${monthStr}-${dayStr}`;
    }

    // Calculate exact full months and extra days
    const d1 = baseDate;
    const d2 = newExpiry;
    let fullMonths = 0;
    while (true) {
      const nextMonthIndex = baseMonth + fullMonths + 1;
      const targetYear = baseYear + Math.floor(nextMonthIndex / 12);
      const normalizedMonth = ((nextMonthIndex % 12) + 12) % 12;
      const maxDaysInTargetMonth = new Date(targetYear, normalizedMonth + 1, 0).getDate();
      const targetDay = Math.min(baseDay, maxDaysInTargetMonth);
      const nextTarget = new Date(targetYear, normalizedMonth, targetDay);
      if (nextTarget <= d2) {
        fullMonths++;
      } else {
        break;
      }
    }

    const cursor = fullMonths > 0 ? (() => {
      const targetMonthIndex = baseMonth + fullMonths;
      const targetYear = baseYear + Math.floor(targetMonthIndex / 12);
      const normalizedMonth = ((targetMonthIndex % 12) + 12) % 12;
      const maxDaysInTargetMonth = new Date(targetYear, normalizedMonth + 1, 0).getDate();
      const targetDay = Math.min(baseDay, maxDaysInTargetMonth);
      return new Date(targetYear, normalizedMonth, targetDay);
    })() : d1;

    const diffTime = Math.max(0, d2.getTime() - cursor.getTime());
    const extraDays = Math.max(0, Math.round(diffTime / (1000 * 60 * 60 * 24)));
    const totalMonthFactor = Math.max(0.01, fullMonths + (extraDays / 30));

    const fromTime = requestedFromTime || profile.fromTime || '06:00';
    const toTime = requestedToTime || profile.toTime || '23:00';
    const slotHours = AdminService.calculateSlotDurationHours(fromTime, toTime);

    // Check seat overlap for extended date range
    if (profile.currentSeatId) {
      const seat = await Seat.findOne({ _id: profile.currentSeatId, libraryId });
      if (seat) {
        const activeOtherRes = (seat.assignedReservations || []).filter(
          (r: any) => r.studentId?.toString() !== studentProfileId.toString() && r.endAt && new Date(r.endAt) > baseDate
        );
        for (const res of activeOtherRes) {
          const resStart = res.startAt ? new Date(res.startAt) : new Date(0);
          const resEnd = res.endAt ? new Date(res.endAt) : new Date(8640000000000000);
          if (resStart < newExpiry && resEnd > baseDate) {
            const resFrom = res.fromTime || '06:00';
            const resTo = res.toTime || '23:00';
            if (AdminService.isTimeOverlapping(fromTime, toTime, resFrom, resTo)) {
              throw new ValidationError(`Cannot extend membership: Seat ${seat.seatNumber} has an overlapping assignment for another student during the extended period.`);
            }
          }
        }
        // Extend student's reservation endAt on seat
        const myRes = (seat.assignedReservations || []).find((r: any) => r.studentId?.toString() === studentProfileId.toString());
        if (myRes) {
          myRes.endAt = newExpiry;
        }
        if (seat.currentReservation && seat.currentReservation.studentId?.toString() === studentProfileId.toString()) {
          seat.currentReservation.endAt = newExpiry;
        }
        await seat.save();
      }
    }

    // Check locker overlap for extended date range
    if (profile.currentLockerId) {
      const locker = await Locker.findOne({ _id: profile.currentLockerId, libraryId });
      if (locker) {
        const activeOtherRes = (locker.assignedReservations || []).filter(
          (r: any) => r.studentId?.toString() !== studentProfileId.toString() && r.endAt && new Date(r.endAt) > baseDate
        );
        for (const res of activeOtherRes) {
          const resStart = res.startAt ? new Date(res.startAt) : new Date(0);
          const resEnd = res.endAt ? new Date(res.endAt) : new Date(8640000000000000);
          if (resStart < newExpiry && resEnd > baseDate) {
            const resFrom = res.fromTime || '06:00';
            const resTo = res.toTime || '23:00';
            if (AdminService.isTimeOverlapping(fromTime, toTime, resFrom, resTo)) {
              throw new ValidationError(`Cannot extend membership: Locker ${locker.lockerNumber} has an overlapping assignment for another student during the extended period.`);
            }
          }
        }
        // Extend student's reservation endAt on locker
        const myRes = (locker.assignedReservations || []).find((r: any) => r.studentId?.toString() === studentProfileId.toString());
        if (myRes) {
          myRes.endAt = newExpiry;
        }
        if (locker.currentReservation && locker.currentReservation.studentId?.toString() === studentProfileId.toString()) {
          locker.currentReservation.endAt = newExpiry;
        }
        await locker.save();
      }
    }

    // Calculate extension pricing
    let seatPrice: number | undefined;
    if (profile.currentSeatId) {
      const seatObj = await Seat.findOne({ _id: profile.currentSeatId, libraryId }).lean();
      seatPrice = (seatObj as any)?.priceMonthly;
    }
    let lockerPrice: number | undefined;
    if (profile.currentLockerId) {
      const lockerObj = await Locker.findOne({ _id: profile.currentLockerId, libraryId }).lean();
      lockerPrice = (lockerObj as any)?.priceMonthly;
    }

    const paymentMaster = await AdminService.getPaymentMaster(libraryId);
    const pricing = AdminService.calculateTimeSlotFee(
      paymentMaster,
      slotHours,
      totalMonthFactor,
      !!profile.currentSeatId,
      !!profile.currentLockerId,
      seatPrice,
      lockerPrice
    );

    let payment = null;
    if (recordPayment !== false && pricing.subtotal > 0) {
      payment = await Payment.create({
        libraryId,
        studentId: profile._id,
        amount: pricing.subtotal,
        paymentMethod: PaymentMethod.CASH,
        paymentType: PaymentType.COMBINED,
        status: PaymentStatus.APPROVED,
        months: Math.max(1, Math.round(totalMonthFactor)),
        fromTime,
        toTime,
        targetSeatId: profile.currentSeatId || undefined,
        targetLockerId: profile.currentLockerId || undefined,
        idempotencyKey: `extension_${profile._id}_${Date.now()}`,
      });
    }

    profile.toDate = newExpiry;
    profile.membershipExpiresAt = newExpiry;
    profile.membershipStatus = MembershipStatus.ACTIVE;
    await profile.save();

    const updatedRaw = await StudentProfile.findById(profile._id)
      .populate('userId', 'fullName phone email isActive')
      .populate('currentSeatId', 'seatNumber floor priceMonthly currentReservation')
      .populate('currentLockerId', 'lockerNumber floor priceMonthly currentReservation')
      .lean();

    return {
      message: recordPayment !== false
        ? `Membership extended until ${newToDateStr}. Fee of ₹${pricing.subtotal} added to Today's Collection.`
        : `Membership expiry updated until ${newToDateStr} (no payment billed).`,
      student: {
        ...updatedRaw,
        profilePictureUrl: profile.profilePicture ? storageService.getFileUrl(profile.profilePicture) : null,
      },
      payment,
      newToDate: newToDateStr,
      additionalFee: pricing.subtotal,
    };
  }

  static async getEntryExitLogs(libraryId: string, page = 1, limit = 50): Promise<any> {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    const filter = {
      libraryId,
      checkInAt: { $gte: startOfToday, $lte: endOfToday },
    };

    const skip = (page - 1) * limit;

    const logs = await AttendanceSession.find(filter)
      .populate({
        path: 'studentId',
        select: 'studentIdCardNo userId',
        populate: { path: 'userId', select: 'fullName phone' },
      })
      .sort({ checkInAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await AttendanceSession.countDocuments(filter);

    return {
      logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  static async getAdminQRPayload(libraryId: string): Promise<any> {
    return QRService.generateDynamicQRPayload(libraryId);
  }

  static async updateLibraryAnnouncement(libraryId: string, status: string, announcement?: string): Promise<any> {
    const library = await Library.findById(libraryId);
    if (!library) throw new Error('Library not found');

    if (status) library.status = status as any;
    if (announcement !== undefined) library.announcement = announcement;

    await library.save();
    return library;
  }

  static calculateTieredMonthlyFee(
    dailyHours: number,
    monthFactor: number,
    master: any,
    targetSeat?: any,
    targetLocker?: any
  ) {
    const DEFAULT_LIBRARY_RATES = [400, 400, 400, 400, 800, 800, 800, 800, 1200, 1200, 1200, 1200];
    const DEFAULT_SEAT_RATES = [200, 200, 200, 200, 350, 350, 350, 350, 500, 500, 500, 500];
    const DEFAULT_LOCKER_RATES = [100, 100, 100, 100, 150, 150, 150, 150, 200, 200, 200, 200];

    const effectiveHours = Math.max(1, Math.min(12, Math.round(dailyHours || 12)));

    const libraryHourlyRates = master?.libraryHourlyRates?.length === 12 ? master.libraryHourlyRates : DEFAULT_LIBRARY_RATES;
    const seatHourlyRates = master?.seatHourlyRates?.length === 12 ? master.seatHourlyRates : DEFAULT_SEAT_RATES;
    const lockerHourlyRates = master?.lockerHourlyRates?.length === 12 ? master.lockerHourlyRates : DEFAULT_LOCKER_RATES;

    const baseRate = libraryHourlyRates[effectiveHours - 1] ?? 1200;
    const seatRate = targetSeat ? (seatHourlyRates[effectiveHours - 1] ?? 500) : 0;
    const lockerRate = targetLocker ? (lockerHourlyRates[effectiveHours - 1] ?? 200) : 0;

    const libraryCharge = Math.round(baseRate * monthFactor);
    const seatCharge = Math.round(seatRate * monthFactor);
    const lockerCharge = Math.round(lockerRate * monthFactor);

    return {
      libraryCharge,
      seatCharge,
      lockerCharge,
      subtotal: libraryCharge + seatCharge + lockerCharge,
      baseRate,
      seatRate,
      lockerRate,
    };
  }

  // --- SEAT MASTER METHODS ---
  static async getSeatsMaster(
    libraryId: string,
    filters?: { fromTime?: string; toTime?: string; search?: string; floor?: number; fromDate?: string; toDate?: string }
  ): Promise<any> {
    // 1. Library-wide scan for all non-deleted seats to get distinct floor numbers and overall metrics
    const allLibrarySeats = await Seat.find({ libraryId, isDeleted: false })
      .select('seatNumber floor status assignedReservations currentReservation')
      .lean();

    const rawFloorNumbers = Array.from(new Set(allLibrarySeats.map((s) => s.floor || 1)))
      .filter((n) => !isNaN(n))
      .sort((a, b) => a - b);
    const floorNumbers = rawFloorNumbers.length > 0 ? rawFloorNumbers : [1];

    const now = new Date();
    let reqStart = now;
    let reqEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    if (filters?.fromDate) {
      const parsedStart = new Date(filters.fromDate);
      if (!isNaN(parsedStart.getTime())) {
        parsedStart.setHours(0, 0, 0, 0);
        reqStart = parsedStart;
      }
    }

    if (filters?.toDate) {
      const parsedEnd = new Date(filters.toDate);
      if (!isNaN(parsedEnd.getTime())) {
        parsedEnd.setHours(23, 59, 59, 999);
        reqEnd = parsedEnd;
      }
    } else if (filters?.fromDate) {
      reqEnd = new Date(reqStart.getTime() + 30 * 24 * 60 * 60 * 1000);
    }

    const filterFrom = filters?.fromTime;
    const filterTo = filters?.toTime;
    const isSlotTimeFiltering = filterFrom && filterTo && filterFrom !== 'ALL' && filterTo !== 'ALL';

    const isSeatOccupiedForSlot = (seat: any) => {
      if (seat.status === 'BLOCKED' || seat.status === 'MAINTENANCE') {
        return true;
      }

      const rawAssigned = seat.assignedReservations && seat.assignedReservations.length > 0
        ? seat.assignedReservations
        : seat.currentReservation?.studentId ? [seat.currentReservation] : [];

      const activeList = rawAssigned.filter((r: any) => {
        const rStart = r.startAt ? new Date(r.startAt) : (r.reservedAt ? new Date(r.reservedAt) : new Date(0));
        const rEnd = r.endAt ? new Date(r.endAt) : new Date(8640000000000000);
        return rStart <= reqEnd && rEnd >= reqStart;
      });

      if (activeList.length === 0) {
        return false;
      }

      if (isSlotTimeFiltering) {
        return activeList.some((r: any) =>
          AdminService.isTimeOverlapping(r.fromTime || '06:00', r.toTime || '23:00', filterFrom, filterTo)
        );
      }

      return true;
    };

    let totalAvailableCount = 0;
    let totalOccupiedCount = 0;
    const floorsSummary: Record<number, { total: number; available: number; occupied: number }> = {};

    for (const fl of floorNumbers) {
      floorsSummary[fl] = { total: 0, available: 0, occupied: 0 };
    }

    for (const s of allLibrarySeats) {
      const fl = s.floor || 1;
      if (!floorsSummary[fl]) floorsSummary[fl] = { total: 0, available: 0, occupied: 0 };
      floorsSummary[fl].total += 1;

      if (isSeatOccupiedForSlot(s)) {
        totalOccupiedCount++;
        floorsSummary[fl].occupied += 1;
      } else {
        totalAvailableCount++;
        floorsSummary[fl].available += 1;
      }
    }

    // 2. Query seats for the specific floor requested (or all seats if floor is not passed)
    const query: any = { libraryId, isDeleted: false };
    if (filters?.floor) {
      query.floor = filters.floor;
    }

    let seats = await Seat.find(query)
      .populate({
        path: 'currentReservation.studentId',
        populate: { path: 'userId', select: 'fullName phone' },
      })
      .populate({
        path: 'assignedReservations.studentId',
        populate: { path: 'userId', select: 'fullName phone' },
      })
      .lean();

    seats = seats.map((seat: any) => {
      const occupied = isSeatOccupiedForSlot(seat);
      return {
        ...seat,
        status: occupied ? 'OCCUPIED' : 'AVAILABLE',
        isAvailableInSlot: !occupied,
      };
    });

    // Student Search Filter
    if (filters?.search && filters.search.trim()) {
      const sTerm = filters.search.trim().toLowerCase();
      seats = seats.filter((seat: any) => {
        const rawAssigned = seat.assignedReservations && seat.assignedReservations.length > 0
          ? seat.assignedReservations
          : seat.currentReservation?.studentId ? [seat.currentReservation] : [];
        const activeList = rawAssigned.filter((r: any) => !r.endAt || new Date(r.endAt) > now);

        return activeList.some((r: any) => {
          const uName = (r.studentId?.userId?.fullName || '').toLowerCase();
          const uPhone = (r.studentId?.userId?.phone || '').toLowerCase();
          return uName.includes(sTerm) || uPhone.includes(sTerm);
        });
      });
    }

    // Natural numerical sorting for seats
    seats = sortItemsNaturally(seats, 'seatNumber');

    // Group by floor
    const floorsMap: Record<number, any[]> = {};
    seats.forEach((seat) => {
      const fl = seat.floor || 1;
      if (!floorsMap[fl]) floorsMap[fl] = [];
      floorsMap[fl].push(seat);
    });

    return {
      seats,
      floorsMap,
      floorNumbers,
      floorsSummary,
      allSeats: allLibrarySeats.map((s) => ({ seatNumber: s.seatNumber, floor: s.floor || 1 })),
      totalCount: allLibrarySeats.length,
      availableCount: totalAvailableCount,
      occupiedCount: totalOccupiedCount,
    };
  }

  static parseItemPrefixAndNum(numStr: string): { prefix: string; num: number } {
    const str = (numStr || '').trim();
    if (!str) return { prefix: '', num: 0 };

    const match = str.match(/^([A-Za-z\s_-]+)?(\d+)$/);
    if (match) {
      const rawP = match[1] || '';
      const normP = rawP.trim().toUpperCase().replace(/[-_]+$/, '');
      const num = parseInt(match[2], 10);
      return { prefix: normP, num };
    }

    const digitMatch = str.match(/\d+$/);
    if (digitMatch) {
      const num = parseInt(digitMatch[0], 10);
      const rawP = str.substring(0, str.length - digitMatch[0].length);
      const normP = rawP.trim().toUpperCase().replace(/[-_]+$/, '');
      return { prefix: normP, num };
    }

    return { prefix: str.toUpperCase(), num: 0 };
  }

  static formatItemNumber(rawPrefix: string, candidate: number, existingItems: any[], numKey: string): string {
    const cleanPrefix = (rawPrefix || '').trim();
    if (!cleanPrefix) {
      return `${candidate}`;
    }

    const pNorm = cleanPrefix.toUpperCase().replace(/[-_]+$/, '');

    let usesHyphen = cleanPrefix.endsWith('-') || cleanPrefix.endsWith('_');
    let usesZeroPadding = false;

    for (const item of existingItems) {
      const val = (item[numKey] || '').trim();
      if (val.toUpperCase().startsWith(pNorm)) {
        if (val.includes('-') || val.includes('_')) usesHyphen = true;
        const parsed = AdminService.parseItemPrefixAndNum(val);
        if (parsed.prefix === pNorm) {
          const matchDigits = val.match(/\d+$/);
          if (matchDigits && matchDigits[0].length >= 2 && matchDigits[0].startsWith('0')) {
            usesZeroPadding = true;
          }
        }
      }
    }

    const numPart = (usesZeroPadding && candidate < 10) ? `0${candidate}` : `${candidate}`;
    const prefixPart = usesHyphen && !cleanPrefix.endsWith('-') && !cleanPrefix.endsWith('_') ? `${cleanPrefix}-` : cleanPrefix;

    return `${prefixPart}${numPart}`;
  }

  static async manageSeatMaster(libraryId: string, payload: any): Promise<any> {
    const { action, seatId, seatNumber, floor, bulkPrefix, bulkCount, bulkStartNumber, startNumber } = payload;
    const { ValidationError } = require('../utils/customErrors');

    if (action === 'BULK_CREATE') {
      const rawPrefix = bulkPrefix !== undefined && bulkPrefix !== null ? String(bulkPrefix).trim() : '';

      const parsedFloor = parseInt(floor, 10);
      const parsedCount = parseInt(bulkCount, 10);

      if (isNaN(parsedFloor) || parsedFloor < 1) {
        throw new ValidationError('Floor number must be a valid positive integer.');
      }
      if (parsedFloor > 10) {
        throw new ValidationError('Floor number cannot exceed 10 (maximum 10 floors per library).');
      }
      if (isNaN(parsedCount) || parsedCount < 1) {
        throw new ValidationError('Seat count must be a valid positive integer greater than 0.');
      }
      if (parsedCount > 100) {
        throw new ValidationError('Cannot generate more than 100 seats per floor in a single bulk request.');
      }

      const count = parsedCount;
      const targetFloor = parsedFloor;
      const explicitStartNum = (bulkStartNumber !== undefined && bulkStartNumber !== null && String(bulkStartNumber).trim() !== '') || (startNumber !== undefined && startNumber !== null && String(startNumber).trim() !== '')
        ? parseInt(String(bulkStartNumber || startNumber).trim(), 10)
        : undefined;

      if (explicitStartNum !== undefined) {
        if (isNaN(explicitStartNum) || explicitStartNum < 1) {
          throw new ValidationError('Starting number must be a valid positive integer greater than 0.');
        }
        if (explicitStartNum > count) {
          throw new ValidationError(`Starting number (${explicitStartNum}) cannot exceed the number of seats being generated (${count}).`);
        }
      }

      // Fetch all non-deleted seats in this library and filter strictly for targetFloor
      const allSeats = await Seat.find({ libraryId, isDeleted: false }).select('seatNumber floor').lean();
      const floorSeats = allSeats.filter((s) => Math.max(1, Number(s.floor) || 1) === targetFloor);
      const existingSet = new Set(floorSeats.map((s) => s.seatNumber.toUpperCase().trim()));

      const targetPrefixNorm = rawPrefix ? rawPrefix.toUpperCase().replace(/[-_]+$/, '') : '';

      let candidate = 1;
      if (explicitStartNum && !isNaN(explicitStartNum) && explicitStartNum > 0) {
        candidate = explicitStartNum;
      } else {
        let maxFloorNum = 0;
        for (const s of floorSeats) {
          const parsed = AdminService.parseItemPrefixAndNum(s.seatNumber);
          if (parsed.prefix === targetPrefixNorm) {
            if (parsed.num > maxFloorNum) {
              maxFloorNum = parsed.num;
            }
          }
        }
        candidate = maxFloorNum > 0 ? maxFloorNum + 1 : 1;
      }

      const created: any[] = [];
      while (created.length < count) {
        const sNum = AdminService.formatItemNumber(rawPrefix, candidate, floorSeats, 'seatNumber');

        if (!existingSet.has(sNum.toUpperCase())) {
          try {
            const s = await Seat.create({
              libraryId,
              seatNumber: sNum,
              floor: targetFloor,
              status: SeatStatus.AVAILABLE,
            });
            created.push(s);
            existingSet.add(sNum.toUpperCase());
            floorSeats.push({ seatNumber: sNum, floor: targetFloor } as any);
          } catch (e) {
            // duplicate key safety fallback
          }
        }
        candidate++;
      }
      return { message: `Created ${created.length} seats on floor ${targetFloor}`, seats: created };
    }

    if (action === 'BULK_DELETE' && Array.isArray(payload.seatIds) && payload.seatIds.length > 0) {
      const targetSeats = await Seat.find({
        _id: { $in: payload.seatIds },
        libraryId,
        isDeleted: false,
      }).lean();

      // Check if any seat has an active non-expired reservation
      const now = new Date();
      const occupiedSeats = targetSeats.filter((s: any) => {
        if (s.status === SeatStatus.OCCUPIED) return true;
        const activeList = (s.assignedReservations || []).filter((r: any) => !r.endAt || new Date(r.endAt) > now);
        return activeList.length > 0;
      });

      if (occupiedSeats.length > 0) {
        const occupiedNumbers = occupiedSeats.map((s: any) => s.seatNumber).join(', ');
        throw new ValidationError(`Cannot delete seat(s) [${occupiedNumbers}] because they are currently assigned to active students.`);
      }

      await StudentProfile.updateMany(
        { currentSeatId: { $in: payload.seatIds } },
        { $unset: { currentSeatId: 1 } }
      );
      await Seat.deleteMany({ _id: { $in: payload.seatIds }, libraryId });
      return { message: `Deleted ${targetSeats.length} seat(s) successfully` };
    }

    if (action === 'UPDATE' && seatId) {
      const updateObj: any = {};
      if (floor !== undefined) updateObj.floor = Math.max(1, parseInt(floor, 10) || 1);
      if (seatNumber) updateObj.seatNumber = seatNumber.trim();

      if (updateObj.seatNumber || updateObj.floor !== undefined) {
        const checkSeat = await Seat.findOne({ _id: seatId, libraryId });
        const checkNumber = (updateObj.seatNumber || checkSeat?.seatNumber || '').trim();
        const checkFloor = Math.max(1, Number(updateObj.floor !== undefined ? updateObj.floor : checkSeat?.floor) || 1);

        const allExistingSeats = await Seat.find({ libraryId, _id: { $ne: seatId }, isDeleted: false }).select('seatNumber floor').lean();
        const existing = allExistingSeats.find(
          (s) => Math.max(1, Number(s.floor) || 1) === checkFloor && s.seatNumber.toUpperCase().trim() === checkNumber.toUpperCase()
        );
        if (existing) {
          throw new ValidationError(`Seat number ${checkNumber} already exists on floor ${checkFloor}.`);
        }
      }

      const updated = await Seat.findOneAndUpdate({ _id: seatId, libraryId }, updateObj, { new: true });
      return updated;
    }

    if (action === 'CREATE_SINGLE') {
      const sNum = (seatNumber || '').trim();
      if (!sNum) throw new ValidationError('Seat number is required.');
      const targetFloor = Math.max(1, parseInt(floor, 10) || 1);

      const allExistingSeats = await Seat.find({ libraryId, isDeleted: false }).select('seatNumber floor').lean();
      const existing = allExistingSeats.find(
        (s) => Math.max(1, Number(s.floor) || 1) === targetFloor && s.seatNumber.toUpperCase().trim() === sNum.toUpperCase()
      );
      if (existing) {
        throw new ValidationError(`Seat ${sNum} already exists on floor ${targetFloor}.`);
      }

      const newSeat = await Seat.create({
        libraryId,
        seatNumber: sNum,
        floor: targetFloor,
        status: SeatStatus.AVAILABLE,
      });
      return newSeat;
    }

    if (action === 'DELETE' && seatId) {
      await StudentProfile.updateMany({ currentSeatId: seatId }, { $unset: { currentSeatId: 1 } });
      await Seat.deleteOne({ _id: seatId, libraryId });
      return { message: 'Seat deleted successfully' };
    }

    if (action === 'ASSIGN_STUDENT' && seatId && payload.studentProfileId) {
      const seat = await Seat.findOne({ _id: seatId, libraryId, isDeleted: false });
      if (!seat) throw new ValidationError('Seat not found');

      const studentProfile = await StudentProfile.findOne({
        _id: payload.studentProfileId,
        libraryId,
      }).populate('userId');

      if (!studentProfile) {
        throw new ValidationError('Student not found in this library');
      }

      if (seat.status === SeatStatus.BLOCKED) {
        throw new ValidationError(`Seat ${seat.seatNumber} is currently blocked.`);
      }

      const reqFromTime = payload.fromTime || '06:00';
      const reqToTime = payload.toTime || '23:00';
      const f1 = AdminService.parseTimeToNumber(reqFromTime);
      const t1 = AdminService.parseTimeToNumber(reqToTime);
      if (t1 <= f1) {
        throw new ValidationError('To Time must be at least 1 hour after From Time.');
      }

      const now = new Date();
      if (!seat.assignedReservations) seat.assignedReservations = [];

      // Check overlap against active non-expired reservations for OTHER students on this seat
      const activeRes = seat.assignedReservations.filter(
        (r) => r.endAt && new Date(r.endAt) > now && r.studentId?.toString() !== studentProfile._id.toString()
      );

      for (const res of activeRes) {
        const resFrom = res.fromTime || '06:00';
        const resTo = res.toTime || '23:00';
        if (AdminService.isTimeOverlapping(reqFromTime, reqToTime, resFrom, resTo)) {
          const studentName = (res.studentId as any)?.userId?.fullName || 'another student';
          throw new ValidationError(
            `Time slot overlap collision: Seat ${seat.seatNumber} is already assigned to ${studentName} for time slot ${resFrom} to ${resTo}. Time slots cannot overlap.`
          );
        }
      }

      const months = payload.durationMonths ? Math.max(1, parseInt(payload.durationMonths, 10)) : 1;
      const endAt = new Date(now);
      endAt.setMonth(endAt.getMonth() + months);

      const newReservation: ISeatReservation = {
        studentId: studentProfile._id,
        startAt: now,
        endAt,
        fromTime: reqFromTime,
        toTime: reqToTime,
        reservedAt: now,
      };

      // Remove any previous reservation for the same student on this seat before adding updated reservation
      seat.assignedReservations = seat.assignedReservations.filter(
        (r) => r.studentId?.toString() !== studentProfile._id.toString()
      );

      seat.assignedReservations.push(newReservation);
      seat.currentReservation = newReservation;
      seat.status = SeatStatus.OCCUPIED;
      await seat.save();

      studentProfile.currentSeatId = seat._id as any;
      await studentProfile.save();

      return {
        message: `Seat ${seat.seatNumber} assigned to ${(studentProfile.userId as any)?.fullName || 'student'} for ${reqFromTime} → ${reqToTime} successfully`,
        seat,
      };
    }

    if (action === 'UNASSIGN_STUDENT' && seatId) {
      const seat = await Seat.findOne({ _id: seatId, libraryId });
      if (seat) {
        const targetStudentId = payload.studentProfileId || payload.reservationId;
        if (targetStudentId && seat.assignedReservations && seat.assignedReservations.length > 0) {
          seat.assignedReservations = seat.assignedReservations.filter(
            (r) => r.studentId?.toString() !== targetStudentId.toString() && (r as any)._id?.toString() !== targetStudentId.toString()
          );
          await StudentProfile.findByIdAndUpdate(targetStudentId, { $unset: { currentSeatId: 1 } });
        } else {
          if (seat.currentReservation?.studentId) {
            await StudentProfile.findByIdAndUpdate(seat.currentReservation.studentId, { $unset: { currentSeatId: 1 } });
          }
          if (seat.assignedReservations) {
            for (const r of seat.assignedReservations) {
              if (r.studentId) {
                await StudentProfile.findByIdAndUpdate(r.studentId, { $unset: { currentSeatId: 1 } });
              }
            }
          }
          seat.assignedReservations = [];
        }

        const now = new Date();
        const activeRemaining = (seat.assignedReservations || []).filter((r) => r.endAt && new Date(r.endAt) > now);
        if (activeRemaining.length > 0) {
          seat.status = SeatStatus.OCCUPIED;
          seat.currentReservation = activeRemaining[0];
        } else {
          seat.status = SeatStatus.AVAILABLE;
          seat.currentReservation = undefined;
        }

        await seat.save();
      }
      return { message: 'Seat reservation released successfully' };
    }

    throw new ValidationError('Invalid Seat Master action');
  }

  // --- LOCKER MASTER METHODS ---
  static async getLockersMaster(
    libraryId: string,
    filters?: { fromTime?: string; toTime?: string; search?: string; floor?: number; fromDate?: string; toDate?: string }
  ): Promise<any> {
    // 1. Library-wide scan for all non-deleted lockers to get distinct floor numbers and overall metrics
    const allLibraryLockers = await Locker.find({ libraryId, isDeleted: false })
      .select('lockerNumber floor status assignedReservations currentReservation')
      .lean();

    const rawFloorNumbers = Array.from(new Set(allLibraryLockers.map((l) => l.floor || 1)))
      .filter((n) => !isNaN(n))
      .sort((a, b) => a - b);
    const floorNumbers = rawFloorNumbers.length > 0 ? rawFloorNumbers : [1];

    const now = new Date();
    let reqStart = now;
    let reqEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    if (filters?.fromDate) {
      const parsedStart = new Date(filters.fromDate);
      if (!isNaN(parsedStart.getTime())) {
        parsedStart.setHours(0, 0, 0, 0);
        reqStart = parsedStart;
      }
    }

    if (filters?.toDate) {
      const parsedEnd = new Date(filters.toDate);
      if (!isNaN(parsedEnd.getTime())) {
        parsedEnd.setHours(23, 59, 59, 999);
        reqEnd = parsedEnd;
      }
    } else if (filters?.fromDate) {
      reqEnd = new Date(reqStart.getTime() + 30 * 24 * 60 * 60 * 1000);
    }

    const filterFrom = filters?.fromTime;
    const filterTo = filters?.toTime;
    const isSlotTimeFiltering = filterFrom && filterTo && filterFrom !== 'ALL' && filterTo !== 'ALL';

    const isLockerOccupiedForSlot = (locker: any) => {
      if (locker.status === 'BLOCKED' || locker.status === 'MAINTENANCE') {
        return true;
      }

      const rawAssigned = locker.assignedReservations && locker.assignedReservations.length > 0
        ? locker.assignedReservations
        : locker.currentReservation?.studentId ? [locker.currentReservation] : [];

      const activeList = rawAssigned.filter((r: any) => {
        const rStart = r.startAt ? new Date(r.startAt) : (r.reservedAt ? new Date(r.reservedAt) : new Date(0));
        const rEnd = r.endAt ? new Date(r.endAt) : new Date(8640000000000000);
        return rStart <= reqEnd && rEnd >= reqStart;
      });

      if (activeList.length === 0) {
        return false;
      }

      if (isSlotTimeFiltering) {
        return activeList.some((r: any) =>
          AdminService.isTimeOverlapping(r.fromTime || '06:00', r.toTime || '23:00', filterFrom, filterTo)
        );
      }

      return true;
    };

    let totalAvailableCount = 0;
    let totalOccupiedCount = 0;
    const floorsSummary: Record<number, { total: number; available: number; occupied: number }> = {};

    for (const fl of floorNumbers) {
      floorsSummary[fl] = { total: 0, available: 0, occupied: 0 };
    }

    for (const l of allLibraryLockers) {
      const fl = l.floor || 1;
      if (!floorsSummary[fl]) floorsSummary[fl] = { total: 0, available: 0, occupied: 0 };
      floorsSummary[fl].total += 1;

      if (isLockerOccupiedForSlot(l)) {
        totalOccupiedCount++;
        floorsSummary[fl].occupied += 1;
      } else {
        totalAvailableCount++;
        floorsSummary[fl].available += 1;
      }
    }

    // 2. Query lockers for the specific floor requested (or all lockers if floor is not passed)
    const query: any = { libraryId, isDeleted: false };
    if (filters?.floor) {
      query.floor = filters.floor;
    }

    let lockers = await Locker.find(query)
      .populate({
        path: 'currentReservation.studentId',
        populate: { path: 'userId', select: 'fullName phone' },
      })
      .populate({
        path: 'assignedReservations.studentId',
        populate: { path: 'userId', select: 'fullName phone' },
      })
      .lean();

    lockers = lockers.map((locker: any) => {
      const occupied = isLockerOccupiedForSlot(locker);
      return {
        ...locker,
        status: occupied ? 'OCCUPIED' : 'AVAILABLE',
        isAvailableInSlot: !occupied,
      };
    });

    // Student Search Filter
    if (filters?.search && filters.search.trim()) {
      const sTerm = filters.search.trim().toLowerCase();
      lockers = lockers.filter((locker: any) => {
        const rawAssigned = locker.assignedReservations && locker.assignedReservations.length > 0
          ? locker.assignedReservations
          : locker.currentReservation?.studentId ? [locker.currentReservation] : [];
        const activeList = rawAssigned.filter((r: any) => !r.endAt || new Date(r.endAt) > now);

        return activeList.some((r: any) => {
          const uName = (r.studentId?.userId?.fullName || '').toLowerCase();
          const uPhone = (r.studentId?.userId?.phone || '').toLowerCase();
          return uName.includes(sTerm) || uPhone.includes(sTerm);
        });
      });
    }

    // Natural numerical sorting for lockers
    lockers = sortItemsNaturally(lockers, 'lockerNumber');

    // Group by floor
    const floorsMap: Record<number, any[]> = {};
    lockers.forEach((locker) => {
      const fl = locker.floor || 1;
      if (!floorsMap[fl]) floorsMap[fl] = [];
      floorsMap[fl].push(locker);
    });

    return {
      lockers,
      floorsMap,
      floorNumbers,
      floorsSummary,
      allLockers: allLibraryLockers.map((l) => ({ lockerNumber: l.lockerNumber, floor: l.floor || 1 })),
      totalCount: allLibraryLockers.length,
      availableCount: totalAvailableCount,
      occupiedCount: totalOccupiedCount,
    };
  }

  static async manageLockerMaster(libraryId: string, payload: any): Promise<any> {
    const { action, lockerId, lockerNumber, floor, bulkPrefix, bulkCount, bulkStartNumber, startNumber } = payload;
    const { ValidationError } = require('../utils/customErrors');

    if (action === 'BULK_CREATE') {
      const rawPrefix = bulkPrefix !== undefined && bulkPrefix !== null ? String(bulkPrefix).trim() : '';

      const parsedFloor = parseInt(floor, 10);
      const parsedCount = parseInt(bulkCount, 10);

      if (isNaN(parsedFloor) || parsedFloor < 1) {
        throw new ValidationError('Floor number must be a valid positive integer.');
      }
      if (parsedFloor > 10) {
        throw new ValidationError('Floor number cannot exceed 10 (maximum 10 floors per library).');
      }
      if (isNaN(parsedCount) || parsedCount < 1) {
        throw new ValidationError('Locker count must be a valid positive integer greater than 0.');
      }
      if (parsedCount > 100) {
        throw new ValidationError('Cannot generate more than 100 lockers per floor in a single bulk request.');
      }

      const count = parsedCount;
      const targetFloor = parsedFloor;
      const explicitStartNum = (bulkStartNumber !== undefined && bulkStartNumber !== null && String(bulkStartNumber).trim() !== '') || (startNumber !== undefined && startNumber !== null && String(startNumber).trim() !== '')
        ? parseInt(String(bulkStartNumber || startNumber).trim(), 10)
        : undefined;

      if (explicitStartNum !== undefined) {
        if (isNaN(explicitStartNum) || explicitStartNum < 1) {
          throw new ValidationError('Starting number must be a valid positive integer greater than 0.');
        }
        if (explicitStartNum > count) {
          throw new ValidationError(`Starting number (${explicitStartNum}) cannot exceed the number of lockers being generated (${count}).`);
        }
      }

      // Fetch all non-deleted lockers in this library and filter strictly for targetFloor
      const allLockers = await Locker.find({ libraryId, isDeleted: false }).select('lockerNumber floor').lean();
      const floorLockers = allLockers.filter((l) => Math.max(1, Number(l.floor) || 1) === targetFloor);
      const existingSet = new Set(floorLockers.map((l) => l.lockerNumber.toUpperCase().trim()));
      const targetPrefixNorm = rawPrefix ? rawPrefix.toUpperCase().replace(/[-_]+$/, '') : '';

      let candidate = 1;
      if (explicitStartNum && !isNaN(explicitStartNum) && explicitStartNum > 0) {
        candidate = explicitStartNum;
      } else {
        let maxFloorNum = 0;
        for (const l of floorLockers) {
          const parsed = AdminService.parseItemPrefixAndNum(l.lockerNumber);
          if (parsed.prefix === targetPrefixNorm) {
            if (parsed.num > maxFloorNum) {
              maxFloorNum = parsed.num;
            }
          }
        }
        candidate = maxFloorNum > 0 ? maxFloorNum + 1 : 1;
      }

      const created: any[] = [];
      while (created.length < count) {
        const lNum = AdminService.formatItemNumber(rawPrefix, candidate, floorLockers, 'lockerNumber');

        if (!existingSet.has(lNum.toUpperCase())) {
          try {
            const l = await Locker.create({
              libraryId,
              lockerNumber: lNum,
              floor: targetFloor,
              status: LockerStatus.AVAILABLE,
            });
            created.push(l);
            existingSet.add(lNum.toUpperCase());
            floorLockers.push({ lockerNumber: lNum, floor: targetFloor } as any);
          } catch (e) {
            // duplicate key safety fallback
          }
        }
        candidate++;
      }
      return { message: `Created ${created.length} lockers on floor ${targetFloor}`, lockers: created };
    }

    if (action === 'BULK_DELETE' && Array.isArray(payload.lockerIds) && payload.lockerIds.length > 0) {
      const targetLockers = await Locker.find({
        _id: { $in: payload.lockerIds },
        libraryId,
        isDeleted: false,
      }).lean();

      // Check if any locker has an active non-expired reservation
      const now = new Date();
      const occupiedLockers = targetLockers.filter((l: any) => {
        if (l.status === LockerStatus.OCCUPIED) return true;
        const activeList = (l.assignedReservations || []).filter((r: any) => !r.endAt || new Date(r.endAt) > now);
        return activeList.length > 0;
      });

      if (occupiedLockers.length > 0) {
        const occupiedNumbers = occupiedLockers.map((l: any) => l.lockerNumber).join(', ');
        throw new ValidationError(`Cannot delete locker(s) [${occupiedNumbers}] because they are currently assigned to active students.`);
      }

      await StudentProfile.updateMany(
        { currentLockerId: { $in: payload.lockerIds } },
        { $unset: { currentLockerId: 1 } }
      );
      await Locker.deleteMany({ _id: { $in: payload.lockerIds }, libraryId });
      return { message: `Deleted ${targetLockers.length} locker(s) successfully` };
    }

    if (action === 'UPDATE' && lockerId) {
      const updateObj: any = {};
      if (floor !== undefined) updateObj.floor = Math.max(1, parseInt(floor, 10) || 1);
      if (lockerNumber) updateObj.lockerNumber = lockerNumber.trim();

      if (updateObj.lockerNumber || updateObj.floor !== undefined) {
        const checkLocker = await Locker.findOne({ _id: lockerId, libraryId });
        const checkNumber = (updateObj.lockerNumber || checkLocker?.lockerNumber || '').trim();
        const checkFloor = Math.max(1, Number(updateObj.floor !== undefined ? updateObj.floor : checkLocker?.floor) || 1);

        const allExistingLockers = await Locker.find({ libraryId, _id: { $ne: lockerId }, isDeleted: false }).select('lockerNumber floor').lean();
        const existing = allExistingLockers.find(
          (l) => Math.max(1, Number(l.floor) || 1) === checkFloor && l.lockerNumber.toUpperCase().trim() === checkNumber.toUpperCase()
        );
        if (existing) {
          throw new ValidationError(`Locker number ${checkNumber} already exists on floor ${checkFloor}.`);
        }
      }

      const updated = await Locker.findOneAndUpdate({ _id: lockerId, libraryId }, updateObj, { new: true });
      return updated;
    }

    if (action === 'CREATE_SINGLE') {
      const lNum = (lockerNumber || '').trim();
      if (!lNum) throw new ValidationError('Locker number is required.');
      const targetFloor = Math.max(1, parseInt(floor, 10) || 1);

      const allExistingLockers = await Locker.find({ libraryId, isDeleted: false }).select('lockerNumber floor').lean();
      const existing = allExistingLockers.find(
        (l) => Math.max(1, Number(l.floor) || 1) === targetFloor && l.lockerNumber.toUpperCase().trim() === lNum.toUpperCase()
      );
      if (existing) {
        throw new ValidationError(`Locker ${lNum} already exists on floor ${targetFloor}.`);
      }

      const newLocker = await Locker.create({
        libraryId,
        lockerNumber: lNum,
        floor: targetFloor,
        status: LockerStatus.AVAILABLE,
      });
      return newLocker;
    }

    if (action === 'DELETE' && lockerId) {
      await StudentProfile.updateMany({ currentLockerId: lockerId }, { $unset: { currentLockerId: 1 } });
      await Locker.deleteOne({ _id: lockerId, libraryId });
      return { message: 'Locker deleted successfully' };
    }

    if (action === 'ASSIGN_STUDENT' && lockerId && payload.studentProfileId) {
      const locker = await Locker.findOne({ _id: lockerId, libraryId, isDeleted: false });
      if (!locker) throw new ValidationError('Locker not found.');

      const studentProfile = await StudentProfile.findOne({
        _id: payload.studentProfileId,
        libraryId,
      }).populate('userId');

      if (!studentProfile) throw new ValidationError('Student not found in this library.');

      if (locker.status === LockerStatus.BLOCKED) {
        throw new ValidationError(`Locker ${locker.lockerNumber} is currently blocked.`);
      }

      const reqFromTime = payload.fromTime || '06:00';
      const reqToTime = payload.toTime || '23:00';
      const f1 = AdminService.parseTimeToNumber(reqFromTime);
      const t1 = AdminService.parseTimeToNumber(reqToTime);
      if (t1 <= f1) {
        throw new ValidationError('To Time must be at least 1 hour after From Time.');
      }

      const now = new Date();
      if (!locker.assignedReservations) locker.assignedReservations = [];

      // Check overlap against active non-expired reservations for OTHER students on this locker
      const activeRes = locker.assignedReservations.filter(
        (r) => r.endAt && new Date(r.endAt) > now && r.studentId?.toString() !== studentProfile._id.toString()
      );

      for (const res of activeRes) {
        const resFrom = res.fromTime || '06:00';
        const resTo = res.toTime || '23:00';
        if (AdminService.isTimeOverlapping(reqFromTime, reqToTime, resFrom, resTo)) {
          const studentName = (res.studentId as any)?.userId?.fullName || 'another student';
          throw new ValidationError(
            `Time slot overlap collision: Locker ${locker.lockerNumber} is already assigned to ${studentName} for time slot ${resFrom} to ${resTo}. Time slots cannot overlap.`
          );
        }
      }

      const months = payload.durationMonths ? Math.max(1, parseInt(payload.durationMonths, 10)) : 1;
      const endAt = new Date(now);
      endAt.setMonth(endAt.getMonth() + months);

      const newReservation: ILockerReservation = {
        studentId: studentProfile._id,
        startAt: now,
        endAt,
        fromTime: reqFromTime,
        toTime: reqToTime,
        reservedAt: now,
      };

      // Remove any previous reservation for the same student on this locker before adding updated reservation
      locker.assignedReservations = locker.assignedReservations.filter(
        (r) => r.studentId?.toString() !== studentProfile._id.toString()
      );

      locker.assignedReservations.push(newReservation);
      locker.currentReservation = newReservation;
      locker.status = LockerStatus.OCCUPIED;
      await locker.save();

      studentProfile.currentLockerId = locker._id as any;
      await studentProfile.save();

      return {
        message: `Locker ${locker.lockerNumber} assigned to ${(studentProfile.userId as any)?.fullName || 'student'} for ${reqFromTime} → ${reqToTime} successfully`,
        locker,
      };
    }

    if (action === 'UNASSIGN_STUDENT' && lockerId) {
      const locker = await Locker.findOne({ _id: lockerId, libraryId });
      if (locker) {
        const targetStudentId = payload.studentProfileId || payload.reservationId;
        if (targetStudentId && locker.assignedReservations && locker.assignedReservations.length > 0) {
          locker.assignedReservations = locker.assignedReservations.filter(
            (r) => r.studentId?.toString() !== targetStudentId.toString() && (r as any)._id?.toString() !== targetStudentId.toString()
          );
          await StudentProfile.findByIdAndUpdate(targetStudentId, { $unset: { currentLockerId: 1 } });
        } else {
          if (locker.currentReservation?.studentId) {
            await StudentProfile.findByIdAndUpdate(locker.currentReservation.studentId, { $unset: { currentLockerId: 1 } });
          }
          if (locker.assignedReservations) {
            for (const r of locker.assignedReservations) {
              if (r.studentId) {
                await StudentProfile.findByIdAndUpdate(r.studentId, { $unset: { currentLockerId: 1 } });
              }
            }
          }
          locker.assignedReservations = [];
        }

        const now = new Date();
        const activeRemaining = (locker.assignedReservations || []).filter((r) => r.endAt && new Date(r.endAt) > now);
        if (activeRemaining.length > 0) {
          locker.status = LockerStatus.OCCUPIED;
          locker.currentReservation = activeRemaining[0];
        } else {
          locker.status = LockerStatus.AVAILABLE;
          locker.currentReservation = undefined;
        }

        await locker.save();
      }
      return { message: 'Locker released successfully' };
    }

    throw new ValidationError('Invalid Locker Master action');
  }

  static async updatePaymentPlan(libraryId: string, payload: any): Promise<any> {
    return await AdminService.updatePaymentMaster(libraryId, payload);
  }

  static async getAuditLogs(libraryId: string, page = 1, limit = 20): Promise<any> {
    const skip = (page - 1) * limit;

    const logs = await AuditLog.find({ libraryId })
      .populate('actorUserId', 'fullName phone role')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await AuditLog.countDocuments({ libraryId });

    return {
      logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // --- ENROLLMENT OPTIONS & TIME SLOT CAPACITY ---
  static parseTimeToNumber(tStr?: string): number {
    if (!tStr) return 0;
    const str = tStr.trim().toUpperCase();
    const isPM = str.includes('PM');
    const isAM = str.includes('AM');
    const clean = str.replace(/(AM|PM)/g, '').trim();
    const parts = clean.split(':').map(Number);
    let h = parts[0] || 0;
    if (isPM && h < 12) h += 12;
    if (isAM && h === 12) h = 0;
    return h;
  }

  static isTimeOverlapping(from1?: string, to1?: string, from2?: string, to2?: string): boolean {
    if (!from1 || !to1 || !from2 || !to2) return true; // Default full day overlap if missing
    const f1 = AdminService.parseTimeToNumber(from1);
    const t1 = AdminService.parseTimeToNumber(to1);
    const f2 = AdminService.parseTimeToNumber(from2);
    const t2 = AdminService.parseTimeToNumber(to2);

    const effT1 = t1 > f1 ? t1 : 24;
    const effT2 = t2 > f2 ? t2 : 24;

    return f1 < effT2 && effT1 > f2;
  }

  static calculateTimeSlotFee(
    paymentMaster: any,
    hours: number,
    months: number,
    hasSeat: boolean = false,
    hasLocker: boolean = false,
    customSeatPrice?: number,
    customLockerPrice?: number
  ) {
    const DEFAULT_LIBRARY_RATES = [400, 400, 400, 400, 800, 800, 800, 800, 1200, 1200, 1200, 1200];
    const DEFAULT_SEAT_RATES = [200, 200, 200, 200, 350, 350, 350, 350, 500, 500, 500, 500];
    const DEFAULT_LOCKER_RATES = [100, 100, 100, 100, 150, 150, 150, 150, 200, 200, 200, 200];

    const effHours = Math.max(1, Math.min(12, hours));
    const idx = effHours - 1;

    const libRates = Array.isArray(paymentMaster?.libraryHourlyRates) && paymentMaster.libraryHourlyRates.length === 12
      ? paymentMaster.libraryHourlyRates
      : DEFAULT_LIBRARY_RATES;
    const libMonthlyRate = libRates[idx] ?? (paymentMaster?.monthlyFee || 1200);

    let seatMonthlyRate = 0;
    if (hasSeat && paymentMaster?.featureFlags?.enableReservedSeats !== false) {
      const seatRates = Array.isArray(paymentMaster?.seatHourlyRates) && paymentMaster.seatHourlyRates.length === 12
        ? paymentMaster.seatHourlyRates
        : DEFAULT_SEAT_RATES;
      seatMonthlyRate = (customSeatPrice !== undefined && customSeatPrice !== null)
        ? customSeatPrice
        : (seatRates[idx] ?? (paymentMaster?.seatMonthlyFee || 500));
    }

    let lockerMonthlyRate = 0;
    if (hasLocker && paymentMaster?.featureFlags?.enableLockers !== false) {
      const lockerRates = Array.isArray(paymentMaster?.lockerHourlyRates) && paymentMaster.lockerHourlyRates.length === 12
        ? paymentMaster.lockerHourlyRates
        : DEFAULT_LOCKER_RATES;
      lockerMonthlyRate = (customLockerPrice !== undefined && customLockerPrice !== null)
        ? customLockerPrice
        : (lockerRates[idx] ?? (paymentMaster?.lockerMonthlyFee || 200));
    }

    const libraryCharge = Math.round(libMonthlyRate * months);
    const seatCharge = Math.round(seatMonthlyRate * months);
    const lockerCharge = Math.round(lockerMonthlyRate * months);
    const subtotal = libraryCharge + seatCharge + lockerCharge;

    return {
      libraryCharge,
      seatCharge,
      lockerCharge,
      subtotal,
    };
  }

  static async checkTimeSlotCapacity(
    libraryId: string,
    fromDateStr?: string | Date,
    toDateStr?: string | Date,
    fromTime?: string,
    toTime?: string
  ): Promise<{
    totalSeats: number;
    occupiedSeatsCount: number;
    availableSeatsCount: number;
    totalLockers: number;
    occupiedLockersCount: number;
    availableLockersCount: number;
    occupiedSeatIds: string[];
    occupiedLockerIds: string[];
  }> {
    const reqStart = fromDateStr ? new Date(fromDateStr) : new Date();
    const reqEnd = toDateStr ? new Date(toDateStr) : new Date(reqStart.getTime() + 30 * 24 * 60 * 60 * 1000);
    const reqFromTime = fromTime || '06:00';
    const reqToTime = toTime || '23:00';

    const totalSeats = await Seat.countDocuments({ libraryId, isDeleted: false });
    const totalLockers = await Locker.countDocuments({ libraryId, isDeleted: false });

    // 1. Find all seats with currentReservation overlapping subscription date AND daily time slot
    const occupiedSeatIds = new Set<string>();
    const seatsWithRes = await Seat.find({
      libraryId,
      isDeleted: false,
      status: { $in: [SeatStatus.RESERVED, SeatStatus.OCCUPIED] },
      'currentReservation.startAt': { $lt: reqEnd },
      'currentReservation.endAt': { $gt: reqStart },
    }).lean();

    for (const s of seatsWithRes) {
      const res = s.currentReservation;
      if (!res) continue;
      const resFrom = res.fromTime || '06:00';
      const resTo = res.toTime || '23:00';
      if (AdminService.isTimeOverlapping(reqFromTime, reqToTime, resFrom, resTo)) {
        occupiedSeatIds.add(s._id.toString());
      }
    }

    // Also check pending payments for targetSeatId
    const pendingSeatPayments = await Payment.find({
      libraryId,
      status: PaymentStatus.PENDING,
      targetSeatId: { $exists: true, $ne: null },
    }).lean();

    for (const p of pendingSeatPayments) {
      if (!p.targetSeatId) continue;
      const pFrom = p.fromTime || '06:00';
      const pTo = p.toTime || '23:00';
      if (AdminService.isTimeOverlapping(reqFromTime, reqToTime, pFrom, pTo)) {
        occupiedSeatIds.add(p.targetSeatId.toString());
      }
    }

    // 2. Find all lockers with currentReservation overlapping subscription date AND daily time slot
    const occupiedLockerIds = new Set<string>();
    const lockersWithRes = await Locker.find({
      libraryId,
      isDeleted: false,
      status: { $in: [LockerStatus.RESERVED, LockerStatus.OCCUPIED] },
      'currentReservation.startAt': { $lt: reqEnd },
      'currentReservation.endAt': { $gt: reqStart },
    }).lean();

    for (const l of lockersWithRes) {
      const res = l.currentReservation;
      if (!res) continue;
      const resFrom = res.fromTime || '06:00';
      const resTo = res.toTime || '23:00';
      if (AdminService.isTimeOverlapping(reqFromTime, reqToTime, resFrom, resTo)) {
        occupiedLockerIds.add(l._id.toString());
      }
    }

    // Also check pending payments for targetLockerId
    const pendingLockerPayments = await Payment.find({
      libraryId,
      status: PaymentStatus.PENDING,
      targetLockerId: { $exists: true, $ne: null },
    }).lean();

    for (const p of pendingLockerPayments) {
      if (!p.targetLockerId) continue;
      const pFrom = p.fromTime || '06:00';
      const pTo = p.toTime || '23:00';
      if (AdminService.isTimeOverlapping(reqFromTime, reqToTime, pFrom, pTo)) {
        occupiedLockerIds.add(p.targetLockerId.toString());
      }
    }

    const occupiedSeatsCount = occupiedSeatIds.size;
    const availableSeatsCount = Math.max(0, totalSeats - occupiedSeatsCount);

    const occupiedLockersCount = occupiedLockerIds.size;
    const availableLockersCount = Math.max(0, totalLockers - occupiedLockersCount);

    return {
      totalSeats,
      occupiedSeatsCount,
      availableSeatsCount,
      totalLockers,
      occupiedLockersCount,
      availableLockersCount,
      occupiedSeatIds: Array.from(occupiedSeatIds),
      occupiedLockerIds: Array.from(occupiedLockerIds),
    };
  }

  static async getEnrollmentOptions(
    libraryId: string,
    fromDate?: string,
    toDate?: string,
    fromTime?: string,
    toTime?: string
  ): Promise<any> {
    const paymentMaster = await AdminService.getPaymentMaster(libraryId);

    const capacity = await AdminService.checkTimeSlotCapacity(libraryId, fromDate, toDate, fromTime, toTime);
    const occupiedSeatSet = new Set(capacity.occupiedSeatIds);
    const occupiedLockerSet = new Set(capacity.occupiedLockerIds);

    const rawSeats = await Seat.find({ libraryId, isDeleted: false })
      .select('seatNumber floor status currentReservation')
      .sort({ floor: 1, seatNumber: 1 })
      .lean();

    const seats = rawSeats.map((s) => {
      const isOccupiedInSlot = occupiedSeatSet.has(s._id.toString()) || s.status === SeatStatus.BLOCKED;
      return {
        ...s,
        status: isOccupiedInSlot ? SeatStatus.OCCUPIED : SeatStatus.AVAILABLE,
        isAvailableInSlot: !isOccupiedInSlot,
      };
    });

    const rawLockers = await Locker.find({ libraryId, isDeleted: false })
      .select('lockerNumber floor status currentReservation')
      .sort({ floor: 1, lockerNumber: 1 })
      .lean();

    const lockers = rawLockers.map((l) => {
      const isOccupiedInSlot = occupiedLockerSet.has(l._id.toString()) || l.status === LockerStatus.BLOCKED;
      return {
        ...l,
        status: isOccupiedInSlot ? LockerStatus.OCCUPIED : LockerStatus.AVAILABLE,
        isAvailableInSlot: !isOccupiedInSlot,
      };
    });

    const seatFloors = Array.from(new Set(seats.map((s) => s.floor || 1))).sort((a, b) => a - b);
    const lockerFloors = Array.from(new Set(lockers.map((l) => l.floor || 1))).sort((a, b) => a - b);

    const libraryObj = await Library.findById(libraryId).select('featureFlags').lean();
    const flags = libraryObj?.featureFlags || {
      enableReservedSeats: true,
      enableLockers: true,
      enableReferrals: true,
      enableQRAttendance: true,
      enableManualPayment: true,
    };

    const finalSeats = flags.enableReservedSeats !== false ? seats : [];
    const finalLockers = flags.enableLockers !== false ? lockers : [];
    const finalSeatFloors = flags.enableReservedSeats !== false ? seatFloors : [];
    const finalLockerFloors = flags.enableLockers !== false ? lockerFloors : [];

    return {
      paymentMaster,
      capacity,
      seats: finalSeats,
      lockers: finalLockers,
      seatFloors: finalSeatFloors,
      lockerFloors: finalLockerFloors,
      featureFlags: flags,
    };
  }

  static async validateReferralCode(libraryId: string, code?: string): Promise<any> {
    const { ValidationError, ForbiddenError } = require('../utils/customErrors');
    const libraryObj = await Library.findById(libraryId).lean();
    if (libraryObj?.featureFlags?.enableReferrals === false) {
      throw new ForbiddenError('Student Referral System feature is disabled for your library tenant');
    }

    if (!code || !code.trim()) {
      throw new ValidationError('Referral code is required for validation.');
    }

    const cleanCode = code.trim().toUpperCase();

    // Find student profile by referral code
    const referrerProfile = await StudentProfile.findOne({ referralCode: cleanCode }).populate('userId', 'fullName phone');

    if (!referrerProfile) {
      throw new ValidationError('Invalid referral code. No student found with this code.');
    }

    // Must belong to the exact SAME library!
    if (referrerProfile.libraryId.toString() !== libraryId.toString()) {
      throw new ValidationError('Invalid referral coupon. Coupon belongs to a student of a different library.');
    }

    // Fetch library payment master for referral reward amount
    const master = await AdminService.getPaymentMaster(libraryId);
    const discountAmount = master?.referralRewardAmount ?? 100;
    const referrerName = (referrerProfile.userId as any)?.fullName || 'Local Library Student';

    return {
      valid: true,
      referralCode: cleanCode,
      referrerStudentId: referrerProfile._id,
      referrerName,
      discountAmount,
      message: `Valid referral coupon applied! ₹${discountAmount} discount from ${referrerName}.`,
    };
  }

  static calculateCalendarMonthFactor(startAt: Date, expiresAt: Date): { fullMonths: number; partialDays: number; monthFactor: number } {
    const d1 = new Date(startAt.getFullYear(), startAt.getMonth(), startAt.getDate());
    const d2 = new Date(expiresAt.getFullYear(), expiresAt.getMonth(), expiresAt.getDate());

    if (d2 <= d1) return { fullMonths: 0, partialDays: 0, monthFactor: 0 };

    let fullMonths = 0;
    let cursor = new Date(d1);

    while (true) {
      const nextMonth = new Date(cursor);
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      if (nextMonth <= d2) {
        fullMonths++;
        cursor = nextMonth;
      } else {
        break;
      }
    }

    const remainingTime = d2.getTime() - cursor.getTime();
    const partialDays = Math.max(0, Math.round(remainingTime / (1000 * 60 * 60 * 24)));

    const monthFactor = Number((fullMonths + partialDays / 30).toFixed(4));

    return { fullMonths, partialDays, monthFactor };
  }

  static async enrollStudent(
    libraryId: string,
    payload: {
      fullName: string;
      phone: string;
      aadharNumber?: string;
      fromDate: string | Date;
      toDate: string | Date;
      fromTime?: string;
      toTime?: string;
      profilePicturePath?: string;
      studentIdCardNo?: string;
      seatId?: string;
      lockerId?: string;
      assignedSeatId?: string;
      assignedLockerId?: string;
      referredBy?: string;
      paymentMethod?: string;
      totalAmount?: number;
      dailyHours?: number;
    }
  ): Promise<any> {
    const { User } = require('../models/user.model');
    const { UserRole } = require('../constants/roles');
    const { CryptoUtils } = require('../utils/crypto');
    const { ValidationError } = require('../utils/customErrors');
    const { Payment } = require('../models/payment.model');
    const { PaymentType, PaymentStatus, PaymentMethod } = require('../constants/statusEnums');

    const effectiveSeatId = payload.seatId || payload.assignedSeatId;
    const effectiveLockerId = payload.lockerId || payload.assignedLockerId;

    const startAt = new Date(payload.fromDate);
    const expiresAt = new Date(payload.toDate);

    const fromTime = payload.fromTime || '06:00';
    const toTime = payload.toTime || '23:00';

    const fromNum = AdminService.parseTimeToNumber(fromTime);
    const toNum = AdminService.parseTimeToNumber(toTime);

    const effToNum = toNum > fromNum ? toNum : 24;
    if (effToNum <= fromNum) {
      throw new ValidationError('To Time must be after From Time.');
    }

    const calculatedHours = Math.max(1, effToNum - fromNum);

    const minTo = new Date(startAt);
    minTo.setMonth(minTo.getMonth() + 1);
    if (expiresAt < minTo) {
      throw new ValidationError('To Date must be at least 1 month after From Date.');
    }

    const { fullMonths, partialDays, monthFactor } = AdminService.calculateCalendarMonthFactor(startAt, expiresAt);
    const monthsCount = Math.max(1, fullMonths + (partialDays > 0 ? 1 : 0));

    // Time-slot Overlapping Capacity & Availability Check
    const capacity = await AdminService.checkTimeSlotCapacity(libraryId, startAt, expiresAt, fromTime, toTime);

    if (effectiveSeatId && capacity.occupiedSeatIds.includes(effectiveSeatId)) {
      throw new ValidationError('Selected seat is already reserved for this date and time slot.');
    }

    if (effectiveLockerId && capacity.occupiedLockerIds.includes(effectiveLockerId)) {
      throw new ValidationError('Selected locker is already reserved for this date and time slot.');
    }

    const cardNo = payload.studentIdCardNo || `CARD-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const libraryObjForFlags = await Library.findById(libraryId).lean();

    // Referral Coupon Validation (Optional, must belong to same library)
    let referrerStudentProfile: any = null;
    let referralDiscount = 0;
    if (payload.referredBy && payload.referredBy.trim()) {
      if (libraryObjForFlags?.featureFlags?.enableReferrals === false) {
        throw new ForbiddenError('Student Referral System feature is disabled for your library tenant');
      }
      const cleanCode = payload.referredBy.trim().toUpperCase();
      referrerStudentProfile = await StudentProfile.findOne({ referralCode: cleanCode });

      if (!referrerStudentProfile) {
        throw new ValidationError('Invalid referral code. No student found with this code.');
      }

      if (referrerStudentProfile.libraryId.toString() !== libraryId.toString()) {
        throw new ValidationError('Invalid referral coupon. Coupon belongs to a student of a different library.');
      }

      const master = await AdminService.getPaymentMaster(libraryId);
      referralDiscount = master?.referralRewardAmount ?? 100;
    }

    // 1. Check seat existence & block status if seatId provided
    let targetSeat: any = null;
    if (effectiveSeatId) {
      if (libraryObjForFlags?.featureFlags?.enableReservedSeats === false) {
        throw new ForbiddenError('Reserved Seat feature is disabled for your library tenant');
      }
      targetSeat = await Seat.findOne({ _id: effectiveSeatId, libraryId, isDeleted: false });
      if (!targetSeat) {
        throw new ValidationError('Selected seat does not exist.');
      }
      if (targetSeat.status === SeatStatus.BLOCKED) {
        throw new ValidationError('Selected seat is currently blocked.');
      }
    }

    // 2. Check locker existence & block status if lockerId provided
    let targetLocker: any = null;
    if (effectiveLockerId) {
      if (libraryObjForFlags?.featureFlags?.enableLockers === false) {
        throw new ForbiddenError('Locker feature is disabled for your library tenant');
      }
      targetLocker = await Locker.findOne({ _id: effectiveLockerId, libraryId, isDeleted: false });
      if (!targetLocker) {
        throw new ValidationError('Selected locker does not exist.');
      }
      if (targetLocker.status === LockerStatus.BLOCKED) {
        throw new ValidationError('Selected locker is currently blocked.');
      }
    }

    // 3. Compute price using Payment Master hourly slab
    const master = await AdminService.getPaymentMaster(libraryId);
    const { subtotal } = AdminService.calculateTimeSlotFee(
      master,
      calculatedHours,
      monthsCount,
      !!effectiveSeatId,
      !!effectiveLockerId
    );
    const calculatedTotal = subtotal;

    let finalAmount = payload.totalAmount;
    if (finalAmount === undefined || finalAmount === null || isNaN(Number(finalAmount))) {
      finalAmount = Math.max(0, calculatedTotal - referralDiscount);
    }

    // 4. Validate Phone Isolation within the Same Library & Create/Find User with Generated Credentials
    const existingUser = await User.findOne({ phone: payload.phone });
    if (existingUser) {
      const existingProfileInLibrary = await StudentProfile.findOne({
        userId: existingUser._id,
        libraryId,
      });
      if (existingProfileInLibrary) {
        throw new ValidationError(`A student with phone number ${payload.phone} is already enrolled in this library.`);
      }
    }

    // Helper for secure password generation
    const generateSecurePassword = (): string => {
      const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
      const lower = 'abcdefghijkmnpqrstuvwxyz';
      const num = '23456789';
      const sym = '#@!%';
      const all = upper + lower + num + sym;
      let pass = upper.charAt(Math.floor(Math.random() * upper.length)) +
                 lower.charAt(Math.floor(Math.random() * lower.length)) +
                 num.charAt(Math.floor(Math.random() * num.length)) +
                 sym.charAt(Math.floor(Math.random() * sym.length));
      for (let i = 0; i < 6; i++) {
        pass += all.charAt(Math.floor(Math.random() * all.length));
      }
      return pass;
    };

    // Generate unique email: student.name@libraryname.com
    const libraryObj = await Library.findById(libraryId);
    const cleanStudentName = payload.fullName.trim().toLowerCase().replace(/[^a-z0-9]/g, '.').replace(/\.+/g, '.').replace(/^\.|\.$/g, '') || 'student';
    const cleanLibraryName = (libraryObj?.name || 'nextlib').trim().toLowerCase().replace(/[^a-z0-9]/g, '') || 'library';
    
    let generatedEmail = `${cleanStudentName}@${cleanLibraryName}.com`;
    let counter = 1;
    while (await User.findOne({ email: generatedEmail })) {
      generatedEmail = `${cleanStudentName}${counter}@${cleanLibraryName}.com`;
      counter++;
    }

    const rawGeneratedPassword = generateSecurePassword();
    const hashedPassword = await CryptoUtils.hashPassword(rawGeneratedPassword);

    let user = existingUser;
    if (!user) {
      user = await User.create({
        fullName: payload.fullName,
        phone: payload.phone,
        email: generatedEmail,
        passwordHash: hashedPassword,
        role: UserRole.STUDENT,
        isActive: true,
      });
    } else {
      if (!user.email) user.email = generatedEmail;
      user.fullName = payload.fullName;
      user.passwordHash = hashedPassword;
      await user.save();
    }

    // 5. Create or update StudentProfile
    let profile = await StudentProfile.findOne({ userId: user._id, libraryId });
    if (!profile) {
      const referralCode = `REF-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      profile = await StudentProfile.create({
        userId: user._id,
        libraryId,
        studentIdCardNo: cardNo,
        aadharNumber: payload.aadharNumber,
        profilePicture: payload.profilePicturePath,
        fromDate: startAt,
        toDate: expiresAt,
        fromTime,
        toTime,
        monthsCount,
        membershipStatus: MembershipStatus.ACTIVE,
        membershipExpiresAt: expiresAt,
        referralCode,
        referredByStudentId: referrerStudentProfile ? referrerStudentProfile._id : undefined,
        currentSeatId: effectiveSeatId as any,
        currentLockerId: effectiveLockerId as any,
      });
    } else {
      profile.membershipStatus = MembershipStatus.ACTIVE;
      profile.membershipExpiresAt = expiresAt;
      profile.fromDate = startAt;
      profile.toDate = expiresAt;
      profile.fromTime = fromTime;
      profile.toTime = toTime;
      profile.monthsCount = monthsCount;
      if (referrerStudentProfile) profile.referredByStudentId = referrerStudentProfile._id;
      if (payload.aadharNumber) profile.aadharNumber = payload.aadharNumber;
      if (payload.profilePicturePath) profile.profilePicture = payload.profilePicturePath;
      if (effectiveSeatId) profile.currentSeatId = effectiveSeatId as any;
      if (effectiveLockerId) profile.currentLockerId = effectiveLockerId as any;
      await profile.save();
    }

    if (referrerStudentProfile) {
      try {
        const { Referral } = require('../models/referral.model');
        await Referral.create({
          referrerStudentId: referrerStudentProfile._id,
          referredUserId: user._id,
          libraryId,
          status: 'REWARDED',
          rewardAmount: referralDiscount,
        });
      } catch (e) {
        // Ignore if referral already recorded
      }
    }

    // 6. Update Seat reservation
    if (effectiveSeatId) {
      await Seat.findByIdAndUpdate(effectiveSeatId, {
        status: SeatStatus.OCCUPIED,
        'currentReservation.studentId': profile._id,
        'currentReservation.startAt': startAt,
        'currentReservation.endAt': expiresAt,
        'currentReservation.fromTime': fromTime,
        'currentReservation.toTime': toTime,
        'currentReservation.reservedAt': new Date(),
        $push: {
          assignedReservations: {
            studentId: profile._id,
            startAt,
            endAt: expiresAt,
            fromTime,
            toTime,
            reservedAt: new Date(),
          },
        },
      });
    }

    // 7. Update Locker reservation
    if (effectiveLockerId) {
      await Locker.findByIdAndUpdate(effectiveLockerId, {
        status: LockerStatus.OCCUPIED,
        'currentReservation.studentId': profile._id,
        'currentReservation.startAt': startAt,
        'currentReservation.endAt': expiresAt,
        'currentReservation.fromTime': fromTime,
        'currentReservation.toTime': toTime,
        'currentReservation.reservedAt': new Date(),
        $push: {
          assignedReservations: {
            studentId: profile._id,
            startAt,
            endAt: expiresAt,
            fromTime,
            toTime,
            reservedAt: new Date(),
          },
        },
      });
    }

    // 8. Create approved Payment record
    const pMethod = payload.paymentMethod || PaymentMethod.CASH;
    let pType = PaymentType.FEES;
    if (effectiveSeatId && effectiveLockerId) pType = PaymentType.COMBINED;
    else if (effectiveSeatId) pType = PaymentType.SEAT;
    else if (effectiveLockerId) pType = PaymentType.LOCKER;

    const payment = await Payment.create({
      libraryId,
      studentId: profile._id,
      paymentType: pType,
      paymentMethod: pMethod,
      amount: Number(finalAmount),
      status: PaymentStatus.APPROVED,
      targetSeatId: payload.seatId as any,
      targetLockerId: payload.lockerId as any,
      hours: calculatedHours,
      months: monthsCount,
      fromTime,
      toTime,
      billingCycleStart: startAt,
      billingCycleEnd: expiresAt,
      idempotencyKey: `ENROLL-${profile._id}-${Date.now()}`,
    });

    return {
      user: {
        id: user._id,
        fullName: user.fullName,
        phone: user.phone,
        email: user.email,
      },
      profile,
      payment,
      credentials: {
        email: user.email || generatedEmail,
        password: rawGeneratedPassword,
        phone: user.phone,
        fullName: user.fullName,
      },
    };
  }

  static async getDetailedEarnings(libraryId: string, fromDateStr?: string, toDateStr?: string): Promise<any> {
    const mongoose = require('mongoose');
    const libObjId = new mongoose.Types.ObjectId(libraryId);

    const now = new Date();
    let startDate: Date;
    let endDate: Date;

    if (fromDateStr && /^\d{4}-\d{2}-\d{2}/.test(fromDateStr.trim())) {
      const parts = fromDateStr.trim().split('T')[0].split('-').map(Number);
      startDate = new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0);
    } else {
      // Default: Start of current month
      startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    }

    if (toDateStr && /^\d{4}-\d{2}-\d{2}/.test(toDateStr.trim())) {
      const parts = toDateStr.trim().split('T')[0].split('-').map(Number);
      endDate = new Date(parts[0], parts[1] - 1, parts[2], 23, 59, 59, 999);
    } else {
      // Default: End of today
      endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    }

    const payments = await Payment.find({
      libraryId: libObjId,
      status: PaymentStatus.APPROVED,
      createdAt: { $gte: startDate, $lte: endDate },
    })
      .populate('targetSeatId', 'priceMonthly')
      .populate('targetLockerId', 'priceMonthly')
      .lean();

    const paymentMaster = await AdminService.getPaymentMaster(libraryId);

    let membershipRevenue = 0;
    let seatRevenue = 0;
    let lockerRevenue = 0;
    let totalRevenue = 0;

    const trendMap: Record<string, { date: string; membership: number; seat: number; locker: number; total: number }> = {};

    for (const p of payments) {
      const amt = p.amount || 0;
      totalRevenue += amt;

      const dateKey = p.createdAt ? new Date(p.createdAt).toISOString().split('T')[0] : 'N/A';

      let mRev = 0;
      let sRev = 0;
      let lRev = 0;

      if (p.paymentType === 'FEES') {
        mRev = amt;
      } else if (p.paymentType === 'SEAT') {
        sRev = amt;
      } else if (p.paymentType === 'LOCKER') {
        lRev = amt;
      } else {
        const months = Math.max(1, p.months || 1);
        const hasSeat = !!(p.targetSeatId || p.hasSeat);
        const hasLocker = !!(p.targetLockerId || p.hasLocker);

        const seatRate = (p.targetSeatId as any)?.priceMonthly || paymentMaster?.seatMonthlyRate || 500;
        const lockerRate = (p.targetLockerId as any)?.priceMonthly || paymentMaster?.lockerMonthlyRate || 200;

        const calcSeat = hasSeat ? Math.round(seatRate * months) : 0;
        const calcLocker = hasLocker ? Math.round(lockerRate * months) : 0;

        if (!hasSeat && !hasLocker) {
          mRev = amt;
        } else if (calcSeat + calcLocker >= amt) {
          sRev = hasSeat ? Math.round(amt * (calcSeat / (calcSeat + calcLocker || 1))) : 0;
          lRev = amt - sRev;
          mRev = 0;
        } else {
          sRev = calcSeat;
          lRev = calcLocker;
          mRev = Math.max(0, amt - sRev - lRev);
        }
      }

      membershipRevenue += mRev;
      seatRevenue += sRev;
      lockerRevenue += lRev;

      if (!trendMap[dateKey]) {
        trendMap[dateKey] = { date: dateKey, membership: 0, seat: 0, locker: 0, total: 0 };
      }
      trendMap[dateKey].membership += mRev;
      trendMap[dateKey].seat += sRev;
      trendMap[dateKey].locker += lRev;
      trendMap[dateKey].total += amt;
    }

    const dayMs = 24 * 60 * 60 * 1000;
    const diffDays = Math.ceil((endDate.getTime() - startDate.getTime()) / dayMs);
    const trendData: Array<{ date: string; membership: number; seat: number; locker: number; total: number }> = [];

    if (diffDays >= 1 && diffDays <= 60) {
      const cur = new Date(startDate);
      while (cur <= endDate) {
        const key = cur.toISOString().split('T')[0];
        if (trendMap[key]) {
          trendData.push(trendMap[key]);
        } else {
          trendData.push({ date: key, membership: 0, seat: 0, locker: 0, total: 0 });
        }
        cur.setDate(cur.getDate() + 1);
      }
    } else {
      Object.keys(trendMap)
        .sort()
        .forEach((k) => trendData.push(trendMap[k]));
    }

    const referralAgg = await (require('../models/referral.model').Referral).aggregate([
      { $match: { libraryId: libObjId, status: 'REWARDED', createdAt: { $gte: startDate, $lte: endDate } } },
      { $group: { _id: null, totalReward: { $sum: '$rewardAmount' }, count: { $sum: 1 } } },
    ]);

    const referralTotal = referralAgg[0]?.totalReward || 0;

    return {
      fromDate: startDate.toISOString().split('T')[0],
      toDate: endDate.toISOString().split('T')[0],
      totalRevenue: Math.round(totalRevenue),
      membershipRevenue: Math.round(membershipRevenue),
      seatRevenue: Math.round(seatRevenue),
      lockerRevenue: Math.round(lockerRevenue),
      transactionCount: payments.length,
      trendData,
      referralTotal,
      referralCount: referralAgg[0]?.count || 0,
      // Legacy fields
      monthlyTotal: Math.round(totalRevenue),
      annualTotal: Math.round(totalRevenue),
      currentMonthRevenue: Math.round(totalRevenue),
    };
  }

  static async calculateFullDayMonthlyHours(libraryId: string, master?: any): Promise<number> {
    const { Library } = require('../models/library.model');
    const library = await Library.findById(libraryId).lean();

    // 1. Try from Full Day shift in payment master
    if (master?.shifts && Array.isArray(master.shifts)) {
      const fullDayShift = master.shifts.find(
        (s: any) => s.name?.toLowerCase().includes('full day') || s.name?.toLowerCase().includes('fullday')
      );
      if (fullDayShift && fullDayShift.startTime && fullDayShift.endTime) {
        const [startH, startM] = fullDayShift.startTime.split(':').map(Number);
        const [endH, endM] = fullDayShift.endTime.split(':').map(Number);
        const diff = (endH + (endM || 0) / 60) - (startH + (startM || 0) / 60);
        if (diff > 0) return Math.round(diff * 30);
      }
    }

    // 2. Try from library openingTime & closingTime
    if (library?.openingTime && library?.closingTime) {
      const [startH, startM] = library.openingTime.split(':').map(Number);
      const [endH, endM] = library.closingTime.split(':').map(Number);
      const diff = (endH + (endM || 0) / 60) - (startH + (startM || 0) / 60);
      if (diff > 0) return Math.round(diff * 30);
    }

    // Default: 17 hours/day (06:00 to 23:00) * 30 days = 510 hours/month
    return 510;
  }

  static async getPaymentMaster(libraryId: string): Promise<any> {
    const { PaymentMaster } = require('../models/paymentMaster.model');
    const { Library } = require('../models/library.model');
    const DEFAULT_LIBRARY_RATES = [400, 400, 400, 400, 800, 800, 800, 800, 1200, 1200, 1200, 1200];
    const DEFAULT_SEAT_RATES = [200, 200, 200, 200, 350, 350, 350, 350, 500, 500, 500, 500];
    const DEFAULT_LOCKER_RATES = [100, 100, 100, 100, 150, 150, 150, 150, 200, 200, 200, 200];

    const libraryObj = await Library.findById(libraryId).select('featureFlags').lean();
    const featureFlags = libraryObj?.featureFlags || {
      enableReservedSeats: true,
      enableLockers: true,
      enableReferrals: true,
      enableQRAttendance: true,
      enableManualPayment: true,
    };

    let master = await PaymentMaster.findOne({ libraryId }).lean();
    if (!master) {
      master = await PaymentMaster.create({
        libraryId,
        monthlyFee: 1200,
        seatMonthlyFee: 500,
        quarterlyFee: 3400,
        halfYearlyFee: 6500,
        annualFee: 12000,
        lockerMonthlyFee: 200,
        referralRewardAmount: 100,
        libraryHourlyRates: DEFAULT_LIBRARY_RATES,
        seatHourlyRates: DEFAULT_SEAT_RATES,
        lockerHourlyRates: DEFAULT_LOCKER_RATES,
      });
    }

    const libraryHourlyRates = master.libraryHourlyRates?.length === 12 ? master.libraryHourlyRates : DEFAULT_LIBRARY_RATES;
    const seatHourlyRates = master.seatHourlyRates?.length === 12 ? master.seatHourlyRates : DEFAULT_SEAT_RATES;
    const lockerHourlyRates = master.lockerHourlyRates?.length === 12 ? master.lockerHourlyRates : DEFAULT_LOCKER_RATES;

    const response: any = {
      ...master,
      featureFlags,
      libraryHourlyRates,
      monthlyFee: libraryHourlyRates[11] || master.monthlyFee || 1200,
      hourlyMonthlyRate: Math.round((libraryHourlyRates[0] || 400) / 4),
    };

    if (featureFlags.enableReservedSeats !== false) {
      response.seatHourlyRates = seatHourlyRates;
      response.seatMonthlyFee = seatHourlyRates[11] || master.seatMonthlyFee || 500;
      response.seatHourlyMonthlyRate = Math.round((seatHourlyRates[0] || 200) / 4);
    } else {
      delete response.seatHourlyRates;
      delete response.seatMonthlyFee;
      delete response.seatHourlyMonthlyRate;
    }

    if (featureFlags.enableLockers !== false) {
      response.lockerHourlyRates = lockerHourlyRates;
      response.lockerMonthlyFee = lockerHourlyRates[11] || master.lockerMonthlyFee || 200;
      response.lockerHourlyMonthlyRate = Math.round((lockerHourlyRates[0] || 100) / 4);
    } else {
      delete response.lockerHourlyRates;
      delete response.lockerMonthlyFee;
      delete response.lockerHourlyMonthlyRate;
    }

    return response;
  }

  static async updatePaymentMaster(libraryId: string, payload: any): Promise<any> {
    const { PaymentMaster } = require('../models/paymentMaster.model');
    const { Library } = require('../models/library.model');
    const { ForbiddenError } = require('../utils/customErrors');

    const DEFAULT_LIBRARY_RATES = [400, 400, 400, 400, 800, 800, 800, 800, 1200, 1200, 1200, 1200];
    const DEFAULT_SEAT_RATES = [200, 200, 200, 200, 350, 350, 350, 350, 500, 500, 500, 500];
    const DEFAULT_LOCKER_RATES = [100, 100, 100, 100, 150, 150, 150, 150, 200, 200, 200, 200];

    const libraryObj = await Library.findById(libraryId).select('featureFlags').lean();
    const featureFlags = libraryObj?.featureFlags || {
      enableReservedSeats: true,
      enableLockers: true,
      enableReferrals: true,
      enableQRAttendance: true,
      enableManualPayment: true,
    };

    if (featureFlags.enableReservedSeats === false) {
      if (payload.seatHourlyRates !== undefined || payload.seatMonthlyFee !== undefined || payload.seatPrice !== undefined) {
        throw new ForbiddenError('Seat pricing configuration is disabled for your library tenant');
      }
    }

    if (featureFlags.enableLockers === false) {
      if (payload.lockerHourlyRates !== undefined || payload.lockerMonthlyFee !== undefined || payload.lockerPrice !== undefined) {
        throw new ForbiddenError('Locker pricing configuration is disabled for your library tenant');
      }
    }

    const existing = await PaymentMaster.findOne({ libraryId }).lean();

    const libraryHourlyRates = Array.isArray(payload.libraryHourlyRates) && payload.libraryHourlyRates.length === 12
      ? payload.libraryHourlyRates.map(Number)
      : (existing?.libraryHourlyRates || DEFAULT_LIBRARY_RATES);

    const seatHourlyRates = (featureFlags.enableReservedSeats !== false && Array.isArray(payload.seatHourlyRates) && payload.seatHourlyRates.length === 12)
      ? payload.seatHourlyRates.map(Number)
      : (existing?.seatHourlyRates || DEFAULT_SEAT_RATES);

    const lockerHourlyRates = (featureFlags.enableLockers !== false && Array.isArray(payload.lockerHourlyRates) && payload.lockerHourlyRates.length === 12)
      ? payload.lockerHourlyRates.map(Number)
      : (existing?.lockerHourlyRates || DEFAULT_LOCKER_RATES);

    const updatedPayload: any = {
      ...payload,
      libraryHourlyRates,
      seatHourlyRates,
      lockerHourlyRates,
      monthlyFee: libraryHourlyRates[11] || 1200,
      seatMonthlyFee: seatHourlyRates[11] || 500,
      lockerMonthlyFee: lockerHourlyRates[11] || 200,
    };

    if (featureFlags.enableReservedSeats === false) {
      delete updatedPayload.seatHourlyRates;
      delete updatedPayload.seatMonthlyFee;
    }
    if (featureFlags.enableLockers === false) {
      delete updatedPayload.lockerHourlyRates;
      delete updatedPayload.lockerMonthlyFee;
    }

    await PaymentMaster.findOneAndUpdate({ libraryId }, { $set: updatedPayload }, { new: true, upsert: true }).lean();
    return this.getPaymentMaster(libraryId);
  }

  static async sendNotification(
    libraryId: string,
    payload: {
      target: 'ALL' | 'SINGLE' | 'SELECTED';
      title: string;
      body?: string;
      expiresAt: string | Date;
      studentProfileId?: string;
      recipientStudentIds?: string[];
    }
  ): Promise<any> {
    const { Notification } = require('../models/notification.model');
    const { StudentProfile } = require('../models/studentProfile.model');
    const { ValidationError } = require('../utils/customErrors');

    const cleanTitle = (payload.title || '').trim();
    if (!cleanTitle) {
      throw new ValidationError('Headline is required for the notification.');
    }

    if (!payload.expiresAt) {
      throw new ValidationError('Expiry date & time is required.');
    }

    const expDate = new Date(payload.expiresAt);
    if (isNaN(expDate.getTime())) {
      throw new ValidationError('Valid Expiry Date & Time is required.');
    }

    const now = new Date();
    const minExpTime = now.getTime() + 60 * 60 * 1000 - 5000;
    if (expDate.getTime() < minExpTime) {
      throw new ValidationError('Minimum expiry time must be at least 1 hour from the current time.');
    }

    const targetType = payload.target || 'ALL';
    let recipientIds: string[] = [];

    if (targetType === 'SINGLE' && payload.studentProfileId) {
      recipientIds = [payload.studentProfileId];
    } else if (targetType === 'SELECTED' && Array.isArray(payload.recipientStudentIds)) {
      recipientIds = payload.recipientStudentIds.filter(Boolean);
    }

    if (targetType !== 'ALL') {
      if (recipientIds.length === 0) {
        throw new ValidationError('Please select at least one student recipient.');
      }

      const validProfiles = await StudentProfile.find({
        _id: { $in: recipientIds },
        libraryId,
      }).select('_id');

      if (validProfiles.length !== recipientIds.length) {
        throw new ValidationError('Selected students must belong to your library.');
      }
    }

    const notif = await Notification.create({
      libraryId,
      title: cleanTitle,
      body: (payload.body || '').trim(),
      type: targetType === 'ALL' ? 'BROADCAST' : 'SELECTED_STUDENTS',
      recipientStudentIds: targetType !== 'ALL' ? recipientIds : undefined,
      recipientStudentId: recipientIds.length === 1 ? recipientIds[0] : undefined,
      expiresAt: expDate,
      status: 'ACTIVE',
    });

    return notif;
  }

  static async getSentNotifications(libraryId: string): Promise<any> {
    const { Notification } = require('../models/notification.model');
    const { User } = require('../models/user.model');
    const { StudentProfile } = require('../models/studentProfile.model');

    const notifs = await Notification.find({ libraryId })
      .populate({
        path: 'recipientStudentIds',
        populate: { path: 'userId', select: 'fullName phone' },
      })
      .populate({
        path: 'recipientStudentId',
        populate: { path: 'userId', select: 'fullName phone' },
      })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    const now = new Date();
    return notifs.map((n: any) => {
      let computedStatus = n.status;
      if (n.status === 'ACTIVE' && new Date(n.expiresAt) <= now) {
        computedStatus = 'EXPIRED';
      }
      return {
        ...n,
        status: computedStatus,
      };
    });
  }

  static async hideNotification(libraryId: string, notificationId: string): Promise<any> {
    const { Notification } = require('../models/notification.model');
    const { NotFoundError, ForbiddenError } = require('../utils/customErrors');

    const notif = await Notification.findOne({ _id: notificationId, libraryId });
    if (!notif) {
      throw new NotFoundError('Notification not found or does not belong to your library.');
    }

    if (notif.type === 'SUPER_ADMIN_BROADCAST' || notif.type === 'SUPER_ADMIN_ANNOUNCEMENT') {
      throw new ForbiddenError('Local Admins are not permitted to hide or reset notifications created by Super Admin.');
    }

    notif.status = 'HIDDEN';
    await notif.save();

    return {
      message: 'Notification reset/hidden successfully. It is no longer visible on student dashboards.',
      notification: notif,
    };
  }

  static async referStudentToOtherLibrary(
    studentProfileId: string,
    targetLibraryId: string,
    notes?: string
  ): Promise<any> {
    const student = await StudentProfile.findById(studentProfileId).populate('userId');
    if (!student) throw new Error('Student profile not found');

    const targetLib = await Library.findById(targetLibraryId);
    if (!targetLib) throw new Error('Target library not found');

    // Create student profile in target library
    const referralCode = `REF-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    const newProfile = await StudentProfile.create({
      userId: student.userId,
      libraryId: targetLibraryId,
      studentIdCardNo: student.studentIdCardNo,
      membershipStatus: MembershipStatus.PENDING_PAYMENT,
      referralCode,
    });

    return {
      message: `Student referred to ${targetLib.name} successfully`,
      newProfile,
    };
  }

  static async submitSaaSPayment(
    libraryId: string,
    adminUserId: string,
    payload: {
      amount?: number;
      paymentMethod?: string;
      transactionRef?: string;
      proofImage?: string;
    }
  ): Promise<any> {
    const { SaaSPayment } = require('../models/saasPayment.model');
    const library = await Library.findById(libraryId);
    if (!library) throw new NotFoundError('Library not found');

    const payment = await SaaSPayment.create({
      libraryId: library._id,
      adminUserId,
      planType: library.saasPlanType || 'MONTHLY',
      amount: payload.amount || library.saasAmount || 1200,
      paymentMethod: payload.paymentMethod || 'UPI',
      transactionRef: payload.transactionRef?.trim(),
      proofImage: payload.proofImage,
      status: 'PENDING',
      dueDate: library.saasNextDueDate || new Date(),
      submittedAt: new Date(),
    });

    library.saasPaymentStatus = 'PENDING_APPROVAL';
    await library.save();

    return {
      message: 'SaaS Payment submitted successfully. Pending Super Admin approval.',
      payment,
    };
  }

  static async getSaaSPaymentDetails(libraryId: string): Promise<any> {
    const { SaaSPayment } = require('../models/saasPayment.model');
    const library = await Library.findById(libraryId).lean();
    if (!library) throw new NotFoundError('Library not found');

    const paymentHistory = await SaaSPayment.find({ libraryId })
      .sort({ createdAt: -1 })
      .lean();

    const now = new Date();
    let computedStatus = library.saasPaymentStatus || 'UP_TO_DATE';
    if (library.saasNextDueDate && new Date(library.saasNextDueDate) < now && computedStatus !== 'PENDING_APPROVAL') {
      computedStatus = 'OVERDUE_DEFAULTER';
    }

    return {
      libraryId: library._id,
      libraryName: library.name,
      libraryCode: library.code,
      saasPlanType: library.saasPlanType || 'MONTHLY',
      saasAmount: library.saasAmount || 1200,
      saasNextDueDate: library.saasNextDueDate || library.createdAt,
      saasPaymentStatus: computedStatus,
      upiId: '9873109637@ptsbi',
      accountHolderName: 'Vaibhav Vanjani',
      qrCodeImage: '/super-admin-qr.png',
      paymentHistory,
    };
  }

  static async seedOverdueTestStudent(libraryId: string): Promise<any> {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 2);

    let studentProfile = await StudentProfile.findOne({ libraryId }).sort({ createdAt: -1 });
    if (studentProfile) {
      studentProfile.membershipExpiresAt = yesterday;
      studentProfile.toDate = yesterday;
      studentProfile.membershipStatus = MembershipStatus.PENDING_PAYMENT;
      await studentProfile.save();
      return {
        message: `Updated student profile ${studentProfile.studentIdCardNo} due date to ${yesterday.toISOString().split('T')[0]} (Overdue for testing).`,
        studentProfile,
      };
    }
    return { message: 'No student profile found in this library to set overdue date' };
  }
}
