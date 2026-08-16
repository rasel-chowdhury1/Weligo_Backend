import { Schema, model } from 'mongoose';
import {
  BookingModel,
  TBooking,
  PAYMENT_METHODS,
  BOOKING_STATUSES,
  BookingStatus,
} from './booking.interface';
import { WEEK_DAYS } from '../availability/availability.interface';

/**
 * ============================================================
 * BOOKING TIME SLOT
 * ============================================================
 */

const BookingTimeSlotSchema = new Schema(
  {
    startTime: {
      type: String,
      required: true, // "08:00"
    },

    endTime: {
      type: String,
      required: true, // "13:00"
    },
  },
  {
    _id: false,
  }
);

/**
 * ============================================================
 * BOOKING LOCATION
 * ============================================================
 */

const BookingLocationSchema = new Schema(
  {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point',
    },

    coordinates: {
      type: [Number],
      required: true, // [longitude, latitude]

      validate: {
        validator: (value: number[]) => {
          return (
            Array.isArray(value) &&
            value.length === 2 &&
            value.every((coordinate) => typeof coordinate === 'number')
          );
        },
        message:
          'Location coordinates must contain [longitude, latitude]',
      },
    },
  },
  {
    _id: false,
  }
);

/**
 * ============================================================
 * BOOKING STATUS HISTORY
 * ============================================================
 *
 * Stores every important booking status transition.
 *
 * Example:
 *
 * pending
 * confirmed
 * in_progress
 * provider_completed
 * completed
 *
 */

const StatusHistorySchema = new Schema(
  {
    status: {
      type: String,
      enum: Object.values(BookingStatus),
      required: true,
    },

    /**
     * User who performed the action.
     *
     * This can be null for system-generated actions.
     *
     * Example:
     * - Family accepts/withdraws
     * - Provider accepts/rejects
     * - Admin changes status
     * - System expires booking
     */
    actionBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },

    /**
     * Role of the person/system who performed the action.
     */
    actionByRole: {
      type: String,
      enum: ['family', 'provider', 'admin', 'system'],
      required: true,
    },

    /**
     * When this status transition happened.
     */
    actionAt: {
      type: Date,
      default: Date.now,
    },

    /**
     * Optional explanation for the status change.
     */
    note: {
      type: String,
      trim: true,
      maxlength: 500,
    },
  },
  {
    _id: false,
  }
);

/**
 * ============================================================
 * BOOKING SCHEMA
 * ============================================================
 */

