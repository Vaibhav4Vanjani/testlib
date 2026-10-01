import { AttendanceSession } from '../models/attendanceSession.model';
import { StudentProfile } from '../models/studentProfile.model';
import { QRService, IQRPayload } from './qr.service';
import { MembershipStatus, AttendanceStatus } from '../constants/statusEnums';
import { ValidationError, AuthorizationError, NotFoundError } from '../utils/customErrors';
import { logger } from '../config/logger';

export class AttendanceService {
  static async scanQR(studentUserId: string, qrPayload?: IQRPayload) {
    // 1. Fetch student profile and verify membership
    const studentProfile = await StudentProfile.findOne({ userId: studentUserId });
    if (!studentProfile) {
      throw new NotFoundError('Student profile not found');
    }

    let libraryId: string;
    if (qrPayload && qrPayload.libraryId) {
      const { libraryId: valLibId } = await QRService.validateQRPayload(qrPayload);
      libraryId = valLibId;

      // Multi-Tenant isolation check
      if (studentProfile.libraryId.toString() !== libraryId) {
        throw new AuthorizationError('You are not registered in this library tenant', 'CROSS_TENANT_DENIED');
      }
    } else {
      libraryId = studentProfile.libraryId.toString();
    }

    // 4. Verify Active Membership & Shift Hours Eligibility
    const now = new Date();
    await AttendanceService.validateStudentCheckInEligibility(studentProfile, now);

    // 5. Check if student has an existing ACTIVE attendance session
    const activeSession = await AttendanceSession.findOne({
      libraryId,
      studentId: studentProfile._id,
      status: AttendanceStatus.ACTIVE,
    });

    if (activeSession) {
      // Execute CHECK-OUT
      const checkInTime = new Date(activeSession.checkInAt).getTime();
      const checkOutTime = now.getTime();
      const durationMinutes = Math.max(1, Math.round((checkOutTime - checkInTime) / (1000 * 60)));

      activeSession.checkOutAt = now;
      activeSession.durationMinutes = durationMinutes;
      activeSession.status = AttendanceStatus.COMPLETED;
      await activeSession.save();

      // Update student monthly pre-aggregated study stats
      const currentMonthStr = now.toISOString().slice(0, 7); // YYYY-MM
      if (studentProfile.monthlyStats?.lastCalculatedMonth === currentMonthStr) {
        studentProfile.monthlyStats.totalStudyMinutes += durationMinutes;
      } else {
        studentProfile.monthlyStats = {
          totalStudyMinutes: durationMinutes,
          lastCalculatedMonth: currentMonthStr,
        };
      }
      await studentProfile.save();

      logger.info(`Student ${studentProfile._id} CHECKED OUT. Duration: ${durationMinutes} mins`);

      return {
        action: 'CHECK_OUT',
        session: activeSession,
        message: `Checked out successfully! Today's session duration: ${Math.floor(durationMinutes / 60)}h ${durationMinutes % 60}m`,
      };
    } else {
      // Execute QR Attendance Approval Flow for Check-In
      const { AttendanceRequest } = require('../models/attendanceRequest.model');
      const { Payment } = require('../models/payment.model');
      const { PaymentStatus } = require('../constants/statusEnums');

      const existingPending = await AttendanceRequest.findOne({
        libraryId,
        studentProfileId: studentProfile._id,
        status: 'PENDING',
      });

      if (existingPending) {
        return {
          action: 'PENDING_APPROVAL',
          request: existingPending,
          message: 'Attendance check-in request already pending approval from Local Admin.',
        };
      }

      // Check payment status at scan time
      const dueCount = await Payment.countDocuments({
        studentId: studentProfile._id,
        status: PaymentStatus.PENDING,
      });
      const paymentStatusAtScan = dueCount > 0 ? 'PENDING' : 'PAID';

      const scanRequest = await AttendanceRequest.create({
        libraryId,
        studentProfileId: studentProfile._id,
        userId: studentProfile.userId,
        scanTimestamp: now,
        status: 'PENDING',
        paymentStatusAtScan,
      });

      logger.info(`Attendance request ${scanRequest._id} created for student ${studentProfile._id} at ${now.toISOString()}`);

      return {
        action: 'REQUEST_SUBMITTED',
        request: scanRequest,
        message: 'Attendance check-in request sent! Awaiting Local Admin approval.',
      };
    }
  }

