import { Schema, model, Document, Types } from 'mongoose';

export interface IAttendanceRequest extends Document {
  studentProfileId: Types.ObjectId;
  userId: Types.ObjectId;
  libraryId: Types.ObjectId;
  scanTimestamp: Date;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  rejectionReason?: string;
  paymentStatusAtScan: 'PAID' | 'PENDING';
  approvedByAdminId?: Types.ObjectId;
  processedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const AttendanceRequestSchema = new Schema<IAttendanceRequest>(
  {
    studentProfileId: { type: Schema.Types.ObjectId, ref: 'StudentProfile', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    libraryId: { type: Schema.Types.ObjectId, ref: 'Library', required: true, index: true },
    scanTimestamp: { type: Date, required: true },
    status: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'REJECTED'],
      default: 'PENDING',
      index: true,
    },
    rejectionReason: { type: String, default: null },
    paymentStatusAtScan: { type: String, enum: ['PAID', 'PENDING'], default: 'PAID' },
    approvedByAdminId: { type: Schema.Types.ObjectId, ref: 'User' },
    processedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

AttendanceRequestSchema.index({ libraryId: 1, status: 1, createdAt: -1 });

export const AttendanceRequest = model<IAttendanceRequest>('AttendanceRequest', AttendanceRequestSchema);
