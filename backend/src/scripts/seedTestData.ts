import mongoose from 'mongoose';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { User } from '../models/user.model';
import { Library } from '../models/library.model';
import { StudentProfile } from '../models/studentProfile.model';
import { AdminProfile } from '../models/adminProfile.model';
import { Seat } from '../models/seat.model';
import { Locker } from '../models/locker.model';
import { Payment } from '../models/payment.model';
import { SaaSPayment } from '../models/saasPayment.model';
import { AttendanceSession } from '../models/attendanceSession.model';
import { AttendanceRequest } from '../models/attendanceRequest.model';
import { Notification } from '../models/notification.model';
import { PaymentPlan } from '../models/paymentPlan.model';
import { CryptoUtils } from '../utils/crypto';
import { UserRole } from '../constants/roles';
import {
  LibraryStatus,
  MembershipStatus,
  SeatStatus,
  LockerStatus,
  AttendanceStatus,
  PaymentType,
  PaymentMethod,
  PaymentStatus,
} from '../constants/statusEnums';

/**
 * Cleanup function to remove all generated test records cleanly and safely without affecting production data.
 */
export const cleanupTestData = async () => {
  logger.info('🧹 Starting Cleanup of TEST_ data records...');

  // Find all test libraries
  const testLibraries = await Library.find({
    $or: [{ code: /^TEST_LIB/i }, { name: /^TEST_/i }],
  });
  const testLibIds = testLibraries.map((lib) => lib._id);

  // Find all test users
  const testUsers = await User.find({
    $or: [
      { phone: /^99900/ },
      { email: /@testerp\.com$/i },
      { fullName: /^TEST_/i },
    ],
  });
  const testUserIds = testUsers.map((u) => u._id);

  // Delete associated student profiles
  const testStudentProfiles = await StudentProfile.find({
    $or: [
      { libraryId: { $in: testLibIds } },
      { userId: { $in: testUserIds } },
      { studentIdCardNo: /^TEST_/i },
      { referralCode: /^TEST_/i },
    ],
  });
  const testStudentProfileIds = testStudentProfiles.map((sp) => sp._id);

  await StudentProfile.deleteMany({ _id: { $in: testStudentProfileIds } });
  await AdminProfile.deleteMany({
    $or: [{ libraryId: { $in: testLibIds } }, { userId: { $in: testUserIds } }],
  });
  await Seat.deleteMany({
    $or: [{ libraryId: { $in: testLibIds } }, { seatNumber: /^TEST_/i }],
  });
  await Locker.deleteMany({
    $or: [{ libraryId: { $in: testLibIds } }, { lockerNumber: /^TEST_/i }],
  });
  await Payment.deleteMany({
    $or: [
      { libraryId: { $in: testLibIds } },
      { studentId: { $in: testStudentProfileIds } },
      { idempotencyKey: /^TEST_/i },
    ],
  });
  await SaaSPayment.deleteMany({
    $or: [
      { libraryId: { $in: testLibIds } },
      { adminUserId: { $in: testUserIds } },
      { transactionRef: /^TEST_/i },
    ],
  });
  await AttendanceSession.deleteMany({
    $or: [
      { libraryId: { $in: testLibIds } },
      { studentId: { $in: testStudentProfileIds } },
      { checkInNonce: /^TEST_/i },
    ],
  });
  await AttendanceRequest.deleteMany({
    $or: [
      { libraryId: { $in: testLibIds } },
      { studentProfileId: { $in: testStudentProfileIds } },
      { userId: { $in: testUserIds } },
    ],
  });
  await Notification.deleteMany({
    $or: [{ libraryId: { $in: testLibIds } }, { title: /^TEST_/i }],
  });
  await PaymentPlan.deleteMany({
    $or: [{ libraryId: { $in: testLibIds } }, { name: /^TEST_/i }],
  });

  // Finally delete test users and libraries
  await User.deleteMany({ _id: { $in: testUserIds } });
  await Library.deleteMany({ _id: { $in: testLibIds } });

  logger.info('✅ Cleanup complete! Removed all TEST_ records.');
};

