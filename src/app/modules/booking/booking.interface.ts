import { Types, Model } from 'mongoose';
import { WEEK_DAYS } from '../availability/availability.interface';

// adjust this import path to wherever WEEK_DAYS actually lives in your project
export type TWeekDay = (typeof WEEK_DAYS)[number];

// 'twint' kept for backward compatibility with historical bookings/payments
// and Datatrans rollback - it's not one of the active methods below.
export const PAYMENT_METHODS = ['twint', 'card', 'apple_pay'] as const;
export type TPaymentMethod = (typeof PAYMENT_METHODS)[number];

// methods new bookings may actually select. Both route to Stripe - see
// getPaymentStrategy() in payment.service.ts.
export const ACTIVE_PAYMENT_METHODS = ['card', 'apple_pay'] as const;

export const BOOKING_STATUSES = [
  'pending',
  'confirmed',
  'completed',
  'cancelled',
  'no-show',
] as const;
export type TBookingStatus = (typeof BOOKING_STATUSES)[number];

export const AGE_GROUPS = ['child', 'teen', 'adult', 'senior'] as const;
export type TAgeGroup = (typeof AGE_GROUPS)[number];

export type TBookingTimeSlot = {
  startTime: string; // "08:00"
  endTime: string; // "13:00"
};

export type TBookingLocation = {
  type: 'Point';
  coordinates: [number, number]; // [longitude, latitude]
};

export type TBooking = {
  bookingReference: string; // human-readable ref, e.g. BK-20260808-4821

  customer: Types.ObjectId; // ref: User
  serviceProvider: Types.ObjectId; // ref: User

  bookingDate: Date;
  dayOfWeek: TWeekDay;

  timeSlotId: Types.ObjectId; // _id of the slot inside Availability.weeklySchedule[].slots[]
  timeSlot: TBookingTimeSlot; // snapshot of the slot at booking time (availability can change later)

  durationInHours: number;
  ageGroup: TAgeGroup;
  numberOfPersons: number;

  paymentAmount: number; // total amount charged to the customer
  commissionAmount: number; // platform's cut of paymentAmount
  providerEarning: number; // paymentAmount - commissionAmount, what gets paid out to the provider

  whatToExpect?: string; // notes shared with the customer about the session
  address: string;
  location?: TBookingLocation; // GeoJSON point, enables geo queries near a provider

  paymentMethod: TPaymentMethod;
  payment?: Types.ObjectId; // ref: Payment, set once a payment record is created

  status: TBookingStatus;

  createdAt: Date;
  updatedAt: Date;
};

export type BookingModel = Model<TBooking>;