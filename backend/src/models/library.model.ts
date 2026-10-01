import { Schema, model, Document } from 'mongoose';
import { LibraryStatus } from '../constants/statusEnums';

export interface ILibraryFeatureFlags {
  enableReservedSeats: boolean;
  enableLockers: boolean;
  enableReferrals: boolean;
  enableQRAttendance: boolean;
  enableManualPayment: boolean;
}

export interface ILibrary extends Document {
  name: string;
  code: string;
  address?: string;
  contactPhone?: string;
  timezone: string;
  status: LibraryStatus;
  openingTime: string;
  closingTime: string;
  announcement?: string;
  qrSecretKey: string;
  upiId?: string;
  upiQrUrl?: string;
  paymentInstructions?: string;
  featureFlags: ILibraryFeatureFlags;
  isActive: boolean;
  saasPlanType: 'MONTHLY' | 'YEARLY';
  saasAmount: number;
  saasOnboardedAt?: Date;
  saasNextDueDate?: Date;
  saasPaymentStatus: 'UP_TO_DATE' | 'PENDING_APPROVAL' | 'OVERDUE_DEFAULTER';
  createdAt: Date;
  updatedAt: Date;
}

const LibrarySchema = new Schema<ILibrary>(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, unique: true, index: true, uppercase: true, trim: true },
    address: { type: String },
    contactPhone: { type: String },
    timezone: { type: String, default: 'Asia/Kolkata' },
    status: { type: String, enum: Object.values(LibraryStatus), default: LibraryStatus.OPEN },
    openingTime: { type: String, default: '06:00' },
    closingTime: { type: String, default: '23:00' },
    announcement: { type: String },
    qrSecretKey: { type: String, required: true },
    upiId: { type: String },
    upiQrUrl: { type: String },
    paymentInstructions: { type: String },
    featureFlags: {
      enableReservedSeats: { type: Boolean, default: true },
      enableLockers: { type: Boolean, default: true },
      enableReferrals: { type: Boolean, default: true },
      enableQRAttendance: { type: Boolean, default: true },
      enableManualPayment: { type: Boolean, default: true },
    },
    isActive: { type: Boolean, default: true },
    saasPlanType: { type: String, enum: ['MONTHLY', 'YEARLY'], default: 'MONTHLY' },
    saasAmount: { type: Number, default: 1200 },
    saasOnboardedAt: { type: Date, default: Date.now },
    saasNextDueDate: { type: Date, index: true },
    saasPaymentStatus: {
      type: String,
      enum: ['UP_TO_DATE', 'PENDING_APPROVAL', 'OVERDUE_DEFAULTER'],
      default: 'UP_TO_DATE',
      index: true,
    },
  },
  { timestamps: true }
);

export const Library = model<ILibrary>('Library', LibrarySchema);
