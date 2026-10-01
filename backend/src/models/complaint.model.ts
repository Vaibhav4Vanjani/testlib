import { Schema, model, Document, Types } from 'mongoose';
import { ComplaintStatus } from '../constants/statusEnums';

export interface IComplaint extends Document {
  libraryId: Types.ObjectId;
  studentId: Types.ObjectId;
  category: string;
  title: string;
  description: string;
  attachmentObjectKeys: string[];
  status: ComplaintStatus;
  adminResponse?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ComplaintSchema = new Schema<IComplaint>(
  {
    libraryId: { type: Schema.Types.ObjectId, ref: 'Library', required: true, index: true },
    studentId: { type: Schema.Types.ObjectId, ref: 'StudentProfile', required: true, index: true },
    category: { type: String, required: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    attachmentObjectKeys: [{ type: String }],
    status: { type: String, enum: Object.values(ComplaintStatus), default: ComplaintStatus.OPEN, index: true },
    adminResponse: { type: String },
  },
  { timestamps: true }
);

ComplaintSchema.index({ libraryId: 1, status: 1 });
ComplaintSchema.index({ studentId: 1, createdAt: -1 });

export const Complaint = model<IComplaint>('Complaint', ComplaintSchema);
