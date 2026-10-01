import { Schema, model, Document, Types } from 'mongoose';

export interface IPaymentMaster extends Document {
  libraryId: Types.ObjectId;
  monthlyFee: number;
  quarterlyFee: number;
  halfYearlyFee: number;
  annualFee: number;
  seatMonthlyFee: number;
  lockerMonthlyFee: number;
  referralRewardAmount: number;
  libraryHourlyRates: number[];
  seatHourlyRates: number[];
  lockerHourlyRates: number[];
  createdAt: Date;
  updatedAt: Date;
}

const DEFAULT_LIBRARY_RATES = [400, 400, 400, 400, 800, 800, 800, 800, 1200, 1200, 1200, 1200];
const DEFAULT_SEAT_RATES = [200, 200, 200, 200, 350, 350, 350, 350, 500, 500, 500, 500];
const DEFAULT_LOCKER_RATES = [100, 100, 100, 100, 150, 150, 150, 150, 200, 200, 200, 200];

const PaymentMasterSchema = new Schema<IPaymentMaster>(
  {
    libraryId: { type: Schema.Types.ObjectId, ref: 'Library', required: true, unique: true, index: true },
    monthlyFee: { type: Number, default: 1200 },
    quarterlyFee: { type: Number, default: 3400 },
    halfYearlyFee: { type: Number, default: 6500 },
    annualFee: { type: Number, default: 12000 },
    seatMonthlyFee: { type: Number, default: 500 },
    lockerMonthlyFee: { type: Number, default: 200 },
    referralRewardAmount: { type: Number, default: 100 },
    libraryHourlyRates: { type: [Number], default: DEFAULT_LIBRARY_RATES },
    seatHourlyRates: { type: [Number], default: DEFAULT_SEAT_RATES },
    lockerHourlyRates: { type: [Number], default: DEFAULT_LOCKER_RATES },
  },
  { timestamps: true }
);

export const PaymentMaster = model<IPaymentMaster>('PaymentMaster', PaymentMasterSchema);

