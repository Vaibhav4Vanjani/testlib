import { Seat } from '../models/seat.model';
import { Library } from '../models/library.model';
import { StudentProfile } from '../models/studentProfile.model';
import { SeatStatus } from '../constants/statusEnums';
import { NotFoundError, ConflictError, ValidationError, ForbiddenError } from '../utils/customErrors';

import { sortItemsNaturally } from '../utils/sorting';

export class SeatService {
  static async getSeats(libraryId: string) {
    const library = await Library.findById(libraryId).lean();
    if (library?.featureFlags?.enableReservedSeats === false) {
      throw new ForbiddenError('Reserved Seat feature is disabled for your library tenant');
    }

    const seats = await Seat.find({ libraryId, isDeleted: false })
      .populate({
        path: 'currentReservation.studentId',
        select: 'studentIdCardNo userId',
        populate: { path: 'userId', select: 'fullName phone' },
      })
      .lean();

    return sortItemsNaturally(seats, 'seatNumber');
  }

  static async reserveSeat(libraryId: string, seatId: string, studentProfileId: string, durationMonths = 1) {
    const library = await Library.findById(libraryId).lean();
    if (library?.featureFlags?.enableReservedSeats === false) {
      throw new ForbiddenError('Reserved Seat feature is disabled for your library tenant');
    }
    // 1. Check if seat exists and is available
    const seat = await Seat.findOne({ _id: seatId, libraryId, isDeleted: false });
    if (!seat) {
      throw new NotFoundError('Seat not found');
    }

    if (seat.status !== SeatStatus.AVAILABLE) {
      throw new ConflictError('This seat is already reserved or occupied', 'SEAT_UNAVAILABLE');
    }

    // 2. Check if student already has a reserved seat
    const studentProfile = await StudentProfile.findById(studentProfileId);
    if (!studentProfile) {
      throw new NotFoundError('Student profile not found');
    }

    const startAt = new Date();
    const endAt = new Date();
    endAt.setMonth(endAt.getMonth() + durationMonths);

    const reservedAt = new Date();
    const paymentDueDate = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes payment grace window

    // Atomic update with status filter to prevent race conditions
    const updatedSeat = await Seat.findOneAndUpdate(
      { _id: seatId, libraryId, status: SeatStatus.AVAILABLE },
      {
        $set: {
          status: SeatStatus.RESERVED,
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

    if (!updatedSeat) {
      throw new ConflictError('Seat reservation collision. Another student reserved this seat moments ago.', 'SEAT_RACE_CONDITION');
    }

    // Clear previous seat if student was assigned one
    if (studentProfile.currentSeatId && studentProfile.currentSeatId.toString() !== seatId) {
      await Seat.updateOne(
        { _id: studentProfile.currentSeatId },
        { $set: { status: SeatStatus.AVAILABLE }, $unset: { currentReservation: 1 } }
      );
    }

    studentProfile.currentSeatId = updatedSeat._id as any;
    await studentProfile.save();

    return updatedSeat;
  }

  static async updateSeatStatus(libraryId: string, seatId: string, status: SeatStatus) {
    const seat = await Seat.findOne({ _id: seatId, libraryId });
    if (!seat) {
      throw new NotFoundError('Seat not found');
    }

    if (status === SeatStatus.AVAILABLE) {
      if (seat.currentReservation?.studentId) {
        await StudentProfile.updateOne(
          { _id: seat.currentReservation.studentId },
          { $unset: { currentSeatId: 1 } }
        );
      }
      seat.currentReservation = undefined;
    }

    seat.status = status;
    await seat.save();
    return seat;
  }
}
