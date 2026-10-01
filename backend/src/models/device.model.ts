import { Schema, model, Document, Types } from 'mongoose';

export interface IDevice extends Document {
  userId: Types.ObjectId;
  pushToken: string;
  platform: 'ios' | 'android' | 'web';
  lastActiveAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const DeviceSchema = new Schema<IDevice>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    pushToken: { type: String, required: true, unique: true, index: true },
    platform: { type: String, enum: ['ios', 'android', 'web'], required: true },
    lastActiveAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export const Device = model<IDevice>('Device', DeviceSchema);
