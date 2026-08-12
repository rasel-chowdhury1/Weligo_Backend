import express from 'express';
import { bookingController } from './booking.controller';
import auth from '../../middleware/auth';
import { USER_ROLE } from '../user/user.constants';
// import auth from '../../middlewares/auth'; // wire up your real auth middleware here

const router = express.Router();

router
.post(
    '/', /* auth('customer'), */ 
    bookingController.createBooking
)

.get(
    '/my', 
    auth(USER_ROLE.FAMILY,USER_ROLE.PROVIDER),
    bookingController.getMyBookings
)

.get(
  '/:bookingId',
  /* auth('customer', 'provider', 'admin'), */
  bookingController.getBooking
)

.patch(
  '/:bookingId/cancel',
  /* auth('customer', 'provider', 'admin'), */
  bookingController.cancelBooking
)

.patch(
  '/:bookingId/complete',
  /* auth('provider', 'admin'), */
  bookingController.completeBooking
);

export const bookingRoutes = router;