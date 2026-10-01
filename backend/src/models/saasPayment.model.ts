import { Schema, model, Document, Types } from 'mongoose';

export interface ISaaSPayment extends Document {
  libraryId: Types.ObjectId;
  adminUserId: Types.ObjectId;
  planType: 'MONTHLY' | 'YEARLY';
  amount: number;
  paymentMethod: string;
  transactionRef?: string;
  proofImage?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  rejectionReason?: string;
  dueDate: Date;
  submittedAt: Date;
  reviewedAt?: Date;
  reviewedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const SaaSPaymentSchema = new Schema<ISaaSPayment>(
  {
    libraryId: { type: Schema.Types.ObjectId, ref: 'Library', required: true, index: true },
    adminUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    planType: { type: String, enum: ['MONTHLY', 'YEARLY'], required: true },
    amount: { type: Number, required: true, min: 0 },
    paymentMethod: { type: String, default: 'UPI' },
    transactionRef: { type: String, trim: true },
    proofImage: { type: String },
    status: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED'], default: 'PENDING', index: true },
    rejectionReason: { type: String },
    dueDate: { type: Date, required: true },
    submittedAt: { type: Date, default: Date.now },
    reviewedAt: { type: Date },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

SaaSPaymentSchema.index({ libraryId: 1, status: 1, createdAt: -1 });

export const SaaSPayment = model<ISaaSPayment>('SaaSPayment', SaaSPaymentSchema);
