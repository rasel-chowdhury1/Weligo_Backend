import { z } from 'zod';

const yearQueryZodSchema = z.object({
  query: z.object({
    year: z
      .string()
      .regex(/^\d{4}$/, { message: 'year must be a 4-digit number, e.g. 2026' })
      .optional(),
  }),
});

export const overviewValidation = {
  yearQueryZodSchema,
};
