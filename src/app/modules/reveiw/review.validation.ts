import { z } from 'zod';

const createReviewZodSchema = z.object({
  body: z.object({
    bookingId: z.string({ required_error: 'bookingId is required' }),
    rating: z
      .number({ required_error: 'rating is required' })
      .min(1, { message: 'rating must be between 1 and 5' })
      .max(5, { message: 'rating must be between 1 and 5' }),
    comment: z.string().max(1000).optional(),
  }),
});

const updateReviewZodSchema = z.object({
  params: z.object({
    id: z.string({ required_error: 'review id is required' }),
  }),
  body: z
    .object({
      rating: z.number().min(1).max(5).optional(),
      comment: z.string().max(1000).optional(),
    })
    .refine((data) => data.rating !== undefined || data.comment !== undefined, {
      message: 'At least one of rating or comment is required',
    }),
});

const replyToReviewZodSchema = z.object({
  params: z.object({
    id: z.string({ required_error: 'review id is required' }),
  }),
  body: z.object({
    comment: z
      .string({ required_error: 'comment is required' })
      .min(1)
      .max(1000),
  }),
});

export const reviewValidation = {
  createReviewZodSchema,
  updateReviewZodSchema,
  replyToReviewZodSchema,
};
