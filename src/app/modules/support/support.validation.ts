import { z } from 'zod';
import { SupportTicketStatus, SupportTicketSubject } from './support.interface';

const createSupportTicketZodSchema = z.object({
  body: z.object({
    subject: z.nativeEnum(SupportTicketSubject, {
      errorMap: () => ({ message: 'Invalid support subject' }),
    }),
    title: z.string({ required_error: 'title is required' }).min(1),
    description: z.string({ required_error: 'description is required' }).min(1),
  }),
});

const addMessageZodSchema = z.object({
  params: z.object({
    id: z.string({ required_error: 'ticket id is required' }),
  }),
  body: z.object({
    message: z.string({ required_error: 'message is required' }).min(1),
  }),
});

const updateStatusZodSchema = z.object({
  params: z.object({
    id: z.string({ required_error: 'ticket id is required' }),
  }),
  body: z.object({
    status: z.nativeEnum(SupportTicketStatus, {
      errorMap: () => ({ message: 'Invalid status' }),
    }),
  }),
});

export const supportValidation = {
  createSupportTicketZodSchema,
  addMessageZodSchema,
  updateStatusZodSchema,
};