  static async getPendingAttendanceRequests(libraryId: string) {
    const { AttendanceRequest } = require('../models/attendanceRequest.model');
    const { storageService } = require('../config/storage');

    const requests = await AttendanceRequest.find({ libraryId, status: 'PENDING' })
      .populate({
        path: 'studentProfileId',
        select: 'studentIdCardNo profilePicture membershipStatus membershipExpiresAt aadharNumber currentSeatId',
        populate: { path: 'currentSeatId', select: 'seatNumber floor' },
      })
      .populate('userId', 'fullName phone email')
      .sort({ createdAt: -1 })
      .lean();

    return requests.map((req: any) => ({
      ...req,
      seatNumber: req.studentProfileId?.currentSeatId?.seatNumber || null,
      studentProfileId: {
        ...req.studentProfileId,
        profilePictureUrl: req.studentProfileId?.profilePicture ? storageService.getFileUrl(req.studentProfileId.profilePicture) : null,
      },
    }));
  }

  static async approveAttendanceRequest(libraryId: string, adminUserId: string, requestId: string) {
    const { AttendanceRequest } = require('../models/attendanceRequest.model');
    const request = await AttendanceRequest.findOne({ _id: requestId, libraryId, status: 'PENDING' });
    if (!request) throw new NotFoundError('Pending attendance request not found');

    request.status = 'APPROVED';
    request.approvedByAdminId = adminUserId as any;
    request.processedAt = new Date();
    await request.save();

    // Create session using original QR scan timestamp!
    const sessionNonce = `${requestId}_${request.scanTimestamp.getTime()}`;
    const newSession = await AttendanceSession.create({
      libraryId,
      studentId: request.studentProfileId,
      checkInAt: request.scanTimestamp,
      status: AttendanceStatus.ACTIVE,
      checkInNonce: sessionNonce,
    });

    logger.info(`Attendance request ${requestId} APPROVED by admin ${adminUserId}. Check-in timestamp locked to ${request.scanTimestamp.toISOString()}`);
    return { session: newSession, request };
  }

  static async rejectAttendanceRequest(libraryId: string, adminUserId: string, requestId: string, rejectionReason: string) {
    const { AttendanceRequest } = require('../models/attendanceRequest.model');
    const { Notification } = require('../models/notification.model');

    const request = await AttendanceRequest.findOne({ _id: requestId, libraryId, status: 'PENDING' });
    if (!request) throw new NotFoundError('Pending attendance request not found');

    const cleanReason = (rejectionReason || 'Attendance check-in request rejected by admin. Please rescan QR code.').trim();

    request.status = 'REJECTED';
    request.rejectionReason = cleanReason;
    request.approvedByAdminId = adminUserId as any;
    request.processedAt = new Date();
    await request.save();

    // Send notification to student
    try {
      const defaultExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      await Notification.create({
        libraryId,
        recipientStudentId: request.studentProfileId,
        title: 'Attendance Check-in Rejected',
        body: `Your QR attendance scan was rejected by Admin. Reason: "${cleanReason}". You can scan the QR again.`,
        type: 'ALERT',
        expiresAt: defaultExpiry,
        status: 'ACTIVE',
      });
    } catch (notifErr: any) {
      logger.warn(`Failed to create rejection notification: ${notifErr?.message}`);
    }

    logger.info(`Attendance request ${requestId} REJECTED by admin ${adminUserId}. Reason: ${cleanReason}`);
    return { request };
  }

