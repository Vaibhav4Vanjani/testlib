import { Router } from 'express';
import multer from 'multer';
import { PaymentController } from '../controllers/payment.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireRole } from '../middlewares/rbac.middleware';
import { requireLibraryAccess } from '../middlewares/tenantIsolation.middleware';
import { auditLog } from '../middlewares/auditLogger';
import { UserRole } from '../constants/roles';

const upload = multer({
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
});

const router = Router();

router.use(authenticate, requireLibraryAccess);

router.get('/plans', PaymentController.getPlans);
router.get('/history', requireRole(UserRole.STUDENT), PaymentController.getHistory);

router.post(
  '/submit-manual',
  requireRole(UserRole.STUDENT),
  upload.any(),
  (req, _res, next) => {
    if (req.files && Array.isArray(req.files) && req.files.length > 0) {
      req.file = req.files[0];
    }
    next();
  },
  PaymentController.submitManualPayment
);

router.get(
  '/pending',
  requireRole(UserRole.LIBRARY_ADMIN, UserRole.SUPER_ADMIN),
  PaymentController.getPendingPayments
);

router.get(
  '/due-payments',
  requireRole(UserRole.LIBRARY_ADMIN, UserRole.SUPER_ADMIN),
  PaymentController.getDuePayments
);

router.post(
  '/send-reminder/:studentId',
  requireRole(UserRole.LIBRARY_ADMIN, UserRole.SUPER_ADMIN),
  auditLog('SEND_PAYMENT_REMINDER', 'NOTIFICATION'),
  PaymentController.sendPaymentReminder
);

router.post(
  '/:id/approve',
  requireRole(UserRole.LIBRARY_ADMIN, UserRole.SUPER_ADMIN),
  auditLog('APPROVE_PAYMENT', 'PAYMENT'),
  PaymentController.approvePayment
);

router.post(
  '/:id/reject',
  requireRole(UserRole.LIBRARY_ADMIN, UserRole.SUPER_ADMIN),
  auditLog('REJECT_PAYMENT', 'PAYMENT'),
  PaymentController.rejectPayment
);

export default router;
