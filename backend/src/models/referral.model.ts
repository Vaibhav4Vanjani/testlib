import { Schema, model, Document, Types } from 'mongoose';

export interface IReferral extends Document {
  referrerStudentId: Types.ObjectId;
  referredUserId: Types.ObjectId;
  libraryId: Types.ObjectId;
  status: 'PENDING' | 'REWARDED' | 'EXPIRED';
  rewardAmount?: number;
  createdAt: Date;
  updatedAt: Date;
}

const ReferralSchema = new Schema<IReferral>(
  {
    referrerStudentId: { type: Schema.Types.ObjectId, ref: 'StudentProfile', required: true, index: true },
    referredUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    libraryId: { type: Schema.Types.ObjectId, ref: 'Library', required: true, index: true },
    status: { type: String, enum: ['PENDING', 'REWARDED', 'EXPIRED'], default: 'PENDING' },
    rewardAmount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const Referral = model<IReferral>('Referral', ReferralSchema);
