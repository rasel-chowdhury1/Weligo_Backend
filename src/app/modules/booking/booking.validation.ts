import { z } from 'zod';

const rescheduleBookingZodSchema = z.object({
  body: z.object({
    bookingDate: z.string({ required_error: 'bookingDate is required' }),
    timeSlotId: z.string({ required_error: 'timeSlotId is required' }),
  }),
});

const bookingActionReasonZodSchema = z.object({
  body: z.object({
    reason: z.string().trim().max(500).optional(),
  }),
});

export const bookingValidation = {
  rescheduleBookingZodSchema,
  bookingActionReasonZodSchema,
};
