import { Router } from 'express';
import { AttendanceController } from '../controllers/attendance.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireRole } from '../middlewares/rbac.middleware';
import { requireLibraryAccess } from '../middlewares/tenantIsolation.middleware';
import { qrScanRateLimiter } from '../middlewares/rateLimiter';
import { UserRole } from '../constants/roles';

const router = Router();

router.use(authenticate);

router.post(
  '/scan-qr',
  requireRole(UserRole.STUDENT),
  requireLibraryAccess,
  qrScanRateLimiter,
  AttendanceController.scanQR
);

router.get(
  '/history',
  requireRole(UserRole.STUDENT),
  requireLibraryAccess,
  AttendanceController.getHistory
);

router.get(
  '/current-session',
  requireRole(UserRole.STUDENT),
  requireLibraryAccess,
  AttendanceController.getCurrentSession
);

router.get(
  '/monthly-report',
  requireRole(UserRole.STUDENT),
  requireLibraryAccess,
  AttendanceController.getMonthlyStudyReport
);

router.get(
  '/active-logs',
  requireRole(UserRole.LIBRARY_ADMIN, UserRole.SUPER_ADMIN),
  requireLibraryAccess,
  AttendanceController.getActiveLogs
);

router.post(
  '/purge-past-logs',
  requireRole(UserRole.LIBRARY_ADMIN, UserRole.SUPER_ADMIN),
  requireLibraryAccess,
  AttendanceController.purgePastLogs
);

router.post(
  '/sessions/:sessionId/checkout',
  requireRole(UserRole.LIBRARY_ADMIN, UserRole.SUPER_ADMIN),
  requireLibraryAccess,
  AttendanceController.forceCheckout
);

router.get(
  '/requests',
  requireRole(UserRole.LIBRARY_ADMIN, UserRole.SUPER_ADMIN),
  requireLibraryAccess,
  AttendanceController.getPendingRequests
);

router.post(
  '/requests/:requestId/approve',
  requireRole(UserRole.LIBRARY_ADMIN, UserRole.SUPER_ADMIN),
  requireLibraryAccess,
  AttendanceController.approveRequest
);

router.post(
  '/requests/:requestId/reject',
  requireRole(UserRole.LIBRARY_ADMIN, UserRole.SUPER_ADMIN),
  requireLibraryAccess,
  AttendanceController.rejectRequest
);

router.post(
  '/direct-checkin',
  requireRole(UserRole.LIBRARY_ADMIN, UserRole.SUPER_ADMIN),
  requireLibraryAccess,
  AttendanceController.directCheckIn
);

router.post(
  '/direct-checkout',
  requireRole(UserRole.LIBRARY_ADMIN, UserRole.SUPER_ADMIN),
  requireLibraryAccess,
  AttendanceController.directCheckOut
);

export default router;
