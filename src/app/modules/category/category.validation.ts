import { z } from 'zod';
import { CATEGORY_STATUS } from './category.interface';

const createCategoryZodSchema = z.object({
  body: z.object({
    order: z.number({ required_error: 'order is required' }),
    name: z.string({ required_error: 'name is required' }).min(1, {
      message: 'name is required',
    }),
    description: z.string().optional(),
    status: z.enum(CATEGORY_STATUS).optional(),
  }),
});

const updateCategoryZodSchema = z.object({
  body: z.object({
    order: z.number().optional(),
    name: z.string().min(1, { message: 'name is required' }).optional(),
    description: z.string().optional(),
    status: z.enum(CATEGORY_STATUS).optional(),
  }),
});

export const categoryValidation = {
  createCategoryZodSchema,
  updateCategoryZodSchema,
};
