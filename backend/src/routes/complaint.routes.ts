import { Router } from 'express';
import { ComplaintController } from '../controllers/complaint.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireRole } from '../middlewares/rbac.middleware';
import { UserRole } from '../constants/roles';

const router = Router();

router.use(authenticate);

// Student routes
router.post('/', requireRole(UserRole.STUDENT), ComplaintController.createComplaint);
router.get('/my-complaints', requireRole(UserRole.STUDENT), ComplaintController.getStudentComplaints);

// Admin routes
router.get('/library-complaints', requireRole(UserRole.LIBRARY_ADMIN, UserRole.SUPER_ADMIN), ComplaintController.getLibraryComplaints);
router.patch('/:id/status', requireRole(UserRole.LIBRARY_ADMIN, UserRole.SUPER_ADMIN), ComplaintController.updateStatus);

export default router;
