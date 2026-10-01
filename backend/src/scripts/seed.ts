import mongoose from 'mongoose';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { User } from '../models/user.model';
import { Library } from '../models/library.model';
import { StudentProfile } from '../models/studentProfile.model';
import { AdminProfile } from '../models/adminProfile.model';
import { Seat } from '../models/seat.model';
import { Locker } from '../models/locker.model';
import { PaymentPlan } from '../models/paymentPlan.model';
import { CryptoUtils } from '../utils/crypto';
import { UserRole } from '../constants/roles';
import { LibraryStatus, MembershipStatus, SeatStatus, LockerStatus } from '../constants/statusEnums';

const seedDatabase = async () => {
  try {
    await mongoose.connect(env.MONGO_URI);
    logger.info('Connected to MongoDB for seeding...');

    // Clear existing data in dev
    await User.deleteMany({});
    await Library.deleteMany({});
    await StudentProfile.deleteMany({});
    await AdminProfile.deleteMany({});
    await Seat.deleteMany({});
    await Locker.deleteMany({});
    await PaymentPlan.deleteMany({});

    logger.info('Cleaned database collections');

    // 1. Create Library Tenant
    const library = await Library.create({
      name: 'Apex Study Centre & Reading Room',
      code: 'APEX01',
      address: '123 Knowledge Park, Sector 4, Tech City',
      contactPhone: '9876543210',
      status: LibraryStatus.OPEN,
      openingTime: '06:00',
      closingTime: '23:00',
      announcement: 'Welcome to Apex Study Centre! 24/7 High-speed Wi-Fi & AC available.',
      qrSecretKey: 'apex_secret_qr_hmac_key_2026',
    });

    logger.info(`Created Library: ${library.name} (Code: ${library.code})`);

    const defaultPasswordHash = await CryptoUtils.hashPassword('Password123');

    // 2. Create Super Admin User
    const superAdminUser = await User.create({
      fullName: 'Super Admin User',
      phone: '9999999999',
      email: 'admin@nextlib.com',
      passwordHash: defaultPasswordHash,
      role: UserRole.SUPER_ADMIN,
    });

    await AdminProfile.create({
      userId: superAdminUser._id,
      designation: 'System Administrator',
    });

    logger.info('Created Super Admin User: 9999999999 / Password123');

    // 3. Create Library Admin User
    const libraryAdminUser = await User.create({
      fullName: 'Rajesh Sharma',
      phone: '8888888888',
      email: 'rajesh@apexlibrary.com',
      passwordHash: defaultPasswordHash,
      role: UserRole.LIBRARY_ADMIN,
    });

    await AdminProfile.create({
      userId: libraryAdminUser._id,
      libraryId: library._id,
      designation: 'Library Manager',
    });

    logger.info('Created Library Admin User: 8888888888 / Password123');

    // 4. Create Student User
    const studentUser = await User.create({
      fullName: 'Vaibhav Kumar',
      phone: '7777777777',
      email: 'vaibhav@example.com',
      passwordHash: defaultPasswordHash,
      role: UserRole.STUDENT,
    });

    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 30);

    const studentProfile = await StudentProfile.create({
      userId: studentUser._id,
      libraryId: library._id,
      studentIdCardNo: 'APX-2026-001',
      membershipStatus: MembershipStatus.ACTIVE,
      membershipExpiresAt: expiryDate,
      referralCode: 'VAIBHAV100',
    });

    logger.info('Created Student User: 7777777777 / Password123');

    // 5. Create Payment Plans
    await PaymentPlan.create({
      libraryId: library._id,
      name: 'Standard Monthly Membership',
      monthlyFee: 1500,
      yearlyFee: 15000,
      seatPriceMonthly: 500,
      lockerPriceMonthly: 200,
      isActive: true,
    });

    logger.info('Created Payment Plan');

    // 6. Create Seats
    const seatDocs = [];
    for (let i = 1; i <= 20; i++) {
      const seatNum = `A-${i < 10 ? '0' + i : i}`;
      const isReserved = i === 1;
      seatDocs.push({
        libraryId: library._id,
        seatNumber: seatNum,
        floor: 1,
        status: isReserved ? SeatStatus.RESERVED : SeatStatus.AVAILABLE,
        currentReservation: isReserved
          ? {
              studentId: studentProfile._id,
              startAt: new Date(),
              endAt: expiryDate,
            }
          : undefined,
        priceMonthly: 500,
      });
    }

    const createdSeats = await Seat.insertMany(seatDocs);
    logger.info(`Created ${createdSeats.length} Seats`);

    // Assign seat A-01 to Student Profile
    studentProfile.currentSeatId = createdSeats[0]._id as any;

    // 7. Create Lockers
    const lockerDocs = [];
    for (let i = 1; i <= 10; i++) {
      const lockerNum = `L-${i < 10 ? '0' + i : i}`;
      const isReserved = i === 1;
      lockerDocs.push({
        libraryId: library._id,
        lockerNumber: lockerNum,
        status: isReserved ? LockerStatus.RESERVED : LockerStatus.AVAILABLE,
        currentReservation: isReserved
          ? {
              studentId: studentProfile._id,
              startAt: new Date(),
              endAt: expiryDate,
            }
          : undefined,
        priceMonthly: 200,
      });
    }

    const createdLockers = await Locker.insertMany(lockerDocs);
    logger.info(`Created ${createdLockers.length} Lockers`);

    studentProfile.currentLockerId = createdLockers[0]._id as any;
    await studentProfile.save();

    logger.info('✅ Database Seed completed successfully!');
    process.exit(0);
  } catch (error) {
    logger.error('❌ Database Seed failed:', error);
    process.exit(1);
  }
};

seedDatabase();
