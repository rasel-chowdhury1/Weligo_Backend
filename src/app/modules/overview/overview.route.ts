import { Router } from 'express';
import auth from '../../middleware/auth';
import validateRequest from '../../middleware/validateRequest';
import { USER_ROLE } from '../user/user.constants';
import { overviewController } from './overview.controller';
import { overviewValidation } from './overview.validation';

export const overviewRoutes = Router();

overviewRoutes
  .get(
    '/', 
    // auth(USER_ROLE.ADMIN), 
    overviewController.getTotalOverview
  )

  .get(
    '/bookings',
    // auth(USER_ROLE.ADMIN),
    validateRequest(overviewValidation.yearQueryZodSchema),
    overviewController.getBookingOverview,
  )

  .get(
    '/earnings',
    // auth(USER_ROLE.ADMIN),
    validateRequest(overviewValidation.yearQueryZodSchema),
    overviewController.getEarningOverview,
  );
