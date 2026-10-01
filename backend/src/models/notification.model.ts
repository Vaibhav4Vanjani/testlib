import { Schema, model, Document, Types } from 'mongoose';

export interface INotification extends Document {
  libraryId: Types.ObjectId;
  recipientStudentId?: Types.ObjectId; // single recipient if applicable
  recipientStudentIds?: Types.ObjectId[]; // list of student profiles for selected students
  title: string;
  body?: string;
  type: string;
  status: 'ACTIVE' | 'HIDDEN' | 'EXPIRED';
  expiresAt: Date;
  isRead: boolean;
  data?: Record<string, any>;
  createdAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    libraryId: { type: Schema.Types.ObjectId, ref: 'Library', required: true, index: true },
    recipientStudentId: { type: Schema.Types.ObjectId, ref: 'StudentProfile', index: true },
    recipientStudentIds: [{ type: Schema.Types.ObjectId, ref: 'StudentProfile', index: true }],
    title: { type: String, required: true },
    body: { type: String, default: '' },
    type: { type: String, required: true, default: 'BROADCAST' },
    status: { type: String, enum: ['ACTIVE', 'HIDDEN', 'EXPIRED'], default: 'ACTIVE', index: true },
    expiresAt: { type: Date, required: true, index: true },
    isRead: { type: Boolean, default: false },
    data: { type: Schema.Types.Mixed },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

NotificationSchema.index({ libraryId: 1, status: 1, expiresAt: -1 });
NotificationSchema.index({ libraryId: 1, recipientStudentId: 1, createdAt: -1 });

export const Notification = model<INotification>('Notification', NotificationSchema);
