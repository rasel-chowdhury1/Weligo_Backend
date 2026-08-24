import express from 'express';
import { bookingController } from './booking.controller';
import auth from '../../middleware/auth';
import validateRequest from '../../middleware/validateRequest';
import { bookingValidation } from './booking.validation';
import { USER_ROLE } from '../user/user.constants';
// import auth from '../../middlewares/auth'; // wire up your real auth middleware here

const router = express.Router();

router
.post(
    '/', /* auth('customer'), */ 
    auth(
      USER_ROLE.FAMILY
    ),
    bookingController.createBooking
)

.get(
    '/my',
    auth(USER_ROLE.FAMILY,USER_ROLE.PROVIDER),
    bookingController.getMyBookings
)

.get(
    '/',
    auth(USER_ROLE.ADMIN),
    bookingController.getAllBookings
)

.get(
    '/earnings/my',
    auth(USER_ROLE.PROVIDER),
    bookingController.getMyEarnings
)

.get(
    '/earnings',
    auth(USER_ROLE.ADMIN),
    bookingController.getAllEarnings
)

.get(
  '/:bookingId',
  /* auth('customer', 'provider', 'admin'), */
  bookingController.getBooking
)

// ---- provider actions -----------------------------------------------

.post(
  '/:bookingId/accept',
  auth(USER_ROLE.PROVIDER),
  bookingController.acceptBooking
)

.post(
  '/:bookingId/decline',
  auth(USER_ROLE.PROVIDER),
  validateRequest(bookingValidation.bookingActionReasonZodSchema),
  bookingController.declineBooking
)

.post(
  '/:bookingId/start',
  auth(USER_ROLE.PROVIDER),
  bookingController.startJob
)

.post(
  '/:bookingId/complete-job',
  auth(USER_ROLE.PROVIDER),
  bookingController.markJobDone
)

// ---- family actions ---------------------------------------------------

.post(
  '/:bookingId/withdraw',
  auth(USER_ROLE.FAMILY),
  validateRequest(bookingValidation.bookingActionReasonZodSchema),
  bookingController.withdrawBooking
)

.patch(
  '/:bookingId/reschedule',
  auth(USER_ROLE.FAMILY),
  validateRequest(bookingValidation.rescheduleBookingZodSchema),
  bookingController.rescheduleBooking
)

.post(
  '/:bookingId/confirm-completion',
  auth(USER_ROLE.FAMILY),
  bookingController.confirmCompletion
)

// ---- shared (family or provider) - only valid from CONFIRMED -------

.post(
  '/:bookingId/cancel',
  auth(USER_ROLE.FAMILY, USER_ROLE.PROVIDER),
  validateRequest(bookingValidation.bookingActionReasonZodSchema),
  bookingController.cancelConfirmedBooking
);

export const bookingRoutes = router;