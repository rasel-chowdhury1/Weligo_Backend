import express from 'express';
import auth from '../../middleware/auth';
import { USER_ROLE } from '../user/user.constants';
import validateRequest from '../../middleware/validateRequest';
import { reportValidation } from './report.validation';
import { reportController } from './report.controller';

const router = express.Router();

// Family & Provider can create a report
router.post(
  '/',
  auth(USER_ROLE.FAMILY, USER_ROLE.PROVIDER),
  validateRequest(reportValidation.createReportZodSchema),
  reportController.createReport,
);

// Family & Provider can view their own reports
router.get(
  '/my-reports',
  auth(USER_ROLE.FAMILY, USER_ROLE.PROVIDER),
  reportController.getMyReports,
);

// Admin can view all reports
router.get(
  '/',
  auth(USER_ROLE.ADMIN),
  reportController.getAllReports,
);

// Family, Provider & Admin can view a report
router.get(
  '/:id',
  auth(USER_ROLE.FAMILY, USER_ROLE.PROVIDER, USER_ROLE.ADMIN),
  reportController.getReportById,
);

// Admin can update report status
router.patch(
  '/:id/status',
  auth(USER_ROLE.ADMIN),
  validateRequest(reportValidation.updateReportStatusZodSchema),
  reportController.updateReportStatus,
);

// Family, Provider & Admin can delete a report
router.delete(
  '/:id',
  auth(USER_ROLE.FAMILY, USER_ROLE.PROVIDER, USER_ROLE.ADMIN),
  reportController.deleteReport,
);

export const reportRoutes = router;