import { Schema, model, Document, Types } from 'mongoose';
import { LockerStatus } from '../constants/statusEnums';

export interface ILockerReservation {
  _id?: Types.ObjectId;
  studentId?: Types.ObjectId;
  paymentId?: Types.ObjectId;
  startAt?: Date;
  endAt?: Date;
  fromTime?: string;
  toTime?: string;
  reservedAt?: Date;
  paymentDueDate?: Date;
}

export interface ILocker extends Document {
  libraryId: Types.ObjectId;
  lockerNumber: string;
  floor: number;
  status: LockerStatus;
  currentReservation?: ILockerReservation;
  assignedReservations?: ILockerReservation[];
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const LockerReservationSchema = new Schema<ILockerReservation>({
  studentId: { type: Schema.Types.ObjectId, ref: 'StudentProfile' },
  paymentId: { type: Schema.Types.ObjectId, ref: 'Payment' },
  startAt: { type: Date },
  endAt: { type: Date },
  fromTime: { type: String, default: null },
  toTime: { type: String, default: null },
  reservedAt: { type: Date },
  paymentDueDate: { type: Date },
});

const LockerSchema = new Schema<ILocker>(
  {
    libraryId: { type: Schema.Types.ObjectId, ref: 'Library', required: true, index: true },
    lockerNumber: { type: String, required: true, trim: true },
    floor: { type: Number, default: 1 },
    status: { type: String, enum: Object.values(LockerStatus), default: LockerStatus.AVAILABLE, index: true },
    currentReservation: LockerReservationSchema,
    assignedReservations: [LockerReservationSchema],
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

LockerSchema.index({ libraryId: 1, floor: 1, lockerNumber: 1 }, { unique: true });
LockerSchema.index({ libraryId: 1, status: 1 });

export const Locker = model<ILocker>('Locker', LockerSchema);
