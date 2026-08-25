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

// Family/provider "my dashboard" overview - deliberately a separate router
// (not added to overviewRoutes above), since that one is mounted at
// /admin/overview in routes/index.ts and its own routes have no auth guard
// wired up yet. Mount this one at a plain /overview instead.
export const myOverviewRoutes = Router();

myOverviewRoutes.get(
  '/my',
  auth(USER_ROLE.FAMILY, USER_ROLE.PROVIDER),
  validateRequest(overviewValidation.yearQueryZodSchema),
  overviewController.getMyOverview,
);
