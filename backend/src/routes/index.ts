import { Router } from 'express';
import authRoutes from './auth.routes';
import healthRoutes from './health.routes';
import attendanceRoutes from './attendance.routes';
import seatRoutes from './seat.routes';
import lockerRoutes from './locker.routes';
import paymentRoutes from './payment.routes';
import adminRoutes from './admin.routes';
import superAdminRoutes from './superAdmin.routes';
import studentRoutes from './student.routes';
import complaintRoutes from './complaint.routes';
import storageRoutes from './storage.routes';

const router = Router();

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/students', studentRoutes);
router.use('/attendance', attendanceRoutes);
router.use('/seats', seatRoutes);
router.use('/lockers', lockerRoutes);
router.use('/payments', paymentRoutes);
router.use('/admin', adminRoutes);
router.use('/super-admin', superAdminRoutes);
router.use('/complaints', complaintRoutes);
router.use('/storage', storageRoutes);

export default router;
