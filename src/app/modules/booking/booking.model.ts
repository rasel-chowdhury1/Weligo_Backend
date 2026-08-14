import { Schema, model } from 'mongoose';
import {
  BookingModel,
  TBooking,
  PAYMENT_METHODS,
  BOOKING_STATUSES,
  AGE_GROUPS,
} from './booking.interface';
import { WEEK_DAYS } from '../availability/availability.interface';

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
  { _id: false }
);

const BookingLocationSchema = new Schema(
  {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point',
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: true,
    },
  },
  { _id: false }
);

const BookingSchema = new Schema<TBooking, BookingModel>(
  {
    bookingReference: {
      type: String,
      required: true,
      unique: true,
    },

    customer: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    serviceProvider: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    bookingDate: {
      type: Date,
      required: true,
    },

    dayOfWeek: {
      type: String,
      enum: WEEK_DAYS,
      required: true,
    },

    timeSlotId: {
      type: Schema.Types.ObjectId,
      required: true, // references the slot _id inside Availability.weeklySchedule[].slots[]
    },

    timeSlot: {
      type: BookingTimeSlotSchema,
      required: true,
    },

    durationInHours: {
      type: Number,
      required: true,
      min: 1,
    },

    ageGroup: {
      type: String,
      // enum: AGE_GROUPS,
      required: true,
    },

    numberOfPersons: {
      type: Number,
      required: true,
      min: 1,
    },

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

    whatToExpect: {
      type: String,
      trim: true,
    },

    address: {
      type: String,
      required: true,
      trim: true,
    },

    location: {
      type: BookingLocationSchema,
    },

    paymentMethod: {
      type: String,
      enum: PAYMENT_METHODS,
      required: true,
    },

    payment: {
      type: Schema.Types.ObjectId,
      ref: 'Payment',
    },

    status: {
      type: String,
      enum: BOOKING_STATUSES,
      default: 'pending',
    },
  },
  {
    timestamps: true,
  }
);

// auto-generate a human-readable reference if the caller didn't supply one.
// for high-volume production traffic, swap the random suffix for a DB-checked
// counter to fully rule out collisions.
BookingSchema.pre('validate', function (next) {
  if (!this.bookingReference) {
    const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomPart = Math.floor(1000 + Math.random() * 9000);
    this.bookingReference = `BK-${datePart}-${randomPart}`;
  }
  next();
});

BookingSchema.index({ location: '2dsphere' });
BookingSchema.index({ serviceProvider: 1, bookingDate: 1 });
BookingSchema.index({ customer: 1, createdAt: -1 });

export const Booking = model<TBooking, BookingModel>('Booking', BookingSchema);

export default Booking;