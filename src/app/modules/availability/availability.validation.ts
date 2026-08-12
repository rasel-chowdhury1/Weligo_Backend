import { z } from 'zod';
import { WEEK_DAYS } from './availability.interface';

const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

const timeField = (fieldName: string) =>
  z
    .string({ required_error: `${fieldName} is required` })
    .regex(TIME_REGEX, { message: `${fieldName} must be in HH:mm 24-hour format` });

const toggleDayAvailabilityZodSchema = z.object({
  params: z.object({
    day: z.enum(WEEK_DAYS, {
      errorMap: () => ({ message: `day must be one of: ${WEEK_DAYS.join(', ')}` }),
    }),
  }),
  body: z.object({
    isAvailable: z.boolean({ required_error: 'isAvailable is required' }),
  }),
});

const addTimeSlotZodSchema = z.object({
  params: z.object({
    day: z.enum(WEEK_DAYS, {
      errorMap: () => ({ message: `day must be one of: ${WEEK_DAYS.join(', ')}` }),
    }),
  }),
  body: z
    .object({
      startTime: timeField('startTime'),
      endTime: timeField('endTime'),
    })
    .refine((data) => data.startTime < data.endTime, {
      message: 'startTime must be earlier than endTime',
      path: ['endTime'],
    }),
});

const updateTimeSlotZodSchema = z.object({
  params: z.object({
    day: z.enum(WEEK_DAYS, {
      errorMap: () => ({ message: `day must be one of: ${WEEK_DAYS.join(', ')}` }),
    }),
    slotId: z.string({ required_error: 'slotId is required' }),
  }),
  body: z
    .object({
      startTime: z
        .string()
        .regex(TIME_REGEX, { message: 'startTime must be in HH:mm 24-hour format' })
        .optional(),
      endTime: z
        .string()
        .regex(TIME_REGEX, { message: 'endTime must be in HH:mm 24-hour format' })
        .optional(),
    })
    .refine((data) => data.startTime || data.endTime, {
      message: 'At least one of startTime or endTime is required',
    })
    .refine(
      (data) => !(data.startTime && data.endTime) || data.startTime < data.endTime,
      {
        message: 'startTime must be earlier than endTime',
        path: ['endTime'],
      },
    ),
});

const deleteTimeSlotZodSchema = z.object({
  params: z.object({
    day: z.enum(WEEK_DAYS, {
      errorMap: () => ({ message: `day must be one of: ${WEEK_DAYS.join(', ')}` }),
    }),
    slotId: z.string({ required_error: 'slotId is required' }),
  }),
});

const updateBookingRulesZodSchema = z.object({
  body: z
    .object({
      minimumBookingHours: z.number().positive().optional(),
      maxBookingsPerDay: z.number().int().positive().optional(),
      acceptingBookings: z.boolean().optional(),
    })
    .refine(
      (data) =>
        data.minimumBookingHours !== undefined ||
        data.maxBookingsPerDay !== undefined ||
        data.acceptingBookings !== undefined,
      { message: 'At least one booking rule field is required' },
    ),
});

export const availabilityValidation = {
  toggleDayAvailabilityZodSchema,
  addTimeSlotZodSchema,
  updateTimeSlotZodSchema,
  deleteTimeSlotZodSchema,
  updateBookingRulesZodSchema,
};
