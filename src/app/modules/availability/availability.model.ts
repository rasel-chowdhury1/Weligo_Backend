import { Schema, model } from 'mongoose';
import {
  AvailabilityModel,
  TAvailability,
  WEEK_DAYS,
} from './availability.interface';

const TimeSlotSchema = new Schema(
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
  { _id: true }
);

const DayAvailabilitySchema = new Schema(
  {
    day: {
      type: String,
      enum: WEEK_DAYS,
      required: true,
    },

    isAvailable: {
      type: Boolean,
      default: false,
    },

    slots: [TimeSlotSchema],
  },
  { _id: false }
);

const BookingRuleSchema = new Schema(
  {
    minimumBookingHours: {
      type: Number,
      default: 2,
    },

    maxBookingsPerDay: {
      type: Number,
      default: 3,
    },

    acceptingBookings: {
      type: Boolean,
      default: true,
    },
  },
  { _id: false }
);

const AvailabilitySchema = new Schema<TAvailability, AvailabilityModel>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },

    weeklySchedule: {
      type: [DayAvailabilitySchema],
      default: [],
    },

    bookingRules: {
      type: BookingRuleSchema,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

export const Availability = model<TAvailability, AvailabilityModel>(
  'Availability',
  AvailabilitySchema,
);

export default Availability;
