import { Types } from 'mongoose';
import { Booking } from './booking.model';
import { Payment } from '../payment/payment.model';
import { BookingActionByRole, BookingStatus } from './booking.interface';
import { notifyBookingEvent } from './booking.utils';

/**
 * ============================================================
 * BOOKING <-> PAYMENT ORCHESTRATION
 * ============================================================
 *
 * The one thing both booking.service.ts and payment.service.ts need to
 * trigger: confirming a booking once BOTH provider acceptance AND payment
 * authorization are in place (see maybeConfirmBooking below). Putting it
 * here - importing only the Booking/Payment models and booking.utils.ts,
 * never either service file - is what keeps the dependency graph acyclic:
 *
 *   booking.service.ts  -> payment.service.ts          (authorize/capture/void/getPayment*)
 *   booking.service.ts  -> booking-payment.service.ts   (maybeConfirmBooking)
 *   payment.service.ts  -> booking-payment.service.ts   (maybeConfirmBooking)
 *   booking-payment.service.ts -> Booking model, Payment model, booking.utils.ts only
 *
 * If maybeConfirmBooking lived in either booking.service.ts or
 * payment.service.ts instead, the other file would have to import it,
 * recreating the booking.service <-> payment.service require cycle this
 * module exists to avoid.
 */

/**
 * The single gate PENDING -> CONFIRMED funnels through, from either
 * direction:
 *  - bookingService.acceptBookingIntoDB calls this after recording provider
 *    acceptance
 *  - paymentService.confirmAuthorizationIntoDB calls this after the gateway
 *    (Stripe webhook or Datatrans) confirms the hold
 * Confirms only when BOTH booking.acceptedAt is set AND the booking's
 * payment is 'authorized' - whichever of the two happens second is what
 * actually triggers confirmation. No-ops (returns the booking unchanged) if
 * either condition isn't met yet, or if the booking isn't 'pending' anymore
 * (already confirmed/cancelled) - safe to call repeatedly/from either path
 * without double-confirming or racing.
 */
const maybeConfirmBooking = async (
  bookingId: string,
  actionBy?: { userId?: string; role?: BookingActionByRole }
) => {
  const booking = await Booking.findById(bookingId);

  if (!booking || booking.status !== BookingStatus.PENDING || !booking.acceptedAt) {
    return booking;
  }

  const payment = await Payment.findOne({ booking: booking._id }).sort({ createdAt: -1 });

  if (!payment || payment.paymentStatus !== 'authorized') {
    return booking;
  }

  booking.status = BookingStatus.CONFIRMED;
  booking.payment = payment._id;
  booking.paymentMethod = payment.paymentMethod;
  booking.statusHistory.push({
    status: BookingStatus.CONFIRMED,
    actionBy: actionBy?.userId ? new Types.ObjectId(actionBy.userId) : undefined,
    actionByRole: actionBy?.role ?? 'system',
    actionAt: new Date(),
    note: 'Provider accepted and payment authorized',
  });

  await booking.save();

  notifyBookingEvent({
    receiverId: booking.customer,
    actorId: booking.serviceProvider,
    type: 'BookingConfirmed',
    text: `Your booking ${booking.bookingReference} is confirmed.`,
  });
  notifyBookingEvent({
    receiverId: booking.serviceProvider,
    actorId: booking.customer,
    type: 'BookingConfirmed',
    text: `Booking ${booking.bookingReference} is confirmed.`,
  });

  return booking;
};

export const bookingPaymentService = {
  maybeConfirmBooking,
};
