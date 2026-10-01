import { Router } from 'express';
import { AdminController } from '../controllers/admin.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireRole } from '../middlewares/rbac.middleware';
import { requireLibraryAccess, requireFeature } from '../middlewares/tenantIsolation.middleware';
import { auditLog } from '../middlewares/auditLogger';
import { UserRole } from '../constants/roles';

import { uploadProfilePicture, uploadProofImage } from '../middlewares/upload.middleware';

const router = Router();

router.use(authenticate, requireRole(UserRole.LIBRARY_ADMIN, UserRole.SUPER_ADMIN), requireLibraryAccess);

router.get('/dashboard-metrics', AdminController.getDashboardMetrics);
router.get('/students', AdminController.searchStudents);
router.patch('/students/:studentProfileId/status', auditLog('UPDATE_STUDENT_STATUS', 'STUDENT'), AdminController.updateStudentStatus);
router.put('/students/:studentProfileId', uploadProfilePicture.single('profilePicture'), auditLog('UPDATE_STUDENT_PROFILE', 'STUDENT'), AdminController.updateStudentProfile);
router.post('/students/:studentProfileId/extend', auditLog('EXTEND_STUDENT_MEMBERSHIP', 'STUDENT'), AdminController.extendStudentMembership);
router.get('/enrollment-options', AdminController.getEnrollmentOptions);
router.get('/validate-referral', requireFeature('enableReferrals'), AdminController.validateReferralCode);
router.post('/enroll-student', uploadProfilePicture.single('profilePicture'), auditLog('ENROLL_STUDENT', 'STUDENT'), AdminController.enrollStudent);
router.get('/earnings', AdminController.getEarnings);
router.get('/payment-master', AdminController.getPaymentMaster);
router.put('/payment-master', auditLog('UPDATE_PAYMENT_MASTER', 'PAYMENT_MASTER'), AdminController.updatePaymentMaster);
router.post('/payment-master', auditLog('UPDATE_PAYMENT_MASTER', 'PAYMENT_MASTER'), AdminController.updatePaymentMaster);
router.post('/send-notification', auditLog('SEND_NOTIFICATION', 'NOTIFICATION'), AdminController.sendNotification);
router.get('/notifications', AdminController.getSentNotifications);
router.patch('/notifications/:notificationId/hide', auditLog('HIDE_NOTIFICATION', 'NOTIFICATION'), AdminController.hideNotification);
router.post('/refer-student', requireFeature('enableReferrals'), auditLog('REFER_STUDENT', 'STUDENT'), AdminController.referToOtherLibrary);
router.get('/entry-exit-logs', AdminController.getEntryExitLogs);
router.get('/qr-code', AdminController.getQRPayload);
router.patch('/announcement', auditLog('UPDATE_ANNOUNCEMENT', 'LIBRARY'), AdminController.updateAnnouncement);
router.post('/payment-plan', auditLog('UPDATE_PAYMENT_MASTER', 'PAYMENT_PLAN'), AdminController.updatePaymentPlan);
router.get('/seat-master', requireFeature('enableReservedSeats'), AdminController.getSeatsMaster);
router.post('/seat-master', requireFeature('enableReservedSeats'), auditLog('MANAGE_SEAT_MASTER', 'SEAT'), AdminController.manageSeatMaster);
router.get('/locker-master', requireFeature('enableLockers'), AdminController.getLockersMaster);
router.post('/locker-master', requireFeature('enableLockers'), auditLog('MANAGE_LOCKER_MASTER', 'LOCKER'), AdminController.manageLockerMaster);
router.post('/trigger-auto-checkout', auditLog('TRIGGER_AUTO_CHECKOUT', 'ATTENDANCE'), AdminController.triggerAutoCheckout);
router.get('/saas-payment', AdminController.getSaaSPaymentDetails);
router.post('/saas-payment', uploadProofImage.single('proofImage'), auditLog('SUBMIT_SAAS_PAYMENT', 'PAYMENT'), AdminController.submitSaaSPayment);
router.post('/seed-overdue-student', AdminController.seedOverdueTestStudent);

export default router;