const BookingSchema = new Schema<TBooking, BookingModel>(
  {
    /**
     * ========================================================
     * BOOKING REFERENCE
     * ========================================================
     */

    bookingReference: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },

    /**
     * ========================================================
     * USERS
     * ========================================================
     */

    customer: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    serviceProvider: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    /**
     * ========================================================
     * BOOKING DATE / TIME
     * ========================================================
     */

    bookingDate: {
      type: Date,
      required: true,
      index: true,
    },

    dayOfWeek: {
      type: String,
      enum: WEEK_DAYS,
      required: true,
    },

    /**
     * Reference to the original availability slot.
     */
    timeSlotId: {
      type: Schema.Types.ObjectId,
      required: true,
    },

    /**
     * Snapshot of the selected time slot.
     *
     * We store this separately because the original
     * availability slot may change later.
     */
    timeSlot: {
      type: BookingTimeSlotSchema,
      required: true,
    },

    durationInHours: {
      type: Number,
      required: true,
      min: 1,
    },

    /**
     * ========================================================
     * SERVICE INFORMATION
     * ========================================================
     */

    ageGroup: {
      type: String,
      required: true,
      trim: true,
    },

    numberOfPersons: {
      type: Number,
      required: true,
      min: 1,
    },

    whatToExpect: {
      type: String,
      trim: true,
    },

    /**
     * ========================================================
     * ADDRESS / LOCATION
     * ========================================================
     */

    address: {
      type: String,
      required: true,
      trim: true,
    },

    location: {
      type: BookingLocationSchema,
    },

    /**
     * ========================================================
     * PAYMENT
     * ========================================================
     */

    paymentAmount: {
      type: Number,
      required: true,
      min: 0,
    },

    commissionAmount: {
      type: Number,
      required: true,
      min: 0,
    },

    providerEarning: {
      type: Number,
      required: true,
      min: 0,
    },

    paymentMethod: {
      type: String,
      enum: PAYMENT_METHODS,
      required: true,
    },

    payment: {
      type: Schema.Types.ObjectId,
      ref: 'Payment',
      index: true,
    },

    /**
     * ========================================================
     * BOOKING STATUS
     * ========================================================
     */

    status: {
      type: String,
      enum: Object.values(BookingStatus),
      default: BookingStatus.PENDING,
      required: true,
      index: true,
    },

    /**
     * ========================================================
     * STATUS HISTORY
     * ========================================================
     */

    statusHistory: {
      type: [StatusHistorySchema],
      default: [],
    },

    /**
     * ========================================================
     * PROVIDER RESPONSE
     * ========================================================
     */

    /**
     * Provider accepted the booking.
     */
    acceptedAt: {
      type: Date,
    },

    /**
     * Provider rejected the booking.
     */
    rejectedAt: {
      type: Date,
    },

    /**
     * ========================================================
     * JOB LIFECYCLE
     * ========================================================
     */

    /**
     * Provider actually started the job.
     */
    startedAt: {
      type: Date,
    },

    /**
     * Provider marked the job as completed.
     *
     * This does NOT mean the booking is finally completed.
     * Family still needs to confirm.
     */
    providerCompletedAt: {
      type: Date,
    },

    /**
     * Family confirmed the provider's completion.
     */
    completedAt: {
      type: Date,
    },

    /**
     * ========================================================
     * CANCELLATION
     * ========================================================
     */

    cancelledAt: {
      type: Date,
    },

    cancelledBy: {
      type: String,
      enum: ['customer', 'provider', 'admin', 'system'],
    },

    cancellationReason: {
      type: String,
      trim: true,
      maxlength: 500,
    },

    /**
     * ========================================================
     * BOOKING EXPIRATION
     * ========================================================
     *
     * If provider doesn't accept/reject before expiresAt,
     * system can automatically change:
     *
     * pending -> expired
     */

    expiresAt: {
      type: Date,
      index: true,
    },

    /**
     * ========================================================
     * DISPUTE
     * ========================================================
     *
     * Example:
     *
     * provider_completed
     *        ↓
     * disputed
     *
     * Admin can then investigate.
     */

    disputedAt: {
      type: Date,
    },

    disputedBy: {
      type: String,
      enum: ['customer', 'provider', 'admin'],
    },

    disputeReason: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
  },

  /**
   * ==========================================================
   * SCHEMA OPTIONS
   * ==========================================================
   */

  {
    timestamps: true,
  }
);

/**
 * ============================================================
 * AUTO-GENERATE BOOKING REFERENCE
 * ============================================================
 */

BookingSchema.pre('validate', function (next) {
  if (!this.bookingReference) {
    const datePart = new Date()
      .toISOString()
      .slice(0, 10)
      .replace(/-/g, '');

    const randomPart = Math.floor(1000 + Math.random() * 9000);

    this.bookingReference = `BK-${datePart}-${randomPart}`;
  }

  next();
});

/**
 * ============================================================
 * INDEXES
 * ============================================================
 */

/**
 * Geospatial search.
 */
BookingSchema.index({
  location: '2dsphere',
});

/**
 * Provider's bookings by date.
 */
BookingSchema.index({
  serviceProvider: 1,
  bookingDate: 1,
});

/**
 * Provider dashboard.
 *
 * Example:
 * Find all pending bookings for a provider.
 */
BookingSchema.index({
  serviceProvider: 1,
  status: 1,
  bookingDate: 1,
});

/**
 * Customer booking history.
 */
BookingSchema.index({
  customer: 1,
  createdAt: -1,
});

/**
 * Customer dashboard.
 */
BookingSchema.index({
  customer: 1,
  status: 1,
  createdAt: -1,
});

/**
 * Find bookings that are waiting for provider response
 * and have expired.
 */
BookingSchema.index({
  status: 1,
  expiresAt: 1,
});

/**
 * Upcoming provider bookings.
 */
BookingSchema.index({
  serviceProvider: 1,
  status: 1,
  bookingDate: 1,
});

/**
 * ============================================================
 * MODEL
 * ============================================================
 */

export const Booking = model<TBooking, BookingModel>(
  'Booking',
  BookingSchema
);

export default Booking;