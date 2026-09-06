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
  _id: z.string().optional(),
  type: z.string().min(1).optional(),
  description: z.string().optional(),
}).refine((certificate) => certificate._id || certificate.type, {
  message: 'certificate type is required for a new certificate',
  path: ['type'],
});

const completeProviderProfileZodSchema = z.object({
  body: z.object({
    firstName: z.string().min(1).optional(),
    lastName: z.string().min(1).optional(),
    dateOfBirth: z.coerce.date().optional(),
    phone: z.string().optional(),
    city: z.string().optional(),
    postalCode: z.string().optional(),
    address: z.string().optional(),
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
    deleteCertificateIds: z.array(z.string()).optional(),
  }),
});

export const userValidation = {
  userValidationSchema,
  registerUserSchema,
  completeProviderProfileZodSchema,
};
