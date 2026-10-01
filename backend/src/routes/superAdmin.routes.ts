import { Router } from 'express';
import { SuperAdminController } from '../controllers/superAdmin.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireRole } from '../middlewares/rbac.middleware';
import { auditLog } from '../middlewares/auditLogger';
import { UserRole } from '../constants/roles';

const router = Router();

router.use(authenticate, requireRole(UserRole.SUPER_ADMIN));

router.get('/overview', SuperAdminController.getPlatformOverview);
router.get('/libraries/summary', SuperAdminController.getLibrariesSummary);
router.get('/earnings', SuperAdminController.getPlatformEarnings);
router.get('/next-code', SuperAdminController.getNextLibraryCode);
router.post('/broadcast-notification', auditLog('SUPER_ADMIN_BROADCAST', 'NOTIFICATION'), SuperAdminController.broadcastNotification);
router.get('/notifications', SuperAdminController.getNotifications);
router.patch('/notifications/:notificationId/hide', auditLog('HIDE_NOTIFICATION', 'NOTIFICATION'), SuperAdminController.hideNotification);
router.patch('/libraries/:id/features', auditLog('UPDATE_FEATURE_FLAGS', 'LIBRARY'), SuperAdminController.updateFeatureFlags);
router.patch('/libraries/:libraryId/admin-status', auditLog('UPDATE_LOCAL_ADMIN_STATUS', 'USER'), SuperAdminController.updateLocalAdminStatus);
router.patch('/libraries/:libraryId/admin-details', auditLog('UPDATE_LOCAL_ADMIN_DETAILS', 'USER'), SuperAdminController.updateLocalAdminDetails);

router.get('/saas-payments', SuperAdminController.getSaaSPayments);
router.patch('/saas-payments/:paymentId/approve', auditLog('APPROVE_SAAS_PAYMENT', 'PAYMENT'), SuperAdminController.approveSaaSPayment);
router.patch('/saas-payments/:paymentId/reject', auditLog('REJECT_SAAS_PAYMENT', 'PAYMENT'), SuperAdminController.rejectSaaSPayment);

router.post(
  '/libraries',
  auditLog('CREATE_LIBRARY_TENANT', 'LIBRARY'),
  SuperAdminController.createLibraryTenant
);

export default router;
