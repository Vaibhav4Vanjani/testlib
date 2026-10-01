import { Schema, model, Document, Types } from 'mongoose';
import { MembershipStatus } from '../constants/statusEnums';

export interface IStudentProfile extends Document {
  userId: Types.ObjectId;
  libraryId: Types.ObjectId;
  studentIdCardNo: string;
  aadharNumber?: string;
  profilePicture?: string;
  fromDate?: Date;
  toDate?: Date;
  fromTime?: string;
  toTime?: string;
  monthsCount?: number;
  currentSeatId?: Types.ObjectId;
  currentLockerId?: Types.ObjectId;
  membershipStatus: MembershipStatus;
  membershipExpiresAt?: Date;
  inactivatedAt?: Date;
  rejectionCount?: number;
  passwordHash?: string;
  referralCode: string;
  referredByStudentId?: Types.ObjectId;
  monthlyStats: {
    totalStudyMinutes: number;
    lastCalculatedMonth: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const StudentProfileSchema = new Schema<IStudentProfile>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    libraryId: { type: Schema.Types.ObjectId, ref: 'Library', required: true, index: true },
    studentIdCardNo: { type: String, required: true },
    aadharNumber: { type: String, trim: true, default: null },
    profilePicture: { type: String, default: null },
    fromDate: { type: Date },
    toDate: { type: Date },
    fromTime: { type: String, default: null },
    toTime: { type: String, default: null },
    monthsCount: { type: Number, default: 1 },
    currentSeatId: { type: Schema.Types.ObjectId, ref: 'Seat' },
    currentLockerId: { type: Schema.Types.ObjectId, ref: 'Locker' },
    membershipStatus: {
      type: String,
      enum: Object.values(MembershipStatus),
      default: MembershipStatus.PENDING_PAYMENT,
    },
    membershipExpiresAt: { type: Date },
    inactivatedAt: { type: Date, default: null },
    rejectionCount: { type: Number, default: 0 },
    passwordHash: { type: String, default: null },
    referralCode: { type: String, required: true, unique: true, index: true },
    referredByStudentId: { type: Schema.Types.ObjectId, ref: 'StudentProfile' },
    monthlyStats: {
      totalStudyMinutes: { type: Number, default: 0 },
      lastCalculatedMonth: { type: String, default: '' },
    },
  },
  { timestamps: true }
);

// Compound multi-tenant unique indexes
StudentProfileSchema.index({ libraryId: 1, userId: 1 }, { unique: true });
StudentProfileSchema.index({ libraryId: 1, studentIdCardNo: 1 }, { unique: true });
StudentProfileSchema.index({ libraryId: 1, membershipStatus: 1, createdAt: -1 });

export const StudentProfile = model<IStudentProfile>('StudentProfile', StudentProfileSchema);
