import { TWeekDay } from './booking.interface';
import { WEEK_DAYS } from '../availability/availability.interface';

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

// enforces bookingRules.minimumBookingHours - blocks last-minute bookings
// too close to the slot's start time
export const isBookingWithinMinimumWindow = (
  bookingDate: Date,
  slotStartTime: string,
  minimumBookingHours: number
): boolean => {
  const [hours, minutes] = slotStartTime.split(':').map(Number);

  const slotDateTime = new Date(bookingDate);
  slotDateTime.setHours(hours, minutes, 0, 0);

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