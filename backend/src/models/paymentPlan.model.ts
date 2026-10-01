import { Schema, model, Document, Types } from 'mongoose';

export interface IPaymentPlan extends Document {
  libraryId: Types.ObjectId;
  name: string;
  monthlyFee: number;
  yearlyFee: number;
  seatPriceMonthly: number;
  lockerPriceMonthly: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentPlanSchema = new Schema<IPaymentPlan>(
  {
    libraryId: { type: Schema.Types.ObjectId, ref: 'Library', required: true, index: true },
    name: { type: String, required: true, trim: true },
    monthlyFee: { type: Number, required: true, min: 0 },
    yearlyFee: { type: Number, required: true, min: 0 },
    seatPriceMonthly: { type: Number, default: 0, min: 0 },
    lockerPriceMonthly: { type: Number, default: 0, min: 0 },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

PaymentPlanSchema.index({ libraryId: 1, isActive: 1 });

export const PaymentPlan = model<IPaymentPlan>('PaymentPlan', PaymentPlanSchema);
