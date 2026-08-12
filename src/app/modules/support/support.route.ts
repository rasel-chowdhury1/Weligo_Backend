import { Router } from 'express';
import auth from '../../middleware/auth';
import fileUpload from '../../middleware/fileUpload';
import parseData from '../../middleware/parseData';
import validateRequest from '../../middleware/validateRequest';
import { USER_ROLE } from '../user/user.constants';
import { supportController } from './support.controller';
import { supportValidation } from './support.validation';

const upload = fileUpload('./public/uploads/support');

export const supportRoutes = Router();

supportRoutes
  .post(
    '/create',
    auth(USER_ROLE.FAMILY, USER_ROLE.PROVIDER, USER_ROLE.ADMIN),
    upload.single('attachment'),
    parseData(),
    validateRequest(supportValidation.createSupportTicketZodSchema),
    supportController.createTicket,
  )

  .get(
    '/my-tickets',
    auth(USER_ROLE.FAMILY, USER_ROLE.PROVIDER, USER_ROLE.ADMIN),
    supportController.getMyTickets,
  )

  .get('/all-tickets', auth(USER_ROLE.ADMIN), supportController.getAllTickets)

  .get(
    '/:id',
    auth(USER_ROLE.FAMILY, USER_ROLE.PROVIDER, USER_ROLE.ADMIN),
    supportController.getTicketById,
  )

  .post(
    '/:id/messages',
    auth(USER_ROLE.FAMILY, USER_ROLE.PROVIDER, USER_ROLE.ADMIN),
    upload.single('attachment'),
    parseData(),
    validateRequest(supportValidation.addMessageZodSchema),
    supportController.addMessage,
  )

  .patch(
    '/:id/status',
    auth(USER_ROLE.ADMIN),
    validateRequest(supportValidation.updateStatusZodSchema),
    supportController.updateStatus,
  );
