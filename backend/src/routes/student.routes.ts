import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { requireRole } from '../middlewares/rbac.middleware';
import { requireLibraryAccess, requireFeature } from '../middlewares/tenantIsolation.middleware';
import { StudentProfile } from '../models/studentProfile.model';
import { Library } from '../models/library.model';
import { AttendanceSession } from '../models/attendanceSession.model';
import { UserRole } from '../constants/roles';
import { ApiResponse } from '../utils/apiResponse';
import { AttendanceStatus } from '../constants/statusEnums';

import { AttendanceService } from '../services/attendance.service';

const router = Router();

router.use(authenticate, requireRole(UserRole.STUDENT), requireLibraryAccess);

router.get('/dashboard', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const studentProfileId = req.user?.studentProfileId;
    const libraryId = req.user?.libraryId;

    if (!studentProfileId || !libraryId) {
      return ApiResponse.error(res, 'Student context required', 400);
    }

    const studentProfile = await StudentProfile.findById(studentProfileId)
      .populate('currentSeatId', 'seatNumber floor priceMonthly')
      .populate('currentLockerId', 'lockerNumber priceMonthly')
      .lean();

    const library = await Library.findById(libraryId)
      .select('name code status openingTime closingTime announcement featureFlags upiId upiQrUrl paymentInstructions')
      .lean();

    // Fetch Current Attendance State (ACTIVE, PENDING, REJECTED, or NO_ACTIVE_REQUEST)
    const currentAttendanceState: any = await AttendanceService.getCurrentSession(studentProfileId);
    const activeSession = currentAttendanceState?.activeSession || null;
    const pendingRequest = currentAttendanceState?.pendingRequest || null;
    const rejectedRequest = currentAttendanceState?.rejectedRequest || null;

    // Fetch Most Recent Completed Session
    const lastSession = await AttendanceSession.findOne({
      studentId: studentProfileId,
      status: AttendanceStatus.COMPLETED,
    })
      .sort({ checkOutAt: -1 })
      .select('checkOutAt durationMinutes isAutoCheckedOut')
      .lean();

    // Fetch Today's Total Study Minutes
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const todaySessions = await AttendanceSession.find({
      studentId: studentProfileId,
      checkInAt: { $gte: startOfToday },
    }).lean();

    let todayMinutes = 0;
    const now = new Date().getTime();

    for (const session of todaySessions) {
      if (session.status === AttendanceStatus.COMPLETED && session.durationMinutes) {
        todayMinutes += session.durationMinutes;
      } else if (session.status === AttendanceStatus.ACTIVE) {
        const liveMinutes = Math.max(1, Math.round((now - new Date(session.checkInAt).getTime()) / (1000 * 60)));
        todayMinutes += liveMinutes;
      }
    }

    // Fetch Current Month's Total Study Minutes
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const monthSessions = await AttendanceSession.find({
      studentId: studentProfileId,
      checkInAt: { $gte: startOfMonth },
    }).lean();

    let monthlyTotalMinutes = 0;

    for (const session of monthSessions) {
      if (session.status === AttendanceStatus.COMPLETED && session.durationMinutes) {
        monthlyTotalMinutes += session.durationMinutes;
      } else if (session.status === AttendanceStatus.ACTIVE) {
        const liveMinutes = Math.max(1, Math.round((now - new Date(session.checkInAt).getTime()) / (1000 * 60)));
        monthlyTotalMinutes += liveMinutes;
      }
    }

    // Fetch Active Notifications for Student
    const { Notification } = require('../models/notification.model');
    const nowObj = new Date();
    const activeNotifications = await Notification.find({
      libraryId,
      status: 'ACTIVE',
      expiresAt: { $gt: nowObj },
      $or: [
        { type: 'BROADCAST' },
        { recipientStudentIds: studentProfileId },
        { recipientStudentId: studentProfileId },
      ],
    })
      .sort({ createdAt: -1 })
      .lean();

    return ApiResponse.success(
      res,
      {
        library,
        student: {
          studentIdCardNo: studentProfile?.studentIdCardNo,
          membershipStatus: studentProfile?.membershipStatus,
          membershipExpiresAt: studentProfile?.membershipExpiresAt,
          currentSeat: studentProfile?.currentSeatId,
          currentLocker: studentProfile?.currentLockerId,
          referralCode: studentProfile?.referralCode,
        },
        stats: {
          activeSession,
          pendingRequest,
          rejectedRequest,
          currentAttendanceState,
          lastSession,
          todayMinutes,
          monthlyTotalMinutes,
        },
        activeNotifications: activeNotifications || [],
      },
      'Dashboard data loaded successfully'
    );
  } catch (error) {
    next(error);
  }
});

router.get('/referrals', requireFeature('enableReferrals'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const studentProfileId = req.user?.studentProfileId;
    const libraryId = req.user?.libraryId;

    if (!studentProfileId || !libraryId) {
      return ApiResponse.error(res, 'Student context required', 400);
    }

    const { Referral } = require('../models/referral.model');
    const studentProfile = await StudentProfile.findById(studentProfileId);

    const referrals = await Referral.find({ referrerStudentId: studentProfileId })
      .populate('referredUserId', 'fullName phone createdAt')
      .lean();

    const totalReward = referrals.reduce((sum: number, ref: any) => sum + (ref.rewardAmount || 0), 0);

    return ApiResponse.success(
      res,
      {
        referralCode: studentProfile?.referralCode,
        referralCount: referrals.length,
        totalRewardEarned: totalReward,
        referrals,
      },
      'Referral stats fetched'
    );
  } catch (error) {
    next(error);
  }
});

export default router;
