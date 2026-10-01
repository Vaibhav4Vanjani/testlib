import { Schema, model, Document, Types } from 'mongoose';
import { AttendanceStatus } from '../constants/statusEnums';

export interface IAttendanceSession extends Document {
  libraryId: Types.ObjectId;
  studentId: Types.ObjectId;
  checkInAt: Date;
  checkOutAt?: Date;
  durationMinutes?: number;
  status: AttendanceStatus;
  checkInNonce: string;
  isAutoCheckedOut?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const AttendanceSessionSchema = new Schema<IAttendanceSession>(
  {
    libraryId: { type: Schema.Types.ObjectId, ref: 'Library', required: true, index: true },
    studentId: { type: Schema.Types.ObjectId, ref: 'StudentProfile', required: true, index: true },
    checkInAt: { type: Date, required: true },
    checkOutAt: { type: Date },
    durationMinutes: { type: Number },
    status: { type: String, enum: Object.values(AttendanceStatus), default: AttendanceStatus.ACTIVE, index: true },
    checkInNonce: { type: String, required: true, unique: true, index: true },
    isAutoCheckedOut: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

AttendanceSessionSchema.index({ libraryId: 1, studentId: 1, status: 1 });
AttendanceSessionSchema.index({ libraryId: 1, checkInAt: -1 });
AttendanceSessionSchema.index({ studentId: 1, checkInAt: -1 });
AttendanceSessionSchema.index({ status: 1, checkInAt: 1 });
AttendanceSessionSchema.index({ libraryId: 1, status: 1 });

export const AttendanceSession = model<IAttendanceSession>('AttendanceSession', AttendanceSessionSchema);
