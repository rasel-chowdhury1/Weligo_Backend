import { z } from 'zod';

const userValidationSchema = z.object({
  body: z.object({
    fullName: z
      .string()
      .min(1, { message: 'Full name is required' })
      .optional(),
    email: z.string().email({ message: 'Invalid email format' }),
    password: z
      .string()
      .min(6, { message: 'Password must be at least 6 characters long' }),
    phone: z
      .string()
      .min(10, { message: 'Phone number must be at least 10 digits' })
      .optional(),
    about: z.string().optional(),
    role: z.string(),
    image: z.string().optional()
  }),
});

const registerUserSchema = z.object({
  body: z.object({
    fullName: z.string().min(1, { message: 'Full name is required' }),
    email: z.string().email({ message: 'Invalid email format' }),
    password: z.string().min(6, { message: 'Password must be at least 6 characters long' }),
    address: z.string().min(1, { message: 'Address is required' }),
    role: z.enum(['family', 'provider'], { message: 'Role must be family or provider' }),
  }),
});

export const userValidation = {
  userValidationSchema,
  registerUserSchema,
};
