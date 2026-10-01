import { Schema, model, Document, Types } from 'mongoose';
import { SeatStatus } from '../constants/statusEnums';

export interface ISeatReservation {
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

export interface ISeat extends Document {
  libraryId: Types.ObjectId;
  seatNumber: string;
  floor: number;
  status: SeatStatus;
  currentReservation?: ISeatReservation;
  assignedReservations?: ISeatReservation[];
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const SeatReservationSchema = new Schema<ISeatReservation>({
  studentId: { type: Schema.Types.ObjectId, ref: 'StudentProfile' },
  paymentId: { type: Schema.Types.ObjectId, ref: 'Payment' },
  startAt: { type: Date },
  endAt: { type: Date },
  fromTime: { type: String, default: null },
  toTime: { type: String, default: null },
  reservedAt: { type: Date },
  paymentDueDate: { type: Date },
});

const SeatSchema = new Schema<ISeat>(
  {
    libraryId: { type: Schema.Types.ObjectId, ref: 'Library', required: true, index: true },
    seatNumber: { type: String, required: true, trim: true },
    floor: { type: Number, default: 1 },
    status: { type: String, enum: Object.values(SeatStatus), default: SeatStatus.AVAILABLE, index: true },
    currentReservation: SeatReservationSchema,
    assignedReservations: [SeatReservationSchema],
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

SeatSchema.index({ libraryId: 1, floor: 1, seatNumber: 1 }, { unique: true });
SeatSchema.index({ libraryId: 1, status: 1 });
SeatSchema.index({ 'currentReservation.studentId': 1 });

export const Seat = model<ISeat>('Seat', SeatSchema);
