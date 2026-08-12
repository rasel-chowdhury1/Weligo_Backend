import { Schema, model } from 'mongoose';
import { REPORT_STATUSES, TReport } from './report.interface';


const ReportSchema = new Schema<TReport>(
  {
    bookingId: {
      type: Schema.Types.ObjectId,
      ref: 'Booking',
      required: true,
      index: true,
    },

    reporterId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    reportedUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    reason: {
      type: String,
      required: true,
      trim: true,
      maxlength: 255,
    },

    description: {
      type: String,
      trim: true,
      maxlength: 2000,
    },

    status: {
      type: String,
      enum: REPORT_STATUSES,
      default: 'pending',
      index: true,
    },

    adminNote: {
      type: String,
      trim: true,
      maxlength: 2000,
    },

    resolvedAt: {
      type: Date,
    },

    resolvedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },

    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

ReportSchema.index({
  bookingId: 1,
  reporterId: 1,
});

export const Report = model<TReport>('Report', ReportSchema);

export default Report;