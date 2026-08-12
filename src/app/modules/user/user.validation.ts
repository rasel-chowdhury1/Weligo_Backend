import { z } from 'zod';

const userValidationSchema = z.object({
  body: z.object({
    firstName: z.string().min(1, { message: 'First name is required' }).optional(),
    lastName: z.string().min(1, { message: 'Last name is required' }).optional(),
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
    city: z.string().optional(),
    postalCode: z.string().optional(),
    address: z.string().optional(),
    location: z
      .object({
        type: z.literal('Point').default('Point'),
        coordinates: z.tuple([z.number(), z.number()], {
          message: 'coordinates must be [longitude, latitude]',
        }),
      })
      .optional(),
    about: z.string().optional(),
    role: z.enum(['family', 'provider'], { message: 'Role must be family or provider' }),
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

const preferencesZodSchema = z.object({
  nonSmoker: z.boolean().optional(),
  driverLicense: z.boolean().optional(),
  ownVehicle: z.boolean().optional(),
  comfortableWithPets: z.boolean().optional(),
  hasChildren: z.boolean().optional(),
});

const certificateInputZodSchema = z.object({
  type: z.string({ required_error: 'certificate type is required' }).min(1),
  description: z.string().optional(),
});

const completeProviderProfileZodSchema = z.object({
  body: z.object({
    phone: z.string().optional(),
    referralSource: z.string().optional(),
    categoryId: z.string().optional(),
    hourlyRate: z.number().nonnegative().optional(),
    experience: z.number().nonnegative().optional(),
    lenguages: z.array(z.string()).optional(),
    shortBioTitle: z.string().optional(),
    shortBio: z.string().optional(),
    longBioTitle: z.string().optional(),
    longBio: z.string().optional(),
    preferences: preferencesZodSchema.optional(),
    certificates: z.array(certificateInputZodSchema).optional(),
  }),
});

export const userValidation = {
  userValidationSchema,
  registerUserSchema,
  completeProviderProfileZodSchema,
};
