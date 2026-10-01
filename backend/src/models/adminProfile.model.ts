import { Schema, model, Document, Types } from 'mongoose';

export interface IAdminProfile extends Document {
  userId: Types.ObjectId;
  libraryId?: Types.ObjectId; // null for SUPER_ADMIN
  designation?: string;
  createdAt: Date;
  updatedAt: Date;
}

const AdminProfileSchema = new Schema<IAdminProfile>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    libraryId: { type: Schema.Types.ObjectId, ref: 'Library', index: true },
    designation: { type: String, default: 'Library Manager' },
  },
  { timestamps: true }
);

export const AdminProfile = model<IAdminProfile>('AdminProfile', AdminProfileSchema);
