import { Seat } from '../models/seat.model';
import { Locker } from '../models/locker.model';
import { StudentProfile } from '../models/studentProfile.model';
import { User } from '../models/user.model';
import { SeatStatus, LockerStatus, MembershipStatus } from '../constants/statusEnums';

/**
 * Service to unreserve seats and lockers whose reservation or payment deadline has passed.
 */
export async function cleanupExpiredReservations(): Promise<{ unreservedSeats: number; unreservedLockers: number }> {
  const now = new Date();

  // 1. Unreserve seats where payment is overdue or reservation end time has passed
  const seatResult = await Seat.updateMany(
    {
      status: { $in: [SeatStatus.RESERVED, SeatStatus.OCCUPIED] },
      $or: [
        { 'currentReservation.endAt': { $lt: now } },
        { 'currentReservation.paymentDueDate': { $lt: now } },
      ],
    },
    {
      $set: {
        status: SeatStatus.AVAILABLE,
        currentReservation: undefined,
      },
    }
  );

  // 2. Unreserve lockers where payment is overdue or reservation end time has passed
  const lockerResult = await Locker.updateMany(
    {
      status: { $in: [LockerStatus.RESERVED, LockerStatus.OCCUPIED] },
      $or: [
        { 'currentReservation.endAt': { $lt: now } },
        { 'currentReservation.paymentDueDate': { $lt: now } },
      ],
    },
    {
      $set: {
        status: LockerStatus.AVAILABLE,
        currentReservation: undefined,
      },
    }
  );

  return {
    unreservedSeats: seatResult.modifiedCount || 0,
    unreservedLockers: lockerResult.modifiedCount || 0,
  };
}

/**
 * Service to permanently delete inactive student profiles that have been inactive for more than 1 month (30 days).
 * Active students are NEVER deleted.
 */
export async function cleanupInactiveStudents(): Promise<{ deletedCount: number }> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // Find inactive student profiles inactivated over 30 days ago
  const expiredInactiveProfiles = await StudentProfile.find({
    membershipStatus: MembershipStatus.INACTIVE,
    inactivatedAt: { $lte: thirtyDaysAgo },
  });

  let deletedCount = 0;
  for (const profile of expiredInactiveProfiles) {
    const userId = profile.userId;

    // Remove student profile
    await StudentProfile.deleteOne({ _id: profile._id });

    // Check if user has any other active or existing profile
    const remainingProfiles = await StudentProfile.countDocuments({ userId, _id: { $ne: profile._id } });
    if (remainingProfiles === 0) {
      await User.deleteOne({ _id: userId });
    }
    deletedCount++;
  }

  return { deletedCount };
}

export function startExpirationJobInterval(intervalMs = 60000) {
  setInterval(async () => {
    try {
      await cleanupExpiredReservations();
      await cleanupInactiveStudents();
    } catch (err) {
      console.error('Error running expiration cleanup jobs:', err);
    }
  }, intervalMs);
}
