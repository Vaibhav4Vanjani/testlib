import { Schema, model, Document, Types } from 'mongoose';

export interface IAuditLog extends Document {
  libraryId?: Types.ObjectId;
  actorUserId: Types.ObjectId;
  action: string;
  resource: string;
  resourceId?: Types.ObjectId;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    libraryId: { type: Schema.Types.ObjectId, ref: 'Library', index: true },
    actorUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    action: { type: String, required: true },
    resource: { type: String, required: true },
    resourceId: { type: Schema.Types.ObjectId },
    ipAddress: { type: String },
    userAgent: { type: String },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

AuditLogSchema.index({ libraryId: 1, createdAt: -1 });

export const AuditLog = model<IAuditLog>('AuditLog', AuditLogSchema);
