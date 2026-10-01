import { Schema, model, Document, Types } from 'mongoose';
import { PaymentType, PaymentMethod, PaymentStatus } from '../constants/statusEnums';

export interface IPayment extends Document {
  libraryId: Types.ObjectId;
  studentId: Types.ObjectId;
  paymentType: PaymentType;
  paymentMethod: PaymentMethod;
  amount: number;
  status: PaymentStatus;
  orderId?: string;
  paymentId?: string;
  utrNumber?: string;
  proofUrl?: string;
  proofObjectKey?: string;
  adminNotes?: string;
  rejectionReason?: string;
  approvedByAdminId?: Types.ObjectId;
  targetSeatId?: Types.ObjectId;
  targetLockerId?: Types.ObjectId;
  hours?: number;
  months?: number;
  fromTime?: string;
  toTime?: string;
  hasSeat?: boolean;
  hasLocker?: boolean;
  billingCycleStart?: Date;
  billingCycleEnd?: Date;
  idempotencyKey: string;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentSchema = new Schema<IPayment>(
  {
    libraryId: { type: Schema.Types.ObjectId, ref: 'Library', required: true, index: true },
    studentId: { type: Schema.Types.ObjectId, ref: 'StudentProfile', required: true, index: true },
    paymentType: { type: String, enum: Object.values(PaymentType), required: true },
    paymentMethod: { type: String, enum: Object.values(PaymentMethod), required: true },
    amount: { type: Number, required: true, min: 0 },
    status: { type: String, enum: Object.values(PaymentStatus), default: PaymentStatus.PENDING, index: true },
    orderId: { type: String, index: true },
    paymentId: { type: String },
    utrNumber: { type: String },
    proofUrl: { type: String },
    proofObjectKey: { type: String },
    adminNotes: { type: String },
    rejectionReason: { type: String },
    approvedByAdminId: { type: Schema.Types.ObjectId, ref: 'User' },
    targetSeatId: { type: Schema.Types.ObjectId, ref: 'Seat' },
    targetLockerId: { type: Schema.Types.ObjectId, ref: 'Locker' },
    hours: { type: Number, default: 1 },
    months: { type: Number, default: 1 },
    fromTime: { type: String, default: null },
    toTime: { type: String, default: null },
    hasSeat: { type: Boolean, default: false },
    hasLocker: { type: Boolean, default: false },
    billingCycleStart: { type: Date },
    billingCycleEnd: { type: Date },
    idempotencyKey: { type: String, required: true, unique: true, index: true },
  },
  { timestamps: true }
);

PaymentSchema.index({ libraryId: 1, studentId: 1 });
PaymentSchema.index({ studentId: 1, createdAt: -1 });
PaymentSchema.index({ libraryId: 1, status: 1, createdAt: -1 });

export const Payment = model<IPayment>('Payment', PaymentSchema);