  static async getAttendanceHistory(studentProfileId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const sessions = await AttendanceSession.find({ studentId: studentProfileId })
      .sort({ checkInAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await AttendanceSession.countDocuments({ studentId: studentProfileId });

    return {
      sessions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  static async getCurrentSession(studentProfileId: string): Promise<any> {
    const { AttendanceRequest } = require('../models/attendanceRequest.model');

    const activeSession = await AttendanceSession.findOne({
      studentId: studentProfileId,
      status: AttendanceStatus.ACTIVE,
    }).lean();

    const pendingRequest = await AttendanceRequest.findOne({
      studentProfileId,
      status: 'PENDING',
    }).sort({ createdAt: -1 }).lean();

    const rejectedRequest = await AttendanceRequest.findOne({
      studentProfileId,
      status: 'REJECTED',
    }).sort({ createdAt: -1 }).lean();

    let state = 'NO_ACTIVE_REQUEST';
    if (activeSession) {
      state = 'APPROVED';
    } else if (pendingRequest) {
      state = 'PENDING';
    } else if (rejectedRequest && (Date.now() - new Date(rejectedRequest.updatedAt || rejectedRequest.createdAt).getTime() < 30 * 60 * 1000)) {
      state = 'REJECTED';
    }

    return {
      state,
      activeSession: activeSession || null,
      pendingRequest: pendingRequest || null,
      rejectedRequest: rejectedRequest || null,
      ...(activeSession || {}),
    };
  }

  static async getMonthlyStudyReport(studentProfileId: string, monthStr?: string) {
    const targetMonth = monthStr || new Date().toISOString().slice(0, 7);
    const startOfMonth = new Date(`${targetMonth}-01T00:00:00.000Z`);
    const endOfMonth = new Date(startOfMonth.getFullYear(), startOfMonth.getMonth() + 1, 0, 23, 59, 59, 999);

    const sessions = await AttendanceSession.find({
      studentId: studentProfileId,
      checkInAt: { $gte: startOfMonth, $lte: endOfMonth },
      status: AttendanceStatus.COMPLETED,
    })
      .sort({ checkInAt: 1 })
      .lean();

    let totalMinutes = 0;
    const dailyMap: Record<string, number> = {};

    sessions.forEach((sess) => {
      const dayKey = new Date(sess.checkInAt).toISOString().slice(0, 10);
      const mins = sess.durationMinutes || 0;
      totalMinutes += mins;
      dailyMap[dayKey] = (dailyMap[dayKey] || 0) + mins;
    });

    const dailyBreakdown = Object.keys(dailyMap).map((date) => ({
      date,
      minutes: dailyMap[date],
      hours: parseFloat((dailyMap[date] / 60).toFixed(2)),
    }));

    return {
      month: targetMonth,
      totalStudyMinutes: totalMinutes,
      totalStudyHours: parseFloat((totalMinutes / 60).toFixed(1)),
      sessionCount: sessions.length,
      dailyBreakdown,
      sessions,
    };
  }

  /**
   * Daily Cron Purge Task:
   * Deletes all completed AttendanceSession records and resolved AttendanceRequests
   * created prior to today's 00:00:00.
   * Keeps DB lightweight by storing ONLY today's logs while preserving aggregated study stats.
   */
  static async purgePastAttendanceLogs(): Promise<{ deletedSessions: number; deletedRequests: number }> {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    try {
      // Delete past completed attendance sessions (checkInAt < startOfToday)
      const sessionRes = await AttendanceSession.deleteMany({
        status: { $ne: AttendanceStatus.ACTIVE },
        checkInAt: { $lt: startOfToday },
      });

      // Delete past resolved attendance requests (createdAt < startOfToday and not PENDING)
      const { AttendanceRequest } = require('../models/attendanceRequest.model');
      const requestRes = await AttendanceRequest.deleteMany({
        status: { $ne: 'PENDING' },
        createdAt: { $lt: startOfToday },
      });

      logger.info(
        `[AttendanceLogCleanup] 🧹 Purged past logs prior to ${startOfToday.toISOString()}. Sessions purged: ${
          sessionRes.deletedCount || 0
        }, Requests purged: ${requestRes.deletedCount || 0}`
      );

      return {
        deletedSessions: sessionRes.deletedCount || 0,
        deletedRequests: requestRes.deletedCount || 0,
      };
    } catch (err: any) {
      logger.error(`[AttendanceLogCleanup] ❌ Error purging past attendance logs: ${err.message}`);
      return { deletedSessions: 0, deletedRequests: 0 };
    }
  }

  static async getActiveLogs(libraryId: string, dateStr?: string) {
    const targetDate = dateStr ? new Date(dateStr) : new Date();
    const startOfTargetDate = new Date(targetDate);
    startOfTargetDate.setHours(0, 0, 0, 0);

    const endOfTargetDate = new Date(targetDate);
    endOfTargetDate.setHours(23, 59, 59, 999);

    const activeSessions = await AttendanceSession.find({
      libraryId,
      status: AttendanceStatus.ACTIVE,
      checkInAt: { $lte: endOfTargetDate },
    })
      .populate({
        path: 'studentId',
        select: 'studentIdCardNo profilePicture currentSeatId userId',
        populate: [
          { path: 'userId', select: 'fullName phone email' },
          { path: 'currentSeatId', select: 'seatNumber floor' },
        ],
      })
      .sort({ checkInAt: -1 })
      .lean();

    const recentHistory = await AttendanceSession.find({
      libraryId,
      status: AttendanceStatus.COMPLETED,
      checkInAt: { $gte: startOfTargetDate, $lte: endOfTargetDate },
    })
      .populate({
        path: 'studentId',
        select: 'studentIdCardNo profilePicture currentSeatId userId',
        populate: [
          { path: 'userId', select: 'fullName phone' },
          { path: 'currentSeatId', select: 'seatNumber floor' },
        ],
      })
      .sort({ checkOutAt: -1 })
      .limit(100)
      .lean();

    const { storageService } = require('../config/storage');

    const formatSession = (s: any) => ({
      ...s,
      studentId: s.studentId
        ? {
            ...s.studentId,
            profilePictureUrl: s.studentId?.profilePicture ? storageService.getFileUrl(s.studentId.profilePicture) : null,
          }
        : null,
    });

    return {
      activeCount: activeSessions.length,
      activeSessions: activeSessions.map(formatSession),
      recentHistory: recentHistory.map(formatSession),
    };
  }

  static async forceCheckoutSession(libraryId: string, sessionId: string) {
    const session = await AttendanceSession.findOne({
      _id: sessionId,
      libraryId,
      status: AttendanceStatus.ACTIVE,
    });

    if (!session) {
      throw new NotFoundError('Active attendance session not found');
    }

    const now = new Date();
    const checkInTime = new Date(session.checkInAt).getTime();
    const checkOutTime = now.getTime();
    const durationMinutes = Math.max(1, Math.round((checkOutTime - checkInTime) / (1000 * 60)));

    session.checkOutAt = now;
    session.durationMinutes = durationMinutes;
    session.status = AttendanceStatus.COMPLETED;
    await session.save();

    const studentProfile = await StudentProfile.findById(session.studentId);
    if (studentProfile) {
      const currentMonthStr = now.toISOString().slice(0, 7);
      if (studentProfile.monthlyStats?.lastCalculatedMonth === currentMonthStr) {
        studentProfile.monthlyStats.totalStudyMinutes += durationMinutes;
      } else {
        studentProfile.monthlyStats = {
          totalStudyMinutes: durationMinutes,
          lastCalculatedMonth: currentMonthStr,
        };
      }
      await studentProfile.save();
    }

    return { session, message: 'Student forced checked out successfully.' };
  }

  static parseDecimalHours(tStr?: string): number {
    if (!tStr) return 0;
    const str = tStr.trim().toUpperCase();
    if (str.includes('MIDNIGHT')) return 24;
    const isPM = str.includes('PM');
    const isAM = str.includes('AM');
    const clean = str.replace(/(AM|PM|MIDNIGHT)/g, '').trim();
    const parts = clean.split(':').map(Number);
    let h = parts[0] || 0;
    const m = parts[1] || 0;
    if (isPM && h < 12) h += 12;
    if (isAM && h === 12) h = 0;
    return h + (m / 60);
  }

  static formatShiftLabel(rawTime: string): string {
    if (!rawTime) return '';
    const str = rawTime.trim().toUpperCase();
    if (str.includes('MIDNIGHT')) return '12:00 Midnight';
    if (str.includes('AM') || str.includes('PM')) return rawTime.trim();

    const dec = AttendanceService.parseDecimalHours(rawTime);
    if (dec === 24 || dec === 0) return '12:00 Midnight';
    let h = Math.floor(dec);
    const m = Math.round((dec - h) * 60);
    const ampm = h >= 12 ? 'PM' : 'AM';
    let h12 = h % 12;
    if (h12 === 0) h12 = 12;
    const mStr = m > 0 ? `:${String(m).padStart(2, '0')}` : '';
    return `${h12}${mStr} ${ampm}`;
  }

  static async validateStudentCheckInEligibility(studentProfile: any, checkInDate: Date = new Date()) {
    // 1. Verify Membership Expiration
    const expiryRaw = studentProfile.membershipExpiresAt || studentProfile.toDate;
    if (expiryRaw) {
      const expiryD = new Date(expiryRaw);
      const endOfExpiryDay = new Date(expiryD.getFullYear(), expiryD.getMonth(), expiryD.getDate(), 23, 59, 59, 999);
      if (checkInDate > endOfExpiryDay || studentProfile.membershipStatus === MembershipStatus.EXPIRED) {
        studentProfile.membershipStatus = MembershipStatus.EXPIRED;
        await studentProfile.save().catch(() => {});

        const day = String(expiryD.getDate()).padStart(2, '0');
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const month = monthNames[expiryD.getMonth()];
        const year = expiryD.getFullYear();
        const formattedDate = `${day} ${month} ${year}`;

        throw new AuthorizationError(
          `Check-in failed: Student membership expired on ${formattedDate}. Please extend membership plan before checking in.`,
          'MEMBERSHIP_EXPIRED'
        );
      }
    }

    if (studentProfile.membershipStatus !== MembershipStatus.ACTIVE) {
      throw new AuthorizationError(
        `Check-in failed: Student membership status is ${studentProfile.membershipStatus || 'INACTIVE'}. Only active students can check in.`,
        'MEMBERSHIP_INACTIVE'
      );
    }

    // 2. Verify Shift Hours
    const { fromTime, toTime } = studentProfile;
    if (fromTime && toTime) {
      const startHour = AttendanceService.parseDecimalHours(fromTime);
      let endHour = AttendanceService.parseDecimalHours(toTime);
      if (endHour <= startHour) {
        endHour = 24;
      }

      const currentHour = checkInDate.getHours() + (checkInDate.getMinutes() / 60);

      if (currentHour < startHour || currentHour > endHour) {
        const currentFormatted = AttendanceService.formatShiftLabel(`${checkInDate.getHours()}:${String(checkInDate.getMinutes()).padStart(2, '0')}`);
        const fromFormatted = AttendanceService.formatShiftLabel(fromTime);
        const toFormatted = AttendanceService.formatShiftLabel(toTime);

        throw new AuthorizationError(
          `Check-in failed: Current time (${currentFormatted}) is outside assigned shift hours (${fromFormatted} - ${toFormatted}).`,
          'SHIFT_HOURS_MISMATCH'
        );
      }
    }
  }

  static async directCheckIn(libraryId: string, adminUserId: string, studentProfileId: string) {
    const studentProfile = await StudentProfile.findOne({ _id: studentProfileId, libraryId });
    if (!studentProfile) {
      throw new NotFoundError('Student profile not found');
    }

    const now = new Date();
    await AttendanceService.validateStudentCheckInEligibility(studentProfile, now);

    const activeSession = await AttendanceSession.findOne({
      libraryId,
      studentId: studentProfile._id,
      status: AttendanceStatus.ACTIVE,
    });

    if (activeSession) {
      throw new ValidationError('Student is already checked in.');
    }

    // Resolve any existing PENDING AttendanceRequest for this student
    const { AttendanceRequest } = require('../models/attendanceRequest.model');
    await AttendanceRequest.updateMany(
      { libraryId, studentProfileId: studentProfile._id, status: 'PENDING' },
      { status: 'APPROVED', approvedByAdminId: adminUserId, processedAt: new Date() }
    );

    const sessionNonce = `ADMIN_${studentProfile._id}_${now.getTime()}`;
    const newSession = await AttendanceSession.create({
      libraryId,
      studentId: studentProfile._id,
      checkInAt: now,
      status: AttendanceStatus.ACTIVE,
      checkInNonce: sessionNonce,
    });

    logger.info(`Admin ${adminUserId} directly checked in student ${studentProfile._id} at ${now.toISOString()}`);
    return { session: newSession, message: 'Student checked in successfully!' };
  }

  static async directCheckOut(libraryId: string, adminUserId: string, studentProfileId: string) {
    const activeSession = await AttendanceSession.findOne({
      libraryId,
      studentId: studentProfileId,
      status: AttendanceStatus.ACTIVE,
    });

    if (!activeSession) {
      throw new ValidationError('Student is not currently checked in.');
    }

    const now = new Date();
    const checkInTime = new Date(activeSession.checkInAt).getTime();
    const checkOutTime = now.getTime();
    const durationMinutes = Math.max(1, Math.round((checkOutTime - checkInTime) / (1000 * 60)));

    activeSession.checkOutAt = now;
    activeSession.durationMinutes = durationMinutes;
    activeSession.status = AttendanceStatus.COMPLETED;
    await activeSession.save();

    const studentProfile = await StudentProfile.findById(studentProfileId);
    if (studentProfile) {
      const currentMonthStr = now.toISOString().slice(0, 7);
      if (studentProfile.monthlyStats?.lastCalculatedMonth === currentMonthStr) {
        studentProfile.monthlyStats.totalStudyMinutes += durationMinutes;
      } else {
        studentProfile.monthlyStats = {
          totalStudyMinutes: durationMinutes,
          lastCalculatedMonth: currentMonthStr,
        };
      }
      await studentProfile.save();
    }

    logger.info(`Admin ${adminUserId} directly checked out student ${studentProfileId}. Duration: ${durationMinutes} mins`);
    return { session: activeSession, message: `Student checked out successfully! Session duration: ${Math.floor(durationMinutes / 60)}h ${durationMinutes % 60}m` };
  }
}
