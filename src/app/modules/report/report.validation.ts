import { z } from 'zod';
import { REPORT_STATUSES } from './report.interface';

const createReportZodSchema = z.object({
  body: z.object({
    bookingId: z.string({ required_error: 'bookingId is required' }),
    reason: z
      .string({ required_error: 'reason is required' })
      .min(1)
      .max(255),
    description: z.string().max(2000).optional(),
  }),
});

const updateReportStatusZodSchema = z.object({
  params: z.object({
    id: z.string({ required_error: 'report id is required' }),
  }),
  body: z.object({
    status: z.enum(REPORT_STATUSES, {
      required_error: 'status is required',
    }),
    adminNote: z.string().max(2000).optional(),
  }),
});

export const reportValidation = {
  createReportZodSchema,
  updateReportStatusZodSchema,
};
