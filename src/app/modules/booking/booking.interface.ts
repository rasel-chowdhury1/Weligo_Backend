import { Model, Types } from 'mongoose';
import { WEEK_DAYS } from '../availability/availability.interface';

/**
 * ============================================================
 * WEEK DAY
 * ============================================================
 */

export type TWeekDay = (typeof WEEK_DAYS)[number];

/**
 * ============================================================
 * PAYMENT METHODS
 * ============================================================
 *
 * 'twint' is kept for backward compatibility with historical
 * bookings/payments and Datatrans rollback.
 *
 * New bookings currently use:
 * - card
 * - apple_pay
 */

export const PAYMENT_METHODS = [
  'twint',
  'card',
  'apple_pay',
] as const;

export type TPaymentMethod = (typeof PAYMENT_METHODS)[number];

export const ACTIVE_PAYMENT_METHODS = [
  'card',
  'apple_pay',
] as const;

/**
 * ============================================================
 * BOOKING STATUS
 * ============================================================
 */

export enum BookingStatus {
  PENDING = 'pending',

  CONFIRMED = 'confirmed',

  IN_PROGRESS = 'in_progress',

  PROVIDER_COMPLETED = 'provider_completed',

  COMPLETED = 'completed',

  REJECTED = 'rejected',

  CANCELLED = 'cancelled',

  EXPIRED = 'expired',

  DISPUTED = 'disputed',
}

export const BOOKING_STATUSES = Object.values(BookingStatus);

export type TBookingStatus = BookingStatus;

/**
 * ============================================================
 * BOOKING ACTOR / ACTION ROLE
 * ============================================================
 */

export type BookingActionByRole =
  | 'family'
  | 'provider'
  | 'admin'
  | 'system';

/**
 * ============================================================
 * BOOKING STATUS HISTORY
 * ============================================================
 */

export interface IBookingStatusHistory {
  /**
   * Status after this action.
   *
   * Example:
   * pending
   * confirmed
   * in_progress
   * provider_completed
   * completed
   */
  status: BookingStatus;

  /**
   * User who performed the action.
   *
   * Optional because system-generated actions do not have
   * a User document.
   */
  actionBy?: Types.ObjectId;

  /**
   * Role of the actor who performed the action.
   */
  actionByRole: BookingActionByRole;

  /**
   * When the status transition happened.
   */
  actionAt: Date;

  /**
   * Optional explanation for the status change.
   */
  note?: string;
}

/**
 * ============================================================
 * AGE GROUP
 * ============================================================
 */

export const AGE_GROUPS = [
  'child',
  'teen',
  'adult',
  'senior',
] as const;

export type TAgeGroup = (typeof AGE_GROUPS)[number];

/**
 * ============================================================
 * BOOKING TIME SLOT
 * ============================================================
 */

export type TBookingTimeSlot = {
  startTime: string; // "08:00"
  endTime: string; // "13:00"
};

/**
 * ============================================================
 * BOOKING LOCATION
 * ============================================================
 */

export type TBookingLocation = {
  type: 'Point';

  /**
   * GeoJSON format:
   * [longitude, latitude]
   */
  coordinates: [number, number];
};

/**
 * ============================================================
 * BOOKING
 * ============================================================
 */

export type TBooking = {
  /**
   * ==========================================================
   * BOOKING REFERENCE
   * ==========================================================
   */

  bookingReference: string;
  // Example: BK-20260808-4821

  /**
   * ==========================================================
   * USERS
   * ==========================================================
   */

  customer: Types.ObjectId;
  // ref: User

  serviceProvider: Types.ObjectId;
  // ref: User

  /**
   * ==========================================================
   * BOOKING DATE / TIME
   * ==========================================================
   */

  bookingDate: Date;

  dayOfWeek: TWeekDay;

  /**
   * Original availability slot ID.
   */
  timeSlotId: Types.ObjectId;

  /**
   * Snapshot of the selected time slot.
   *
   * This is intentionally stored separately because the
   * original Availability can change later.
   */
  timeSlot: TBookingTimeSlot;

  durationInHours: number;

  /**
   * ==========================================================
   * SERVICE INFORMATION
   * ==========================================================
   */

  ageGroup: TAgeGroup;

  numberOfPersons: number;

  whatToExpect?: string;

  /**
   * ==========================================================
   * LOCATION
   * ==========================================================
   */

  address: string;

  location?: TBookingLocation;

  /**
   * ==========================================================
   * PAYMENT
   * ==========================================================
   */

  paymentAmount: number;
  // Total amount charged to customer

  commissionAmount: number;
  // Platform commission

  providerEarning: number;
  // paymentAmount - commissionAmount

  paymentMethod: TPaymentMethod;

  payment?: Types.ObjectId;
  // ref: Payment

  /**
   * ==========================================================
   * BOOKING STATUS
   * ==========================================================
   */

  status: TBookingStatus;

  /**
   * Complete status transition history.
   */
  statusHistory: IBookingStatusHistory[];

  /**
   * ==========================================================
   * PROVIDER RESPONSE
   * ==========================================================
   */

  acceptedAt?: Date;

  rejectedAt?: Date;

  /**
   * ==========================================================
   * JOB LIFECYCLE
   * ==========================================================
   */

  /**
   * Provider actually started the job.
   */
  startedAt?: Date;

  /**
   * Provider marked the job as finished.
   *
   * This is different from final completion.
   */
  providerCompletedAt?: Date;

  /**
   * Family confirmed that the job was completed.
   */
  completedAt?: Date;

  /**
   * ==========================================================
   * CANCELLATION
   * ==========================================================
   */

  cancelledAt?: Date;

  cancelledBy?:
    | 'customer'
    | 'provider'
    | 'admin'
    | 'system';

  cancellationReason?: string;

  /**
   * ==========================================================
   * EXPIRATION
   * ==========================================================
   *
   * Used when provider does not respond within the allowed
   * time.
   *
   * Example:
   *
   * pending → expired
   */

  expiresAt?: Date;

  /**
   * ==========================================================
   * DISPUTE
   * ==========================================================
   */

  disputedAt?: Date;

  disputedBy?:
    | 'customer'
    | 'provider'
    | 'admin';

  disputeReason?: string;

  /**
   * ==========================================================
   * TIMESTAMPS
   * ==========================================================
   */

  createdAt: Date;

  updatedAt: Date;
};

/**
 * ============================================================
 * BOOKING MODEL
 * ============================================================
 */

export type BookingModel = Model<TBooking>;