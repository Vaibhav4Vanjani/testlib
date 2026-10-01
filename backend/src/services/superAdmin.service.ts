import { Library } from '../models/library.model';
import { User } from '../models/user.model';
import { StudentProfile } from '../models/studentProfile.model';
import { AdminProfile } from '../models/adminProfile.model';
import { Payment } from '../models/payment.model';
import { PaymentPlan } from '../models/paymentPlan.model';
import { Seat } from '../models/seat.model';
import { Locker } from '../models/locker.model';
import { UserRole } from '../constants/roles';
import { PaymentStatus, LibraryStatus, MembershipStatus } from '../constants/statusEnums';
import { CryptoUtils } from '../utils/crypto';
import { NotFoundError, ConflictError } from '../utils/customErrors';

export class SuperAdminService {
  static async getPlatformOverview(): Promise<any> {
    const totalLibraries = await Library.countDocuments({});
    const activeLibraries = await Library.countDocuments({ isActive: true });
    const inactiveLibraries = await Library.countDocuments({ isActive: false });
    const totalStudents = await StudentProfile.countDocuments({ membershipStatus: MembershipStatus.ACTIVE });
    const totalAdmins = await User.countDocuments({ role: UserRole.LIBRARY_ADMIN });

    const pendingPaymentsCount = await Payment.countDocuments({ status: PaymentStatus.PENDING });
    const { SaaSPayment } = require('../models/saasPayment.model');
    const pendingSaaSPayments = await SaaSPayment.countDocuments({ status: 'PENDING' });

    const totalRevenueAgg = await Payment.aggregate([
      { $match: { status: PaymentStatus.APPROVED } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);

    const saasRevenueAgg = await SaaSPayment.aggregate([
      { $match: { status: 'APPROVED' } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);

    const libraries = await Library.find({}).sort({ createdAt: -1 }).lean();

    const libraryDetails = await Promise.all(
      libraries.map(async (lib) => {
        const studentCount = await StudentProfile.countDocuments({ libraryId: lib._id });
        const activeSeats = await Seat.countDocuments({ libraryId: lib._id, isDeleted: false });
        return {
          ...lib,
          studentCount,
          activeSeats,
        };
      })
    );

    return {
      totalLibraries,
      activeLibraries,
      inactiveLibraries,
      totalStudents,
      totalAdmins,
      pendingPaymentsCount,
      pendingSaaSPayments,
      totalPlatformRevenue: totalRevenueAgg[0]?.total || 0,
      totalSaasRevenue: saasRevenueAgg[0]?.total || 0,
      libraries: libraryDetails,
    };
  }

  static async getNextLibraryCode(prefix = 'LIB'): Promise<string> {
    const raw = (prefix || 'LIB').trim().toUpperCase();
    const prefixMatch = raw.match(/^([A-Z0-9]+)/i);
    const cleanPrefix = prefixMatch ? prefixMatch[1].toUpperCase() : 'LIB';
    const regex = new RegExp(`^${cleanPrefix}-(\\d+)$`, 'i');

    const libraries = await Library.find({ code: { $regex: `^${cleanPrefix}-`, $options: 'i' } })
      .select('code')
      .lean();

    let maxNum = 0;
    for (const lib of libraries) {
      const match = lib.code.match(regex);
      if (match && match[1]) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    }

    const nextNum = maxNum + 1;
    const padLength = Math.max(3, String(nextNum).length);
    return `${cleanPrefix}-${String(nextNum).padStart(padLength, '0')}`;
  }

  static async createLibraryTenant(payload: {
    name: string;
    code?: string;
    address?: string;
    contactPhone?: string;
    openingTime?: string;
    closingTime?: string;
    adminName: string;
    adminPhone: string;
    adminPassword?: string;
    saasPlanType?: 'MONTHLY' | 'YEARLY';
    saasAmount?: number;
  }): Promise<any> {
    let targetCode = payload.code ? payload.code.trim().toUpperCase() : '';
    if (!targetCode) {
      targetCode = await SuperAdminService.getNextLibraryCode('LIB');
    }

    const existingCode = await Library.findOne({ code: targetCode });
    if (existingCode && payload.code) {
      throw new ConflictError(`Library code '${targetCode}' is already taken.`);
    }

    const existingAdminUser = await User.findOne({ phone: payload.adminPhone.trim() });
    if (existingAdminUser) {
      throw new ConflictError(`Phone number '${payload.adminPhone.trim()}' is already registered.`);
    }

    // Auto-generate secure password if not provided
    const plainPassword = payload.adminPassword && payload.adminPassword.trim()
      ? payload.adminPassword.trim()
      : CryptoUtils.generateNonce().slice(0, 10);

    const passwordHash = await CryptoUtils.hashPassword(plainPassword);

    // Auto-generate email: first.last@libraryname.com
    const cleanAdminName = payload.adminName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, '') || 'admin';
    const cleanLibraryName = payload.name.trim().toLowerCase().replace(/[^a-z0-9]/g, '') || 'library';
    let baseEmail = `${cleanAdminName}@${cleanLibraryName}.com`;
    let email = baseEmail;
    let counter = 1;

    while (await User.findOne({ email })) {
      email = `${cleanAdminName}${counter}@${cleanLibraryName}.com`;
      counter++;
    }

    const planType = payload.saasPlanType || 'MONTHLY';
    const saasAmt = payload.saasAmount && payload.saasAmount > 0
      ? payload.saasAmount
      : (planType === 'YEARLY' ? 12000 : 1200);

    const onboardedDate = new Date();
    // First payment is due on onboarding date
    const firstDueDate = new Date(onboardedDate);

    let library;
    let retries = 3;
    while (retries > 0) {
      try {
        const qrSecretKey = `qr_secret_${targetCode.toLowerCase()}_${Date.now()}`;
        library = await Library.create({
          name: payload.name.trim(),
          code: targetCode,
          address: payload.address?.trim(),
          contactPhone: payload.contactPhone?.trim(),
          openingTime: payload.openingTime || '06:00',
          closingTime: payload.closingTime || '23:00',
          qrSecretKey,
          status: LibraryStatus.OPEN,
          saasPlanType: planType,
          saasAmount: saasAmt,
          saasOnboardedAt: onboardedDate,
          saasNextDueDate: firstDueDate,
          saasPaymentStatus: 'UP_TO_DATE',
        });
        break;
      } catch (err: any) {
        if (err.code === 11000 && !payload.code) {
          targetCode = await SuperAdminService.getNextLibraryCode('LIB');
          retries--;
        } else {
          throw err;
        }
      }
    }

    if (!library) {
      throw new ConflictError('Failed to generate a unique library code. Please try again.');
    }

    // 2. Create Library Admin User
    const adminUser = await User.create({
      fullName: payload.adminName.trim(),
      phone: payload.adminPhone.trim(),
      email,
      passwordHash,
      role: UserRole.LIBRARY_ADMIN,
    });

    await AdminProfile.create({
      userId: adminUser._id,
      libraryId: library._id,
      designation: 'Library Manager',
    });

    // 3. Create Default Payment Plan for Library
    await PaymentPlan.create({
      libraryId: library._id,
      name: 'Standard Monthly Membership',
      monthlyFee: 1500,
      yearlyFee: 15000,
      seatPriceMonthly: 500,
      lockerPriceMonthly: 200,
    });

    // 4. Create Initial 10 Seats and 5 Lockers for the new library
    const seatDocs = [];
    for (let i = 1; i <= 10; i++) {
      seatDocs.push({
        libraryId: library._id,
        seatNumber: `A-${i < 10 ? '0' + i : i}`,
        floor: 1,
        priceMonthly: 500,
      });
    }
    await Seat.insertMany(seatDocs);

    const lockerDocs = [];
    for (let i = 1; i <= 5; i++) {
      lockerDocs.push({
        libraryId: library._id,
        lockerNumber: `L-0${i}`,
        priceMonthly: 200,
      });
    }
    await Locker.insertMany(lockerDocs);

    return {
      library: {
        id: library._id,
        name: library.name,
        code: library.code,
        address: library.address || 'N/A',
        contactPhone: library.contactPhone || 'N/A',
        saasPlanType: library.saasPlanType,
        saasAmount: library.saasAmount,
        saasNextDueDate: library.saasNextDueDate,
      },
      adminUser: {
        id: adminUser._id,
        fullName: adminUser.fullName,
        phone: adminUser.phone,
        email: adminUser.email,
        role: adminUser.role,
      },
      credentials: {
        libraryName: library.name,
        libraryCode: library.code,
        address: library.address || 'N/A',
        contactPhone: library.contactPhone || 'N/A',
        adminName: adminUser.fullName,
        phone: adminUser.phone,
        email: adminUser.email,
        password: plainPassword,
      },
    };
  }

  static async getLibrariesSummary(): Promise<any> {
    const { PaymentMaster } = require('../models/paymentMaster.model');
    const { SaaSPayment } = require('../models/saasPayment.model');
    const libraries = await Library.find({}).sort({ createdAt: -1 }).lean();
    const now = new Date();

    const summaryList = await Promise.all(
      libraries.map(async (lib: any) => {
        const adminProfile = await AdminProfile.findOne({ libraryId: lib._id }).populate('userId', '_id fullName phone isActive');
        const adminUser: any = adminProfile?.userId;
        const activeStudentCount = await StudentProfile.countDocuments({ libraryId: lib._id, membershipStatus: 'ACTIVE' });
        const totalStudentCount = await StudentProfile.countDocuments({ libraryId: lib._id });

        // Platform Revenue Received: Approved SaaS subscription payments received from Local Admin to Super Admin
        const saasReceivedAgg = await SaaSPayment.aggregate([
          { $match: { libraryId: lib._id, status: 'APPROVED' } },
          { $group: { _id: null, total: { $sum: '$amount' } } },
        ]);

        // Pending SaaS Payment Submissions from Local Admin
        const saasPendingAgg = await SaaSPayment.aggregate([
          { $match: { libraryId: lib._id, status: 'PENDING' } },
          { $group: { _id: null, total: { $sum: '$amount' } } },
        ]);

        const paymentMaster = await PaymentMaster.findOne({ libraryId: lib._id }).lean();
        const monthlyReceivable = lib.saasAmount || paymentMaster?.monthlyFee || 1200;
        const yearlyReceivable = lib.saasPlanType === 'YEARLY'
          ? (lib.saasAmount || 12000)
          : (paymentMaster?.annualFee || monthlyReceivable * 10);

        let saasStatus = lib.saasPaymentStatus || 'UP_TO_DATE';
        if (lib.saasNextDueDate && new Date(lib.saasNextDueDate) < now && saasStatus !== 'PENDING_APPROVAL') {
          saasStatus = 'OVERDUE_DEFAULTER';
        }

        const paymentsReceived = saasReceivedAgg[0]?.total || 0;
        let paymentsPending = saasPendingAgg[0]?.total || 0;

        // If overdue defaulter and no pending submission is currently awaiting review, count full saasAmount as pending receivable
        if (paymentsPending === 0 && saasStatus === 'OVERDUE_DEFAULTER') {
          paymentsPending = lib.saasAmount || monthlyReceivable;
        }

        const isFullyActive = Boolean(lib.isActive !== false && adminUser?.isActive !== false);

        return {
          libraryId: lib._id,
          name: lib.name,
          code: lib.code,
          adminUserId: adminUser?._id || null,
          adminName: adminUser?.fullName || 'N/A',
          adminPhone: adminUser?.phone || lib.contactPhone || 'N/A',
          adminIsActive: isFullyActive,
          saasPlanType: lib.saasPlanType || 'MONTHLY',
          saasAmount: lib.saasAmount || monthlyReceivable,
          saasNextDueDate: lib.saasNextDueDate || lib.createdAt,
          saasPaymentStatus: saasStatus,
          monthlyReceivable,
          yearlyReceivable,
          activeStudentCount,
          totalStudentCount,
          paymentsReceived,
          paymentsPending,
          featureFlags: lib.featureFlags || {
            enableLockers: true,
            enableReferrals: true,
            enableQRAttendance: true,
            enableManualPayment: true,
          },
          status: lib.status,
          createdAt: lib.createdAt,
        };
      })
    );

    return summaryList;
  }

  static async updateLocalAdminStatus(libraryId: string, isActive: boolean): Promise<any> {
    const library = await Library.findById(libraryId);
    if (!library) throw new NotFoundError('Library not found');

    library.isActive = isActive;
    await library.save();

    const adminProfile = await AdminProfile.findOne({ libraryId: library._id });
    if (adminProfile?.userId) {
      await User.findByIdAndUpdate(adminProfile.userId, { isActive });
    }

    return {
      message: `Local Admin status set to ${isActive ? 'ACTIVE' : 'INACTIVE'} successfully.`,
      libraryId: library._id,
      isActive,
    };
  }

  static async getPlatformEarnings(): Promise<any> {
    const { SaaSPayment } = require('../models/saasPayment.model');
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Total Platform Monthly Earnings: Approved SaaS payments from Local Admins in current month
    const totalMonthlyAgg = await SaaSPayment.aggregate([
      {
        $match: {
          status: 'APPROVED',
          $or: [
            { reviewedAt: { $gte: startOfMonth } },
            { createdAt: { $gte: startOfMonth } },
          ],
        },
      },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);

    let totalEarnings = totalMonthlyAgg[0]?.total || 0;

    // Fallback: If no approved payments in current calendar month, total overall approved SaaS payments
    if (totalEarnings === 0) {
      const overallAgg = await SaaSPayment.aggregate([
        { $match: { status: 'APPROVED' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]);
      totalEarnings = overallAgg[0]?.total || 0;
    }

    // Per Library SaaS Revenue Breakdown
    const perLibraryMonthlyAgg = await SaaSPayment.aggregate([
      { $match: { status: 'APPROVED' } },
      { $group: { _id: '$libraryId', total: { $sum: '$amount' } } },
      {
        $lookup: {
          from: 'libraries',
          localField: '_id',
          foreignField: '_id',
          as: 'library',
        },
      },
      { $unwind: '$library' },
      {
        $project: {
          libraryId: '$_id',
          libraryName: '$library.name',
          libraryCode: '$library.code',
          total: 1,
        },
      },
    ]);

    return {
      month: now.toISOString().slice(0, 7),
      totalMonthlyEarnings: totalEarnings,
      perLibraryEarnings: perLibraryMonthlyAgg,
    };
  }

  static async broadcastNotification(targetLibraryId: string | 'ALL', title: string, body: string): Promise<any> {
    const { Notification } = require('../models/notification.model');
    const defaultExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    if (targetLibraryId === 'ALL') {
      const libraries = await Library.find({ isActive: true });
      const notifs = await Promise.all(
        libraries.map((lib) =>
          Notification.create({
            libraryId: lib._id,
            title,
            body,
            type: 'SUPER_ADMIN_BROADCAST',
            expiresAt: defaultExpiry,
            status: 'ACTIVE',
          })
        )
      );
      return { count: notifs.length, message: 'Broadcast sent to all local libraries' };
    } else {
      const notif = await Notification.create({
        libraryId: targetLibraryId,
        title,
        body,
        type: 'SUPER_ADMIN_ANNOUNCEMENT',
        expiresAt: defaultExpiry,
        status: 'ACTIVE',
      });
      return notif;
    }
  }

  static async getNotifications(): Promise<any> {
    const { Notification } = require('../models/notification.model');
    const notifs = await Notification.find({
      type: { $in: ['SUPER_ADMIN_BROADCAST', 'SUPER_ADMIN_ANNOUNCEMENT'] },
    })
      .populate('libraryId', 'name code')
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    const now = new Date();
    return notifs.map((n: any) => {
      let computedStatus = n.status;
      if (n.status === 'ACTIVE' && new Date(n.expiresAt) <= now) {
        computedStatus = 'EXPIRED';
      }
      return {
        ...n,
        status: computedStatus,
      };
    });
  }

  static async hideNotification(notificationId: string): Promise<any> {
    const { Notification } = require('../models/notification.model');
    const notif = await Notification.findById(notificationId);
    if (!notif) throw new NotFoundError('Notification not found');

    notif.status = 'HIDDEN';
    await notif.save();

    return {
      message: 'Notification hidden successfully.',
      notification: notif,
    };
  }

  static async updateFeatureFlags(
    libraryId: string,
    featureFlags: {
      enableLockers: boolean;
      enableReferrals: boolean;
      enableQRAttendance: boolean;
      enableManualPayment: boolean;
    }
  ): Promise<any> {
    const library = await Library.findByIdAndUpdate(
      libraryId,
      { $set: { featureFlags } },
      { new: true }
    );
    if (!library) throw new NotFoundError('Library not found');
    return library;
  }

  static async getSaaSPayments(statusFilter?: string): Promise<any> {
    const { SaaSPayment } = require('../models/saasPayment.model');
    const filter: any = {};
    if (statusFilter && statusFilter !== 'ALL') {
      filter.status = statusFilter;
    }

    const payments = await SaaSPayment.find(filter)
      .sort({ createdAt: -1 })
      .populate('libraryId', 'name code contactPhone saasPlanType saasAmount saasNextDueDate saasPaymentStatus')
      .populate('adminUserId', 'fullName phone email')
      .lean();

    return payments;
  }

  static async approveSaaSPayment(paymentId: string, superAdminUserId: string): Promise<any> {
    const { SaaSPayment } = require('../models/saasPayment.model');
    const payment = await SaaSPayment.findById(paymentId);
    if (!payment) throw new NotFoundError('SaaS payment record not found');
    if (payment.status === 'APPROVED') throw new ConflictError('Payment is already approved');

    payment.status = 'APPROVED';
    payment.reviewedAt = new Date();
    payment.reviewedBy = superAdminUserId as any;
    await payment.save();

    const library = await Library.findById(payment.libraryId);
    if (library) {
      let baseDate = library.saasNextDueDate ? new Date(library.saasNextDueDate) : new Date();

      if (library.saasPlanType === 'YEARLY') {
        baseDate.setFullYear(baseDate.getFullYear() + 1);
      } else {
        baseDate.setMonth(baseDate.getMonth() + 1);
      }

      library.saasNextDueDate = baseDate;
      library.saasPaymentStatus = 'UP_TO_DATE';
      await library.save();
    }

    return {
      message: 'SaaS Payment approved successfully. Subscription extended!',
      payment,
      nextDueDate: library?.saasNextDueDate,
    };
  }

  static async rejectSaaSPayment(paymentId: string, rejectionReason: string, superAdminUserId: string): Promise<any> {
    const { SaaSPayment } = require('../models/saasPayment.model');
    const payment = await SaaSPayment.findById(paymentId);
    if (!payment) throw new NotFoundError('SaaS payment record not found');

    payment.status = 'REJECTED';
    payment.rejectionReason = rejectionReason || 'Payment proof verification failed.';
    payment.reviewedAt = new Date();
    payment.reviewedBy = superAdminUserId as any;
    await payment.save();

    const library = await Library.findById(payment.libraryId);
    if (library) {
      const now = new Date();
      if (library.saasNextDueDate && new Date(library.saasNextDueDate) < now) {
        library.saasPaymentStatus = 'OVERDUE_DEFAULTER';
      } else {
        library.saasPaymentStatus = 'UP_TO_DATE';
      }
      await library.save();
    }

    return {
      message: 'SaaS Payment rejected.',
      payment,
    };
  }

  static async updateLocalAdminDetails(
    libraryId: string,
    payload: {
      adminName?: string;
      adminPhone?: string;
      saasPlanType?: 'MONTHLY' | 'YEARLY';
      saasAmount?: number;
    }
  ): Promise<any> {
    const library = await Library.findById(libraryId);
    if (!library) throw new NotFoundError('Library not found');

    const adminProfile = await AdminProfile.findOne({ libraryId: library._id });
    if (!adminProfile?.userId) {
      throw new NotFoundError('Local Admin profile not found for this library');
    }

    const adminUser = await User.findById(adminProfile.userId);
    if (!adminUser) throw new NotFoundError('Local Admin user not found');

    if (payload.adminPhone && payload.adminPhone.trim() !== adminUser.phone) {
      const cleanPhone = payload.adminPhone.trim();
      const phoneExists = await User.findOne({ phone: cleanPhone, _id: { $ne: adminUser._id } });
      if (phoneExists) {
        throw new ConflictError(`Phone number '${cleanPhone}' is already registered to another user.`);
      }
      adminUser.phone = cleanPhone;
    }

    if (payload.adminName && payload.adminName.trim()) {
      adminUser.fullName = payload.adminName.trim();
    }

    await adminUser.save();

    if (payload.saasPlanType && ['MONTHLY', 'YEARLY'].includes(payload.saasPlanType)) {
      const oldPlan = library.saasPlanType;
      library.saasPlanType = payload.saasPlanType;

      if (oldPlan !== payload.saasPlanType && library.saasNextDueDate) {
        const baseDate = new Date(library.saasOnboardedAt || library.createdAt);
        if (payload.saasPlanType === 'YEARLY') {
          baseDate.setFullYear(baseDate.getFullYear() + 1);
        } else {
          baseDate.setMonth(baseDate.getMonth() + 1);
        }
        library.saasNextDueDate = baseDate;
      }
    }

    if (payload.saasAmount !== undefined && payload.saasAmount >= 0) {
      library.saasAmount = payload.saasAmount;
    }

    await library.save();

    return {
      message: 'Local Admin and plan details updated successfully',
      libraryId: library._id,
      adminName: adminUser.fullName,
      adminPhone: adminUser.phone,
      saasPlanType: library.saasPlanType,
      saasAmount: library.saasAmount,
      saasNextDueDate: library.saasNextDueDate,
    };
  }
}
