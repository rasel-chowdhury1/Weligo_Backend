import { Schema, model } from 'mongoose';

export const REPORT_STATUSES = [
  'pending',
  'under-review',
  'resolved',
  'rejected',
] as const;

export type TReportStatus = (typeof REPORT_STATUSES)[number];

export interface TReport {
  bookingId: Schema.Types.ObjectId;
  reporterId: Schema.Types.ObjectId;
  reportedUserId: Schema.Types.ObjectId;

  reason: string;
  description?: string;

  status: TReportStatus;

  adminNote?: string;
  resolvedAt?: Date;
  resolvedBy?: Schema.Types.ObjectId;

  isDeleted: boolean;
}
