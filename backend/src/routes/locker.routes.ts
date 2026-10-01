import { Router } from 'express';
import { LockerController } from '../controllers/locker.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireRole } from '../middlewares/rbac.middleware';
import { requireLibraryAccess, requireFeature } from '../middlewares/tenantIsolation.middleware';
import { UserRole } from '../constants/roles';

const router = Router();

router.use(authenticate, requireLibraryAccess, requireFeature('enableLockers'));

router.get('/', LockerController.getLockers);
router.post('/reserve', requireRole(UserRole.STUDENT), LockerController.reserveLocker);

export default router;