export const seedTestData = async () => {
  try {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(env.MONGO_URI);
      logger.info('Connected to MongoDB for Test Data Seeding...');
    }

    // Step 1: Always clean up existing test data first to ensure idempotency
    await cleanupTestData();

    logger.info('🚀 Starting ERP Test Data Seed...');

    const defaultPasswordHash = await CryptoUtils.hashPassword('Password123');
    const now = new Date();

    // Helper functions for relative dates
    const daysAgo = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    const daysAhead = (days: number) => new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

    // Sample Proof Image URLs
    const sampleProofUrlPending = 'https://placehold.co/600x800/png?text=TEST+Payment+Proof+Pending';
    const sampleProofUrlRejected = 'https://placehold.co/600x800/png?text=TEST+Payment+Proof+Rejected';
    const sampleProofUrlApproved = 'https://placehold.co/600x800/png?text=TEST+Payment+Proof+Approved';

    // ==========================================
    // 1. FEATURE VISIBILITY & LIBRARIES CREATION
    // ==========================================

    // Library Alpha: Full Features Enabled
    const libAlpha = await Library.create({
      name: 'TEST_LIB Alpha (All Features Enabled)',
      code: 'TEST_LIB_ALPHA',
      address: '101 Tech Avenue, Sector 1, Test City',
      contactPhone: '9990000001',
      status: LibraryStatus.OPEN,
      openingTime: '06:00',
      closingTime: '23:00',
      announcement: 'TEST_LIB Alpha: High Speed WiFi, AC, Lockers & Reserved Seats available.',
      qrSecretKey: 'test_secret_alpha_key',
      upiId: 'testalpha@upi',
      paymentInstructions: 'Pay via UPI and upload transaction screenshot.',
      featureFlags: {
        enableReservedSeats: true,
        enableLockers: true,
        enableReferrals: true,
        enableQRAttendance: true,
        enableManualPayment: true,
      },
      saasPlanType: 'MONTHLY',
      saasAmount: 1500,
      saasNextDueDate: daysAhead(15),
      saasPaymentStatus: 'UP_TO_DATE',
    });

    // Library Beta: Seat Enabled, Locker Disabled
    const libBeta = await Library.create({
      name: 'TEST_LIB Beta (Seat Enabled, Locker Disabled)',
      code: 'TEST_LIB_BETA',
      address: '202 Knowledge Hub, Sector 2, Test City',
      contactPhone: '9990000002',
      status: LibraryStatus.OPEN,
      openingTime: '06:00',
      closingTime: '23:00',
      announcement: 'TEST_LIB Beta: Only Seats enabled, Lockers disabled.',
      qrSecretKey: 'test_secret_beta_key',
      upiId: 'testbeta@upi',
      featureFlags: {
        enableReservedSeats: true,
        enableLockers: false,
        enableReferrals: true,
        enableQRAttendance: true,
        enableManualPayment: true,
      },
      saasPlanType: 'MONTHLY',
      saasAmount: 1200,
      saasNextDueDate: todayEnd,
      saasPaymentStatus: 'UP_TO_DATE',
    });

    // Library Gamma: Locker Enabled, Seat Disabled, Referral Disabled
    const libGamma = await Library.create({
      name: 'TEST_LIB Gamma (Locker Enabled, Seat Disabled)',
      code: 'TEST_LIB_GAMMA',
      address: '303 Scholar Square, Sector 3, Test City',
      contactPhone: '9990000003',
      status: LibraryStatus.OPEN,
      openingTime: '07:00',
      closingTime: '22:00',
      qrSecretKey: 'test_secret_gamma_key',
      upiId: 'testgamma@upi',
      featureFlags: {
        enableReservedSeats: false,
        enableLockers: true,
        enableReferrals: false,
        enableQRAttendance: true,
        enableManualPayment: true,
      },
      saasPlanType: 'YEARLY',
      saasAmount: 12000,
      saasNextDueDate: daysAhead(180),
      saasPaymentStatus: 'UP_TO_DATE',
    });

    // Library Delta: SaaS Overdue Defaulter
    const libDelta = await Library.create({
      name: 'TEST_LIB Delta (SaaS Overdue Defaulter)',
      code: 'TEST_LIB_DELTA',
      address: '404 Defaulter Lane, Sector 4, Test City',
      contactPhone: '9990000004',
      status: LibraryStatus.OPEN,
      qrSecretKey: 'test_secret_delta_key',
      featureFlags: {
        enableReservedSeats: true,
        enableLockers: true,
        enableReferrals: true,
        enableQRAttendance: true,
        enableManualPayment: true,
      },
      saasPlanType: 'MONTHLY',
      saasAmount: 1500,
      saasNextDueDate: daysAgo(5),
      saasPaymentStatus: 'OVERDUE_DEFAULTER',
    });

    // Library Epsilon: SaaS Pending Approval
    const libEpsilon = await Library.create({
      name: 'TEST_LIB Epsilon (SaaS Pending Approval)',
      code: 'TEST_LIB_EPSILON',
      address: '505 Pending Plaza, Sector 5, Test City',
      contactPhone: '9990000005',
      status: LibraryStatus.OPEN,
      qrSecretKey: 'test_secret_epsilon_key',
      featureFlags: {
        enableReservedSeats: true,
        enableLockers: true,
        enableReferrals: true,
        enableQRAttendance: true,
        enableManualPayment: true,
      },
      saasPlanType: 'YEARLY',
      saasAmount: 14000,
      saasNextDueDate: daysAgo(2),
      saasPaymentStatus: 'PENDING_APPROVAL',
    });

    logger.info('Created 5 Test Libraries representing all feature flag & SaaS status permutations.');

    // Payment Plans for Libraries
    await PaymentPlan.create([
      {
        libraryId: libAlpha._id,
        name: 'TEST_ Standard Monthly Plan',
        monthlyFee: 1500,
        yearlyFee: 15000,
        seatPriceMonthly: 500,
        lockerPriceMonthly: 200,
      },
      {
        libraryId: libBeta._id,
        name: 'TEST_ Seat-Only Plan',
        monthlyFee: 1200,
        yearlyFee: 12000,
        seatPriceMonthly: 400,
        lockerPriceMonthly: 0,
      },
    ]);

    // ==========================================
    // 2. LOCAL ADMIN USERS & SAAS PAYMENTS
    // ==========================================

    // Admin Alpha (Up To Date, Future Due)
    const adminUserAlpha = await User.create({
      fullName: 'TEST_ADMIN Alpha (Up To Date)',
      phone: '9990000101',
      email: 'admin.alpha@testerp.com',
      passwordHash: defaultPasswordHash,
      role: UserRole.LIBRARY_ADMIN,
    });
    await AdminProfile.create({ userId: adminUserAlpha._id, libraryId: libAlpha._id, designation: 'Owner' });

    // SaasPayment Approved for Admin Alpha
    await SaaSPayment.create({
      libraryId: libAlpha._id,
      adminUserId: adminUserAlpha._id,
      planType: 'MONTHLY',
      amount: 1500,
      paymentMethod: 'UPI',
      transactionRef: 'TEST_SAAS_TXN_ALPHA_01',
      proofImage: sampleProofUrlApproved,
      status: 'APPROVED',
      dueDate: daysAgo(15),
      submittedAt: daysAgo(16),
      reviewedAt: daysAgo(15),
    });

    // Admin Beta (Due Today)
    const adminUserBeta = await User.create({
      fullName: 'TEST_ADMIN Beta (Due Today)',
      phone: '9990000102',
      email: 'admin.beta@testerp.com',
      passwordHash: defaultPasswordHash,
      role: UserRole.LIBRARY_ADMIN,
    });
    await AdminProfile.create({ userId: adminUserBeta._id, libraryId: libBeta._id, designation: 'Manager' });

    // Admin Gamma (Yearly Plan, Future Due)
    const adminUserGamma = await User.create({
      fullName: 'TEST_ADMIN Gamma (Yearly Plan)',
      phone: '9990000103',
      email: 'admin.gamma@testerp.com',
      passwordHash: defaultPasswordHash,
      role: UserRole.LIBRARY_ADMIN,
    });
    await AdminProfile.create({ userId: adminUserGamma._id, libraryId: libGamma._id, designation: 'Owner' });

    await SaaSPayment.create({
      libraryId: libGamma._id,
      adminUserId: adminUserGamma._id,
      planType: 'YEARLY',
      amount: 12000,
      paymentMethod: 'BANK_TRANSFER',
      transactionRef: 'TEST_SAAS_TXN_GAMMA_01',
      proofImage: sampleProofUrlApproved,
      status: 'APPROVED',
      dueDate: daysAgo(185),
      submittedAt: daysAgo(186),
      reviewedAt: daysAgo(185),
    });

    // Admin Delta (Overdue Defaulter with Rejected Payment & New Pending Payment)
    const adminUserDelta = await User.create({
      fullName: 'TEST_ADMIN Delta (Overdue Defaulter)',
      phone: '9990000104',
      email: 'admin.delta@testerp.com',
      passwordHash: defaultPasswordHash,
      role: UserRole.LIBRARY_ADMIN,
    });
    await AdminProfile.create({ userId: adminUserDelta._id, libraryId: libDelta._id, designation: 'Manager' });

    // Past rejected SaaS payment with proof
    await SaaSPayment.create({
      libraryId: libDelta._id,
      adminUserId: adminUserDelta._id,
      planType: 'MONTHLY',
      amount: 1500,
      paymentMethod: 'UPI',
      transactionRef: 'TEST_SAAS_TXN_DELTA_REJ',
      proofImage: sampleProofUrlRejected,
      status: 'REJECTED',
      rejectionReason: 'Invalid transaction UTR reference',
      dueDate: daysAgo(5),
      submittedAt: daysAgo(4),
      reviewedAt: daysAgo(3),
    });

    // Admin Epsilon (Pending SaaS Approval with Payment Proof)
    const adminUserEpsilon = await User.create({
      fullName: 'TEST_ADMIN Epsilon (Pending Approval)',
      phone: '9990000105',
      email: 'admin.epsilon@testerp.com',
      passwordHash: defaultPasswordHash,
      role: UserRole.LIBRARY_ADMIN,
    });
    await AdminProfile.create({ userId: adminUserEpsilon._id, libraryId: libEpsilon._id, designation: 'Owner' });

    // Pending SaaS Payment with Proof
    await SaaSPayment.create({
      libraryId: libEpsilon._id,
      adminUserId: adminUserEpsilon._id,
      planType: 'YEARLY',
      amount: 14000,
      paymentMethod: 'UPI',
      transactionRef: 'TEST_SAAS_TXN_EPSILON_PENDING',
      proofImage: sampleProofUrlPending,
      status: 'PENDING',
      dueDate: daysAgo(2),
      submittedAt: daysAgo(1),
    });

    logger.info('Created 5 Local Admin profiles with distinct SaaS payment states.');

    // ==========================================
    // 3. SEATS & LOCKERS PERFORMANCE TEST SEED (100+ SEATS & 50+ LOCKERS)
    // ==========================================

    // Generate 120 Seats in TEST_LIB Alpha (Floors 1, 2, 3)
    const seatDocs = [];
    for (let i = 1; i <= 120; i++) {
      const floor = i <= 50 ? 1 : i <= 100 ? 2 : 3;
      const prefix = floor === 1 ? 'A' : floor === 2 ? 'B' : 'C';
      const numStr = String(i % 50 === 0 ? 50 : i % 50).padStart(3, '0');
      const seatNumber = `TEST_SEAT_${prefix}-${numStr}`;

      seatDocs.push({
        libraryId: libAlpha._id,
        seatNumber,
        floor,
        status: SeatStatus.AVAILABLE,
        isDeleted: false,
      });
    }
    const createdSeats = await Seat.insertMany(seatDocs);
    logger.info(`Generated ${createdSeats.length} test Seats in TEST_LIB Alpha to test 100+ performance.`);

    // Generate 60 Lockers in TEST_LIB Alpha (Floors 1, 2)
    const lockerDocs = [];
    for (let i = 1; i <= 60; i++) {
      const floor = i <= 30 ? 1 : 2;
      const numStr = String(i).padStart(3, '0');
      const lockerNumber = `TEST_LOCKER_L${floor}-${numStr}`;

      lockerDocs.push({
        libraryId: libAlpha._id,
        lockerNumber,
        floor,
        status: LockerStatus.AVAILABLE,
        isDeleted: false,
      });
    }
    const createdLockers = await Locker.insertMany(lockerDocs);
    logger.info(`Generated ${createdLockers.length} test Lockers in TEST_LIB Alpha.`);

    // Also add seats/lockers in Library Beta & Gamma
    await Seat.create([
      { libraryId: libBeta._id, seatNumber: 'TEST_SEAT_BETA_01', floor: 1, status: SeatStatus.AVAILABLE },
      { libraryId: libBeta._id, seatNumber: 'TEST_SEAT_BETA_02', floor: 1, status: SeatStatus.AVAILABLE },
    ]);
    await Locker.create([
      { libraryId: libGamma._id, lockerNumber: 'TEST_LOCKER_GAMMA_01', floor: 1, status: LockerStatus.AVAILABLE },
      { libraryId: libGamma._id, lockerNumber: 'TEST_LOCKER_GAMMA_02', floor: 1, status: LockerStatus.AVAILABLE },
    ]);

    // ==========================================
    // 4. LOCAL STUDENTS & EDGE CASES SEEDING
    // ==========================================

    const studentUsers = [];
    const studentProfiles = [];

    // Helper to build user & student profile
    const buildStudent = async (
      name: string,
      phone: string,
      cardNo: string,
      libraryId: mongoose.Types.ObjectId,
      status: MembershipStatus,
      expiresAt: Date | undefined,
      opts: {
        rejectionCount?: number;
        inactivatedAt?: Date;
        fromTime?: string;
        toTime?: string;
        currentSeatId?: mongoose.Types.ObjectId;
        currentLockerId?: mongoose.Types.ObjectId;
        referralCode?: string;
        userObj?: any;
      } = {}
    ) => {
      let u = opts.userObj;
      if (!u) {
        u = await User.create({
          fullName: `TEST_STUDENT ${name}`,
          phone,
          email: `${cardNo.toLowerCase()}@testerp.com`,
          passwordHash: defaultPasswordHash,
          role: UserRole.STUDENT,
        });
      }
      studentUsers.push(u);

      const profile = await StudentProfile.create({
        userId: u._id,
        libraryId,
        studentIdCardNo: cardNo,
        membershipStatus: status,
        membershipExpiresAt: expiresAt,
        rejectionCount: opts.rejectionCount || 0,
        inactivatedAt: opts.inactivatedAt || null,
        fromTime: opts.fromTime || '06:00',
        toTime: opts.toTime || '23:00',
        currentSeatId: opts.currentSeatId,
        currentLockerId: opts.currentLockerId,
        referralCode: opts.referralCode || `TEST_REF_${cardNo}`,
        fromDate: daysAgo(30),
        toDate: expiresAt,
        monthsCount: 1,
      });

      studentProfiles.push(profile);
      return { u, profile };
    };

    // 1. Active student with pending payment
    const { profile: sp01 } = await buildStudent(
      '01 Pending Payment',
      '9990000201',
      'TEST_CARD_001',
      libAlpha._id,
      MembershipStatus.PENDING_PAYMENT,
      daysAhead(30)
    );
    await Payment.create({
      libraryId: libAlpha._id,
      studentId: sp01._id,
      paymentType: PaymentType.COMBINED,
      paymentMethod: PaymentMethod.UPI,
      amount: 2200,
      status: PaymentStatus.PENDING,
      utrNumber: 'TEST_UTR_PENDING_01',
      proofUrl: sampleProofUrlPending,
      idempotencyKey: 'TEST_IDEMP_001',
      billingCycleStart: now,
      billingCycleEnd: daysAhead(30),
    });

    // 2. Active student with overdue payment
    const { profile: sp02 } = await buildStudent(
      '02 Overdue Payment',
      '9990000202',
      'TEST_CARD_002',
      libAlpha._id,
      MembershipStatus.EXPIRED,
      daysAgo(5)
    );
    await Payment.create({
      libraryId: libAlpha._id,
      studentId: sp02._id,
      paymentType: PaymentType.FEES,
      paymentMethod: PaymentMethod.UPI,
      amount: 1500,
      status: PaymentStatus.PENDING,
      idempotencyKey: 'TEST_IDEMP_002',
      billingCycleStart: daysAgo(35),
      billingCycleEnd: daysAgo(5),
    });

    // 3. Student whose payment is approved
    const { profile: sp03 } = await buildStudent(
      '03 Approved Payment',
      '9990000203',
      'TEST_CARD_003',
      libAlpha._id,
      MembershipStatus.ACTIVE,
      daysAhead(25)
    );
    await Payment.create({
      libraryId: libAlpha._id,
      studentId: sp03._id,
      paymentType: PaymentType.COMBINED,
      paymentMethod: PaymentMethod.UPI,
      amount: 2200,
      status: PaymentStatus.APPROVED,
      utrNumber: 'TEST_UTR_APP_03',
      proofUrl: sampleProofUrlApproved,
      idempotencyKey: 'TEST_IDEMP_003',
      billingCycleStart: daysAgo(5),
      billingCycleEnd: daysAhead(25),
      approvedByAdminId: adminUserAlpha._id,
    });

    // 4. Student whose payment is rejected
    const { profile: sp04 } = await buildStudent(
      '04 Rejected Payment',
      '9990000204',
      'TEST_CARD_004',
      libAlpha._id,
      MembershipStatus.PENDING_PAYMENT,
      daysAgo(2),
      { rejectionCount: 1 }
    );
    await Payment.create({
      libraryId: libAlpha._id,
      studentId: sp04._id,
      paymentType: PaymentType.FEES,
      paymentMethod: PaymentMethod.UPI,
      amount: 1500,
      status: PaymentStatus.REJECTED,
      rejectionReason: 'Illegible screenshot. Please upload valid proof.',
      proofUrl: sampleProofUrlRejected,
      idempotencyKey: 'TEST_IDEMP_004',
      billingCycleStart: daysAgo(30),
      billingCycleEnd: daysAgo(0),
    });

    // 5. Student with 3 rejected payments → inactive
    const { profile: sp05 } = await buildStudent(
      '05 Inactive 3 Strikes',
      '9990000205',
      'TEST_CARD_005',
      libAlpha._id,
      MembershipStatus.INACTIVE,
      daysAgo(10),
      { rejectionCount: 3, inactivatedAt: daysAgo(2) }
    );
    for (let r = 1; r <= 3; r++) {
      await Payment.create({
        libraryId: libAlpha._id,
        studentId: sp05._id,
        paymentType: PaymentType.FEES,
        paymentMethod: PaymentMethod.UPI,
        amount: 1500,
        status: PaymentStatus.REJECTED,
        rejectionReason: `Rejection attempt #${r}: Fake UTR provided`,
        proofUrl: sampleProofUrlRejected,
        idempotencyKey: `TEST_IDEMP_005_STRIKE_${r}`,
        billingCycleStart: daysAgo(40),
        billingCycleEnd: daysAgo(10),
      });
    }

    // 6. Student with subscription expiring soon (2 days)
    await buildStudent(
      '06 Expiring Soon',
      '9990000206',
      'TEST_CARD_006',
      libAlpha._id,
      MembershipStatus.ACTIVE,
      daysAhead(2)
    );

    // 7. Student with expired subscription
    await buildStudent(
      '07 Expired Subscription',
      '9990000207',
      'TEST_CARD_007',
      libAlpha._id,
      MembershipStatus.EXPIRED,
      daysAgo(10)
    );

    // 8. Student with valid seat assignment (Seat A-001)
    const seatA1 = createdSeats[0];
    const { profile: sp08 } = await buildStudent(
      '08 Seat Assigned',
      '9990000208',
      'TEST_CARD_008',
      libAlpha._id,
      MembershipStatus.ACTIVE,
      daysAhead(30),
      { currentSeatId: seatA1._id as any }
    );
    // Update seat reservation status
    seatA1.status = SeatStatus.RESERVED;
    seatA1.currentReservation = {
      studentId: sp08._id,
      startAt: daysAgo(5),
      endAt: daysAhead(25),
      reservedAt: daysAgo(5),
    };
    await seatA1.save();

    // 9. Student with valid locker assignment (Locker L1-001)
    const lockerL1 = createdLockers[0];
    const { profile: sp09 } = await buildStudent(
      '09 Locker Assigned',
      '9990000209',
      'TEST_CARD_009',
      libAlpha._id,
      MembershipStatus.ACTIVE,
      daysAhead(30),
      { currentLockerId: lockerL1._id as any }
    );
    lockerL1.status = LockerStatus.RESERVED;
    lockerL1.currentReservation = {
      studentId: sp09._id,
      startAt: daysAgo(5),
      endAt: daysAhead(25),
      reservedAt: daysAgo(5),
    };
    await lockerL1.save();

    // 10. Student with different/non-overlapping time-slot (Morning Slot: 06:00 - 14:00) vs Evening Slot
    const seatA5 = createdSeats[4]; // Seat A-005
    const { profile: sp10Morning } = await buildStudent(
      '10 Morning Slot Student',
      '9990000210',
      'TEST_CARD_010',
      libAlpha._id,
      MembershipStatus.ACTIVE,
      daysAhead(30),
      { fromTime: '06:00', toTime: '14:00', currentSeatId: seatA5._id as any }
    );

    const { profile: sp10Evening } = await buildStudent(
      '10 Evening Slot Student',
      '9990000211',
      'TEST_CARD_011',
      libAlpha._id,
      MembershipStatus.ACTIVE,
      daysAhead(30),
      { fromTime: '14:00', toTime: '22:00' }
    );

    // Non-overlapping reservations on Seat A-005
    seatA5.status = SeatStatus.RESERVED;
    seatA5.assignedReservations = [
      {
        studentId: sp10Morning._id,
        fromTime: '06:00',
        toTime: '14:00',
        startAt: daysAgo(5),
        endAt: daysAhead(25),
      },
      {
        studentId: sp10Evening._id,
        fromTime: '14:00',
        toTime: '22:00',
        startAt: daysAgo(5),
        endAt: daysAhead(25),
      },
    ];
    await seatA5.save();

    // 11. Student with pending attendance approval
    const { profile: sp11, u: u11 } = await buildStudent(
      '11 Pending Attendance',
      '9990000212',
      'TEST_CARD_012',
      libAlpha._id,
      MembershipStatus.ACTIVE,
      daysAhead(30)
    );
    await AttendanceRequest.create({
      studentProfileId: sp11._id,
      userId: u11._id,
      libraryId: libAlpha._id,
      scanTimestamp: daysAgo(0),
      status: 'PENDING',
      paymentStatusAtScan: 'PAID',
    });

    // 12. Student currently checked in
    const { profile: sp12 } = await buildStudent(
      '12 Currently Checked In',
      '9990000213',
      'TEST_CARD_013',
      libAlpha._id,
      MembershipStatus.ACTIVE,
      daysAhead(30)
    );
    await AttendanceSession.create({
      libraryId: libAlpha._id,
      studentId: sp12._id,
      checkInAt: new Date(now.getTime() - 2 * 60 * 60 * 1000), // 2 hours ago
      status: AttendanceStatus.ACTIVE,
      checkInNonce: 'TEST_NONCE_ACTIVE_12',
    });

    // 13. Student currently checked out
    const { profile: sp13 } = await buildStudent(
      '13 Currently Checked Out',
      '9990000214',
      'TEST_CARD_014',
      libAlpha._id,
      MembershipStatus.ACTIVE,
      daysAhead(30)
    );
    await AttendanceSession.create({
      libraryId: libAlpha._id,
      studentId: sp13._id,
      checkInAt: new Date(now.getTime() - 6 * 60 * 60 * 1000),
      checkOutAt: new Date(now.getTime() - 1 * 60 * 60 * 1000),
      durationMinutes: 300,
      status: AttendanceStatus.COMPLETED,
      checkInNonce: 'TEST_NONCE_COMPLETED_13',
    });

    // 14. Student with rich attendance history
    const { profile: sp14 } = await buildStudent(
      '14 Attendance History',
      '9990000215',
      'TEST_CARD_015',
      libAlpha._id,
      MembershipStatus.ACTIVE,
      daysAhead(30)
    );
    for (let d = 1; d <= 5; d++) {
      await AttendanceSession.create({
        libraryId: libAlpha._id,
        studentId: sp14._id,
        checkInAt: new Date(now.getTime() - (d * 24 + 4) * 60 * 60 * 1000),
        checkOutAt: new Date(now.getTime() - d * 24 * 60 * 60 * 1000),
        durationMinutes: 240,
        status: AttendanceStatus.COMPLETED,
        checkInNonce: `TEST_NONCE_HIST_${d}`,
      });
    }

    // 15. Student with multiple payment history records (1 Approved, 1 Rejected, 1 Pending)
    const { profile: sp15 } = await buildStudent(
      '15 Multi-Payment History',
      '9990000216',
      'TEST_CARD_016',
      libAlpha._id,
      MembershipStatus.ACTIVE,
      daysAhead(30)
    );
    // Past Approved
    await Payment.create({
      libraryId: libAlpha._id,
      studentId: sp15._id,
      paymentType: PaymentType.FEES,
      paymentMethod: PaymentMethod.CASH,
      amount: 1500,
      status: PaymentStatus.APPROVED,
      idempotencyKey: 'TEST_IDEMP_HIST_APP_15',
      billingCycleStart: daysAgo(60),
      billingCycleEnd: daysAgo(30),
      approvedByAdminId: adminUserAlpha._id,
    });
    // Past Rejected
    await Payment.create({
      libraryId: libAlpha._id,
      studentId: sp15._id,
      paymentType: PaymentType.SEAT,
      paymentMethod: PaymentMethod.UPI,
      amount: 500,
      status: PaymentStatus.REJECTED,
      rejectionReason: 'Proof screenshot unclear',
      proofUrl: sampleProofUrlRejected,
      idempotencyKey: 'TEST_IDEMP_HIST_REJ_15',
      billingCycleStart: daysAgo(30),
      billingCycleEnd: daysAgo(0),
    });
    // Current Pending
    await Payment.create({
      libraryId: libAlpha._id,
      studentId: sp15._id,
      paymentType: PaymentType.COMBINED,
      paymentMethod: PaymentMethod.UPI,
      amount: 2000,
      status: PaymentStatus.PENDING,
      utrNumber: 'TEST_UTR_MULTI_15',
      proofUrl: sampleProofUrlPending,
      idempotencyKey: 'TEST_IDEMP_HIST_PEND_15',
      billingCycleStart: now,
      billingCycleEnd: daysAhead(30),
    });

    // 16. Multi-Library Student (Same User across Library Alpha & Library Beta)
    const multiUser = await User.create({
      fullName: 'TEST_STUDENT 16 Multi-Library User',
      phone: '9990000217',
      email: 'student.multi@testerp.com',
      passwordHash: defaultPasswordHash,
      role: UserRole.STUDENT,
    });
    // Profile in Lib Alpha (Active)
    await buildStudent(
      '16 Multi-Lib Alpha Profile',
      '9990000217',
      'TEST_CARD_017_A',
      libAlpha._id,
      MembershipStatus.ACTIVE,
      daysAhead(20),
      { userObj: multiUser, referralCode: 'TEST_REF_MULTI_A' }
    );
    // Profile in Lib Beta (Expired & Pending Payment)
    await buildStudent(
      '16 Multi-Lib Beta Profile',
      '9990000217',
      'TEST_CARD_017_B',
      libBeta._id,
      MembershipStatus.EXPIRED,
      daysAgo(5),
      { userObj: multiUser, referralCode: 'TEST_REF_MULTI_B' }
    );

    logger.info('Created 16+ distinct Local Student edge cases across multiple libraries.');

    // ==========================================
    // 5. ATTENDANCE REQUEST & SESSION EDGE CASES
    // ==========================================

    // Approved Attendance Request
    const { profile: spAttApp, u: uAttApp } = await buildStudent(
      'Approved Check-in Request',
      '9990000301',
      'TEST_CARD_ATT_01',
      libAlpha._id,
      MembershipStatus.ACTIVE,
      daysAhead(30)
    );
    await AttendanceRequest.create({
      studentProfileId: spAttApp._id,
      userId: uAttApp._id,
      libraryId: libAlpha._id,
      scanTimestamp: daysAgo(0),
      status: 'APPROVED',
      approvedByAdminId: adminUserAlpha._id,
      processedAt: daysAgo(0),
    });

    // Rejected Attendance Request
    const { profile: spAttRej, u: uAttRej } = await buildStudent(
      'Rejected Check-in Request',
      '9990000302',
      'TEST_CARD_ATT_02',
      libAlpha._id,
      MembershipStatus.PENDING_PAYMENT,
      daysAgo(1)
    );
    await AttendanceRequest.create({
      studentProfileId: spAttRej._id,
      userId: uAttRej._id,
      libraryId: libAlpha._id,
      scanTimestamp: daysAgo(0),
      status: 'REJECTED',
      rejectionReason: 'Membership expired / Pending fee approval',
      paymentStatusAtScan: 'PENDING',
      processedAt: daysAgo(0),
    });

    logger.info('Seeded Attendance Request & Session edge cases.');

    // ==========================================
    // 6. NOTIFICATIONS SEEDING
    // ==========================================

    await Notification.create([
      // Super Admin Broadcast to all Local Admins (Active)
      {
        libraryId: libAlpha._id,
        title: 'TEST_ Super Admin Broadcast: Platform System Maintenance scheduled',
        body: 'The ERP platform will undergo scheduled maintenance tonight at 02:00 AM IST.',
        type: 'SUPER_ADMIN_BROADCAST',
        status: 'ACTIVE',
        expiresAt: daysAhead(7),
        isRead: false,
      },
      // Super Admin Announcement (Expired)
      {
        libraryId: libAlpha._id,
        title: 'TEST_ Super Admin Announcement: Independence Day Offer',
        body: 'Special discounts on yearly SaaS renewals.',
        type: 'SUPER_ADMIN_ANNOUNCEMENT',
        status: 'EXPIRED',
        expiresAt: daysAgo(2),
        isRead: true,
      },
      // Local Admin Broadcast to Students in Lib Alpha
      {
        libraryId: libAlpha._id,
        title: 'TEST_ Local Admin Alert: Extended AC Hours in Study Hall 1',
        body: 'Air conditioning will remain operational until 11:30 PM starting today.',
        type: 'BROADCAST',
        status: 'ACTIVE',
        expiresAt: daysAhead(5),
        isRead: false,
      },
      // Targeted Notification for Specific Student
      {
        libraryId: libAlpha._id,
        recipientStudentId: sp01._id,
        title: 'TEST_ Fee Reminder: Payment Pending Verification',
        body: 'Your subscription fee proof is currently under review by library admin.',
        type: 'ALERT',
        status: 'ACTIVE',
        expiresAt: daysAhead(3),
        isRead: false,
      },
    ]);

    logger.info('Seeded Notifications (Super Admin broadcasts, Local Admin alerts, Active/Expired).');

    logger.info('🎉 ERP TEST DATA SEED COMPLETED SUCCESSFULLY!');
    logger.info('----------------------------------------------------');
    logger.info('Summary of seeded data:');
    logger.info('- Libraries: 5 (Full Features, Seat Only, Locker Only, SaaS Overdue, SaaS Pending)');
    logger.info('- Local Admins: 5 (Up-to-date, Due today, Future due, Rejected SaaS, Approved SaaS)');
    logger.info('- Seats: 120+ across 3 floors in Lib Alpha (Available, Reserved, Time Slot split)');
    logger.info('- Lockers: 60+ across 2 floors in Lib Alpha');
    logger.info('- Students: 16+ Edge Cases (Pending, Overdue, Approved, Rejected, 3 Strikes, Expiring Soon, Expired, Seat Assigned, Locker Assigned, Checked-in, Checked-out, Multi-library)');
    logger.info('- Attendance: Pending QR requests, Approved requests, Rejected requests, Active sessions');
    logger.info('- Payments: Pending proof, Rejected proof, Approved, Overdue, Multiple history items');
    logger.info('- Notifications: Active/Expired, Super Admin broadcasts, Local Admin alerts');
    logger.info('----------------------------------------------------');
  } catch (err) {
    logger.error('❌ Error seeding test data:', err);
    throw err;
  }
};

// Executable entry point
if (require.main === module) {
  const isCleanOnly = process.argv.includes('--clean');
  mongoose
    .connect(env.MONGO_URI)
    .then(async () => {
      if (isCleanOnly) {
        await cleanupTestData();
      } else {
        await seedTestData();
      }
      process.exit(0);
    })
    .catch((err) => {
      logger.error('Database connection failed:', err);
      process.exit(1);
    });
}
