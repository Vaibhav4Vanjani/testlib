import { Locker } from '../models/locker.model';
import { Library } from '../models/library.model';
import { StudentProfile } from '../models/studentProfile.model';
import { LockerStatus } from '../constants/statusEnums';
import { NotFoundError, ConflictError, ForbiddenError } from '../utils/customErrors';

import { sortItemsNaturally } from '../utils/sorting';

export class LockerService {
  static async getLockers(libraryId: string) {
    const library = await Library.findById(libraryId).lean();
    if (library?.featureFlags?.enableLockers === false) {
      throw new ForbiddenError('Locker feature is disabled for your library tenant');
    }

    const lockers = await Locker.find({ libraryId, isDeleted: false })
      .populate({
        path: 'currentReservation.studentId',
        select: 'studentIdCardNo userId',
        populate: { path: 'userId', select: 'fullName phone' },
      })
      .lean();

    return sortItemsNaturally(lockers, 'lockerNumber');
  }

  static async reserveLocker(libraryId: string, lockerId: string, studentProfileId: string, durationMonths = 1) {
    const library = await Library.findById(libraryId).lean();
    if (library?.featureFlags?.enableLockers === false) {
      throw new ForbiddenError('Locker feature is disabled for your library tenant');
    }
    const locker = await Locker.findOne({ _id: lockerId, libraryId, isDeleted: false });
    if (!locker) {
      throw new NotFoundError('Locker not found');
    }

    if (locker.status !== LockerStatus.AVAILABLE) {
      throw new ConflictError('This locker is already reserved or occupied', 'LOCKER_UNAVAILABLE');
    }

    const studentProfile = await StudentProfile.findById(studentProfileId);
    if (!studentProfile) {
      throw new NotFoundError('Student profile not found');
    }

    const startAt = new Date();
    const endAt = new Date();
    endAt.setMonth(endAt.getMonth() + durationMonths);

    const reservedAt = new Date();
    const paymentDueDate = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes payment grace window

    const updatedLocker = await Locker.findOneAndUpdate(
      { _id: lockerId, libraryId, status: LockerStatus.AVAILABLE },
      {
        $set: {
          status: LockerStatus.RESERVED,
          currentReservation: {
            studentId: studentProfile._id,
            startAt,
            endAt,
            reservedAt,
            paymentDueDate,
          },
        },
      },
      { new: true }
    );

    if (!updatedLocker) {
      throw new ConflictError('Locker reservation collision.', 'LOCKER_RACE_CONDITION');
    }

    if (studentProfile.currentLockerId && studentProfile.currentLockerId.toString() !== lockerId) {
      await Locker.updateOne(
        { _id: studentProfile.currentLockerId },
        { $set: { status: LockerStatus.AVAILABLE }, $unset: { currentReservation: 1 } }
      );
    }

    studentProfile.currentLockerId = updatedLocker._id as any;
    await studentProfile.save();

    return updatedLocker;
  }
}
