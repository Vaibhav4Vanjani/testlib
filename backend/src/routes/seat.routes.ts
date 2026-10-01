import { Router } from 'express';
import { SeatController } from '../controllers/seat.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireRole } from '../middlewares/rbac.middleware';
import { requireLibraryAccess, requireFeature } from '../middlewares/tenantIsolation.middleware';
import { auditLog } from '../middlewares/auditLogger';
import { UserRole } from '../constants/roles';

const router = Router();

router.use(authenticate, requireLibraryAccess, requireFeature('enableReservedSeats'));

router.get('/', SeatController.getSeats);

router.post(
  '/reserve',
  requireRole(UserRole.STUDENT),
  SeatController.reserveSeat
);

router.patch(
  '/:id/status',
  requireRole(UserRole.LIBRARY_ADMIN, UserRole.SUPER_ADMIN),
  auditLog('UPDATE_SEAT_STATUS', 'SEAT'),
  SeatController.updateSeatStatus
);

export default router;
