import { Types } from 'mongoose';
import { TWeekDay } from './booking.interface';
import { WEEK_DAYS } from '../availability/availability.interface';
import Notification from '../notifications/notifications.model';
import { INotification } from '../notifications/notifications.interface';

// maps a Date (or date string) to your WEEK_DAYS enum value. WEEK_DAYS is
// Monday-first (0 = monday ... 6 = sunday) but JS's getDay() is Sunday-first
// (0 = Sunday ... 6 = Saturday), so the index has to be shifted to line up.
export const getDayOfWeekFromDate = (date: Date | string): TWeekDay => {
  // bookingDate can arrive as a plain JSON string (no validation layer
  // coerces it to a Date), so normalize before calling Date instance methods
  const parsedDate = date instanceof Date ? date : new Date(date);

  if (isNaN(parsedDate.getTime())) {
    throw new Error(`Invalid date: ${date}`);
  }

  const dayIndex = (parsedDate.getDay() + 6) % 7;

  return WEEK_DAYS[dayIndex] as TWeekDay;
};

// combines bookingDate with a "HH:mm" slot time into the actual Date/time the
// slot starts at - server-local time, same as the rest of this module (no
// separate timezone system, reused by both the minimum-notice check below
// and startJobIntoDB's "has the start time arrived yet" check).
export const getSlotStartDateTime = (bookingDate: Date | string, slotStartTime: string): Date => {
  const [hours, minutes] = slotStartTime.split(':').map(Number);

  const slotDateTime = new Date(bookingDate);
  slotDateTime.setHours(hours, minutes, 0, 0);

  return slotDateTime;
};

// enforces bookingRules.minimumBookingHours - blocks last-minute bookings
// too close to the slot's start time
export const isBookingWithinMinimumWindow = (
  bookingDate: Date,
  slotStartTime: string,
  minimumBookingHours: number
): boolean => {
  const slotDateTime = getSlotStartDateTime(bookingDate, slotStartTime);

  const hoursUntilSlot = (slotDateTime.getTime() - Date.now()) / (1000 * 60 * 60);

  return hoursUntilSlot >= minimumBookingHours;
};

// PLACEHOLDER platform commission rate - this is NOT a real business figure,
// replace it with your actual rate (flat %, tiered, per-category, etc.)
// before this touches real money.
export const PLATFORM_COMMISSION_RATE = 0.15;

export const calculateCommissionSplit = (
  paymentAmount: number,
  commissionRate: number = PLATFORM_COMMISSION_RATE
): { commissionAmount: number; providerEarning: number } => {
  const commissionAmount = Math.round(paymentAmount * commissionRate * 100) / 100;
  const providerEarning = Math.round((paymentAmount - commissionAmount) * 100) / 100;

  return { commissionAmount, providerEarning };
};

// Fire-and-forget - a notification failure must never break a booking
// transition that already succeeded. Builds the Notification document
// directly against the actual schema (userId/receiverId/message.text/type -
// see notifications.model.ts) rather than notificationService.createNotification,
// whose shape doesn't match that schema.
//
// Lives here (a leaf-level utils module with no service dependencies) rather
// than in booking.service.ts so both booking.service.ts and
// booking-payment.service.ts can use it without either importing the other -
// see booking-payment.service.ts for why that matters.
export const notifyBookingEvent = (params: {
  receiverId: Types.ObjectId;
  actorId?: Types.ObjectId;
  type: INotification['type'];
  text: string;
}) => {
  process.nextTick(async () => {
    try {
      await new Notification({
        userId: params.actorId ?? params.receiverId,
        receiverId: params.receiverId,
        message: { text: params.text },
        type: params.type,
        isRead: false,
      }).save();
    } catch (error) {
      console.error('Failed to create booking notification', error);
    }
  });
};