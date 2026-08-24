import mongoose, { HydratedDocument, Types } from 'mongoose';
import httpStatus from 'http-status';
import { Availability } from '../availability/availability.model';
import { Booking } from './booking.model';
import { BookingStatus, TBooking } from './booking.interface';
import { User } from '../user/user.models';
import { bookingPaymentService } from './booking-payment.service';
import {
  notifyBookingEvent,
  getDayOfWeekFromDate,
  getSlotStartDateTime,
  isBookingWithinMinimumWindow,
  calculateCommissionSplit,
} from './booking.utils';
import { paymentService } from '../payment/payment.service';
import QueryBuilder from '../../builder/QueryBuilder';
import AppError from '../../error/AppError';

export type TMyBookingStatusFilter =
  | 'all'
  | 'pending'
  | 'awaiting-confirmation'
  | 'upcoming'
  | 'inprogress'
  | 'completed'
  | 'cancelled'
  | BookingStatus.IN_PROGRESS
  | BookingStatus.PROVIDER_COMPLETED
  | BookingStatus.REJECTED
  | BookingStatus.EXPIRED
  | BookingStatus.DISPUTED;

type TCreateBookingPayload = Pick<
  TBooking,
  | 'customer'
  | 'serviceProvider'
  | 'bookingDate'
  | 'timeSlotId'
  | 'durationInHours'
  | 'ageGroup'
  | 'numberOfPersons'
  | 'whatToExpect'
  | 'address'
  | 'location'
  | 'paymentMethod'
>;

/**
 * Creates a booking after validating it against the provider's Availability:
 * provider accepting bookings, day is open, slot still exists, min-notice
 * window respected, daily cap not exceeded, and slot isn't already taken.
 * Runs in a transaction so the count/conflict checks and the insert are atomic.
 */
const createBookingIntoDB = async (payload: TCreateBookingPayload, amount: number) => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const dayOfWeek = getDayOfWeekFromDate(payload.bookingDate);

    const availability = await Availability.findOne({
      user: payload.serviceProvider,
    }).session(session);

    if (!availability) {
      throw new AppError(httpStatus.NOT_FOUND, 'This provider has no availability set up');
    }

    if (!availability.bookingRules.acceptingBookings) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'This provider is not accepting bookings right now'
      );
    }

    const daySchedule = availability.weeklySchedule.find((d) => d.day === dayOfWeek);

    if (!daySchedule || !daySchedule.isAvailable) {
      throw new AppError(httpStatus.BAD_REQUEST, `Provider is not available on ${dayOfWeek}`);
    }

    // daySchedule.slots is typed as a plain TTimeSlot[] (see
    // availability.interface.ts - kept a plain-data shape since
    // availability.service.ts also uses it to construct new schedule
    // entries, which a Mongoose DocumentArray type wouldn't accept as
    // literals). Mongoose's `.id()` on a real subdocument array is just a
    // convenience wrapper for finding by `_id` - TTimeSlot already carries
    // an optional `_id`, so this achieves the exact same lookup with no
    // cast needed.
    const slot = daySchedule.slots.find(
      (s) => s._id && String(s._id) === String(payload.timeSlotId)
    );

    if (!slot) {
      throw new AppError(httpStatus.NOT_FOUND, 'Selected time slot no longer exists');
    }

    if (
      !isBookingWithinMinimumWindow(
        payload.bookingDate,
        slot.startTime,
        availability.bookingRules.minimumBookingHours
      )
    ) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        `Bookings must be made at least ${availability.bookingRules.minimumBookingHours} hours in advance`
      );
    }

    const bookingsOnThatDay = await Booking.countDocuments({
      serviceProvider: payload.serviceProvider,
      bookingDate: payload.bookingDate,
      status: { $in: ['pending', 'confirmed'] },
    }).session(session);

    if (bookingsOnThatDay >= availability.bookingRules.maxBookingsPerDay) {
      throw new AppError(httpStatus.BAD_REQUEST, 'Provider is fully booked for this day');
    }

    const conflictingBooking = await Booking.findOne({
      serviceProvider: payload.serviceProvider,
      bookingDate: payload.bookingDate,
      timeSlotId: payload.timeSlotId,
      status: { $in: ['pending', 'confirmed'] },
    }).session(session);

    if (conflictingBooking) {
      throw new AppError(httpStatus.CONFLICT, 'This slot has already been booked');
    }

    const { commissionAmount, providerEarning } = calculateCommissionSplit(amount);

    const [booking] = await Booking.create(
      [
        {
          ...payload,
          dayOfWeek,
          timeSlot: {
            startTime: slot.startTime,
            endTime: slot.endTime,
          },
          paymentAmount: amount,
          commissionAmount,
          providerEarning,
          status: BookingStatus.PENDING,
          statusHistory: [
            {
              status: BookingStatus.PENDING,
              actionBy: payload.customer,
              actionByRole: 'family',
              actionAt: new Date(),
              note: 'Booking created',
            },
          ],
        },
      ],
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    return booking;
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};

/**
 * Creates the booking and immediately places a payment hold for it - this is
 * the "pay at booking time, charge later" flow. If the hold can't be placed
 * (gateway rejects it, network error, etc.) the booking is rolled back so
 * the slot doesn't sit reserved and unpaid.
 */
const createBookingWithHoldIntoDB = async (
  payload: TCreateBookingPayload,
  amount: number
) => {
  const booking = await createBookingIntoDB(payload, amount);

  try {
    const { payment, redirectUrl } = await paymentService.authorizePaymentIntoDB(
      booking._id.toString(),
      amount
    );

    return { booking, payment, redirectUrl };
  } catch (error) {
    await Booking.findByIdAndUpdate(booking._id, {
      status: BookingStatus.CANCELLED,
      cancelledAt: new Date(),
      cancelledBy: 'system',
      cancellationReason: 'Payment authorization failed',
      $push: {
        statusHistory: {
          status: BookingStatus.CANCELLED,
          actionByRole: 'system',
          actionAt: new Date(),
          note: 'Payment authorization failed - booking automatically cancelled',
        },
      },
    });
    throw error;
  }
};

const getBookingByIdFromDB = async (bookingId: string) => {
  const booking = await Booking.findById(bookingId)
    .populate('customer', 'name email')
    .populate('serviceProvider', 'name email')
    .populate('payment');

  if (!booking) {
    throw new AppError(httpStatus.NOT_FOUND, 'Booking not found');
  }

  return booking;
};

/**
 * Unified "my bookings" list for both customer and provider accounts:
 * family users match on `customer` and get the `serviceProvider` populated,
 * provider users match on `serviceProvider` and get the `customer` populated.
 *
 * `status` accepts the raw booking statuses (pending, awaiting-confirmation,
 * completed, cancelled) plus two derived buckets split out of 'confirmed' by
 * date: 'upcoming' (confirmed, date still ahead) and 'inprogress' (confirmed,
 * date is today). 'all' / omitted applies no status filter.
 */
const getMyBookings = async (
  userId: string,
  role: string,
  query: Record<string, unknown>,
) => {
  const isProvider = role === 'provider';
  const roleFilter = isProvider
    ? { serviceProvider: userId }
    : { customer: userId };
  const populateField = isProvider ? 'customer' : 'serviceProvider';

  const { status, ...restQuery } = query as {
    status?: TMyBookingStatusFilter;
  } & Record<string, unknown>;

  const filter: Record<string, unknown> = { ...roleFilter };

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startOfTomorrow = new Date(startOfToday);
  startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);

  switch (status) {
    case undefined:
    case 'all':
      break;
    case 'upcoming':
      filter.status = 'confirmed';
      filter.bookingDate = { $gte: startOfTomorrow };
      break;
    case 'inprogress':
      filter.status = 'confirmed';
      filter.bookingDate = { $gte: startOfToday, $lt: startOfTomorrow };
      break;
    case 'pending':
    case 'awaiting-confirmation':
    case 'completed':
    case 'cancelled':
    case BookingStatus.IN_PROGRESS:
    case BookingStatus.PROVIDER_COMPLETED:
    case BookingStatus.REJECTED:
    case BookingStatus.EXPIRED:
    case BookingStatus.DISPUTED:
      filter.status = status;
      break;
    default:
      throw new AppError(
        httpStatus.BAD_REQUEST,
        `Invalid status filter: ${status}`,
      );
  }

  const bookingQuery = new QueryBuilder(Booking.find(filter), {
    sort: '-bookingDate',
    ...restQuery,
  })
    .filter()
    .sort()
    .paginate()
    .fields();

  const result = await bookingQuery.modelQuery
    .populate(populateField, 'fullName profileImage email phone')
    .populate('payment');
  const meta = await bookingQuery.countTotal();

  return { meta, result };
};

/**
 * Provider earnings summary + paginated earnings history, computed from
 * `providerEarning` on their bookings:
 * - totalEarnings / completedBookings: from completed bookings only (money
 *   has actually been captured by then, see completeBookingIntoDB)
 * - pendingEarnings: from confirmed-but-not-yet-completed bookings, i.e.
 *   earnings still in the pipeline
 * - thisMonthEarnings: completed earnings within the current calendar month
 * `from`/`to` (on bookingDate) scope both the summary and the history list;
 * everything else in `query` (page/limit/sort/fields) only affects the list.
 */
const getMyEarnings = async (
  providerId: string,
  query: Record<string, unknown>,
) => {
  const { from, to, ...restQuery } = query as {
    from?: string;
    to?: string;
  } & Record<string, unknown>;

  const baseMatch: Record<string, unknown> = {
    serviceProvider: new mongoose.Types.ObjectId(providerId),
  };

  if (from || to) {
    baseMatch.bookingDate = {
      ...(from && { $gte: new Date(from) }),
      ...(to && { $lte: new Date(to) }),
    };
  }

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [summary] = await Booking.aggregate([
    { $match: baseMatch },
    {
      $group: {
        _id: null,
        totalEarnings: {
          $sum: {
            $cond: [{ $eq: ['$status', 'completed'] }, '$providerEarning', 0],
          },
        },
        completedBookings: {
          $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] },
        },
        pendingEarnings: {
          $sum: {
            $cond: [{ $eq: ['$status', 'confirmed'] }, '$providerEarning', 0],
          },
        },
        thisMonthEarnings: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ['$status', 'completed'] },
                  { $gte: ['$bookingDate', startOfMonth] },
                ],
              },
              '$providerEarning',
              0,
            ],
          },
        },
        totalBookings: { $sum: 1 },
      },
    },
  ]);

  const historyQuery = new QueryBuilder(
    Booking.find({ ...baseMatch, status: 'completed' }),
    { sort: '-bookingDate', ...restQuery },
  )
    .filter()
    .sort()
    .paginate()
    .fields();

  const result = await historyQuery.modelQuery.populate(
    'customer',
    'fullName profileImage email phone',
  );
  const meta = await historyQuery.countTotal();

  return {
    summary: {
      totalEarnings: summary?.totalEarnings ?? 0,
      pendingEarnings: summary?.pendingEarnings ?? 0,
      thisMonthEarnings: summary?.thisMonthEarnings ?? 0,
      completedBookings: summary?.completedBookings ?? 0,
      totalBookings: summary?.totalBookings ?? 0,
    },
    meta,
    result,
  };
};



// ---- booking lifecycle actions ------------------------------------------
// PENDING -> CONFIRMED -> IN_PROGRESS -> PROVIDER_COMPLETED -> COMPLETED,
// with CANCELLED reachable from PENDING/CONFIRMED. See maybeConfirmBooking
// for why PENDING -> CONFIRMED specifically needs both provider acceptance
// and payment authorization, and payment.service.ts#confirmAuthorizationIntoDB
// for the other half of that gate.

type TBookingDoc = HydratedDocument<TBooking>;

/**
 * Releases the payment hold when a booking is declined/withdrawn/cancelled.
 * Looks the payment up by booking id rather than booking.payment, since that
 * link is only set once the payment is authorized (see
 * confirmAuthorizationIntoDB) - a booking cancelled while payment is still
 * merely 'pending' (Checkout Session created, not yet completed) needs
 * voiding too. Only 'pending'/'authorized' holds are voidable; a captured
 * payment should never reach here since cancellation isn't allowed once a
 * booking reaches provider_completed/completed. Reuses the existing
 * voidPaymentIntoDB - no new payment logic.
 */
const voidBookingPaymentIfNeeded = async (booking: TBookingDoc) => {
  let payment;

  try {
    payment = booking.payment
      ? await paymentService.getPaymentByIdFromDB(booking.payment.toString())
      : await paymentService.getPaymentByBookingFromDB(booking._id.toString());
  } catch {
    return; // no payment record at all - nothing to void
  }

  if (['pending', 'authorized'].includes(payment.paymentStatus)) {
    await paymentService.voidPaymentIntoDB(payment._id.toString());
  }
};

/**
 * Provider accepts a pending booking. Does not confirm the booking by
 * itself - see bookingPaymentService.maybeConfirmBooking (payment must also
 * be authorized).
 * Idempotent: a booking already accepted (acceptedAt set) is returned as-is
 * rather than re-accepted or rejected, so a double-click/retry is harmless.
 */
const acceptBookingIntoDB = async (bookingId: string, providerId: string) => {
  const booking = await Booking.findById(bookingId);

  if (!booking) {
    throw new AppError(httpStatus.NOT_FOUND, 'Booking not found');
  }

  if (booking.serviceProvider.toString() !== providerId) {
    throw new AppError(httpStatus.FORBIDDEN, 'You are not the assigned provider for this booking');
  }

  if (booking.acceptedAt) {
    return booking;
  }

  if (booking.status !== BookingStatus.PENDING) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Only pending bookings can be accepted (current status: ${booking.status})`
    );
  }

  booking.acceptedAt = new Date();
  booking.statusHistory.push({
    status: booking.status,
    actionBy: new Types.ObjectId(providerId),
    actionByRole: 'provider',
    actionAt: booking.acceptedAt,
    note: 'Provider accepted the booking',
  });
  await booking.save();

  notifyBookingEvent({
    receiverId: booking.customer,
    actorId: booking.serviceProvider,
    type: 'BookingAccepted',
    text: `Your booking ${booking.bookingReference} was accepted by the provider.`,
  });

  const confirmed = await bookingPaymentService.maybeConfirmBooking(booking._id.toString(), {
    userId: providerId,
    role: 'provider',
  });

  return confirmed ?? booking;
};

/**
 * Provider declines a pending booking. Per the required lifecycle this ends
 * in 'cancelled' (not the model's separate 'rejected' status) - rejectedAt
 * is still set so it's distinguishable from other cancellation origins.
 */
const declineBookingIntoDB = async (bookingId: string, providerId: string, reason?: string) => {
  const booking = await Booking.findById(bookingId);

  if (!booking) {
    throw new AppError(httpStatus.NOT_FOUND, 'Booking not found');
  }

  if (booking.serviceProvider.toString() !== providerId) {
    throw new AppError(httpStatus.FORBIDDEN, 'You are not the assigned provider for this booking');
  }

  if (booking.status !== BookingStatus.PENDING) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Only pending bookings can be declined (current status: ${booking.status})`
    );
  }

  const now = new Date();
  booking.rejectedAt = now;
  booking.status = BookingStatus.CANCELLED;
  booking.cancelledAt = now;
  booking.cancelledBy = 'provider';
  booking.cancellationReason = reason;
  booking.statusHistory.push({
    status: BookingStatus.CANCELLED,
    actionBy: new Types.ObjectId(providerId),
    actionByRole: 'provider',
    actionAt: now,
    note: reason ? `Provider declined: ${reason}` : 'Provider declined the booking',
  });
  await booking.save();

  await voidBookingPaymentIfNeeded(booking);

  notifyBookingEvent({
    receiverId: booking.customer,
    actorId: booking.serviceProvider,
    type: 'BookingDeclined',
    text: `Your booking ${booking.bookingReference} was declined by the provider.`,
  });

  return booking;
};

/**
 * Family withdraws a pending booking (before the provider has responded).
 */
const withdrawBookingIntoDB = async (bookingId: string, customerId: string, reason?: string) => {
  const booking = await Booking.findById(bookingId);

  if (!booking) {
    throw new AppError(httpStatus.NOT_FOUND, 'Booking not found');
  }

  if (booking.customer.toString() !== customerId) {
    throw new AppError(httpStatus.FORBIDDEN, 'You are not the customer on this booking');
  }

  if (booking.status !== BookingStatus.PENDING) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Only pending bookings can be withdrawn (current status: ${booking.status})`
    );
  }

  const now = new Date();
  booking.status = BookingStatus.CANCELLED;
  booking.cancelledAt = now;
  booking.cancelledBy = 'customer';
  booking.cancellationReason = reason;
  booking.statusHistory.push({
    status: BookingStatus.CANCELLED,
    actionBy: new Types.ObjectId(customerId),
    actionByRole: 'family',
    actionAt: now,
    note: reason ? `Family withdrew: ${reason}` : 'Family withdrew the booking',
  });
  await booking.save();

  await voidBookingPaymentIfNeeded(booking);

  notifyBookingEvent({
    receiverId: booking.serviceProvider,
    actorId: booking.customer,
    type: 'BookingWithdrawn',
    text: `Booking ${booking.bookingReference} was withdrawn by the family before you responded.`,
  });

  return booking;
};

/**
 * Family or provider cancels a confirmed booking (before the job starts).
 * Not usable once the job is in_progress/provider_completed/completed - the
 * required lifecycle doesn't allow normal cancellation from those states.
 */
const cancelConfirmedBookingIntoDB = async (
  bookingId: string,
  userId: string,
  role: 'family' | 'provider',
  reason?: string
) => {
  const booking = await Booking.findById(bookingId);

  if (!booking) {
    throw new AppError(httpStatus.NOT_FOUND, 'Booking not found');
  }

  if (role === 'provider' && booking.serviceProvider.toString() !== userId) {
    throw new AppError(httpStatus.FORBIDDEN, 'You are not the assigned provider for this booking');
  }

  if (role === 'family' && booking.customer.toString() !== userId) {
    throw new AppError(httpStatus.FORBIDDEN, 'You are not the customer on this booking');
  }

  if (booking.status !== BookingStatus.CONFIRMED) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Only confirmed bookings can be cancelled this way (current status: ${booking.status})`
    );
  }

  const now = new Date();
  const actorLabel = role === 'provider' ? 'Provider' : 'Family';

  booking.status = BookingStatus.CANCELLED;
  booking.cancelledAt = now;
  booking.cancelledBy = role === 'provider' ? 'provider' : 'customer';
  booking.cancellationReason = reason;
  booking.statusHistory.push({
    status: BookingStatus.CANCELLED,
    actionBy: new Types.ObjectId(userId),
    actionByRole: role,
    actionAt: now,
    note: reason ? `${actorLabel} cancelled: ${reason}` : `${actorLabel} cancelled the booking`,
  });
  await booking.save();

  await voidBookingPaymentIfNeeded(booking);

  notifyBookingEvent({
    receiverId: role === 'provider' ? booking.customer : booking.serviceProvider,
    actorId: role === 'provider' ? booking.serviceProvider : booking.customer,
    type: 'BookingCancelled',
    text: `Booking ${booking.bookingReference} was cancelled by the ${role === 'provider' ? 'provider' : 'family'}.`,
  });

  return booking;
};

/**
 * Provider starts the job. Requires the current time to have reached the
 * slot's start time - enforced server-side, never trust a frontend-disabled
 * button. Idempotent: an already-started booking (startedAt set) is
 * returned as-is.
 */
const startJobIntoDB = async (bookingId: string, providerId: string) => {
  const booking = await Booking.findById(bookingId);

  if (!booking) {
    throw new AppError(httpStatus.NOT_FOUND, 'Booking not found');
  }

  if (booking.serviceProvider.toString() !== providerId) {
    throw new AppError(httpStatus.FORBIDDEN, 'You are not the assigned provider for this booking');
  }

  if (booking.startedAt) {
    return booking;
  }

  if (booking.status !== BookingStatus.CONFIRMED) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Only confirmed bookings can be started (current status: ${booking.status})`
    );
  }

  const allowedStartAt = getSlotStartDateTime(booking.bookingDate, booking.timeSlot.startTime);

  if (new Date() < allowedStartAt) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `This job cannot be started before ${allowedStartAt.toISOString()}`
    );
  }

  const now = new Date();
  booking.status = BookingStatus.IN_PROGRESS;
  booking.startedAt = now;
  booking.statusHistory.push({
    status: BookingStatus.IN_PROGRESS,
    actionBy: new Types.ObjectId(providerId),
    actionByRole: 'provider',
    actionAt: now,
    note: 'Provider started the job',
  });
  await booking.save();

  notifyBookingEvent({
    receiverId: booking.customer,
    actorId: booking.serviceProvider,
    type: 'JobStarted',
    text: `Your provider started the job for booking ${booking.bookingReference}.`,
  });

  return booking;
};

/**
 * Provider marks the job done. This does NOT complete the booking - the
 * family still has to confirm (confirmCompletionIntoDB) before payment is
 * captured. Idempotent: already-marked-done is returned as-is.
 */
const markJobDoneIntoDB = async (bookingId: string, providerId: string) => {
  const booking = await Booking.findById(bookingId);

  if (!booking) {
    throw new AppError(httpStatus.NOT_FOUND, 'Booking not found');
  }

  if (booking.serviceProvider.toString() !== providerId) {
    throw new AppError(httpStatus.FORBIDDEN, 'You are not the assigned provider for this booking');
  }

  if (booking.providerCompletedAt) {
    return booking;
  }

  if (booking.status !== BookingStatus.IN_PROGRESS) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Only in-progress bookings can be marked done (current status: ${booking.status})`
    );
  }

  const now = new Date();
  booking.status = BookingStatus.PROVIDER_COMPLETED;
  booking.providerCompletedAt = now;
  booking.statusHistory.push({
    status: BookingStatus.PROVIDER_COMPLETED,
    actionBy: new Types.ObjectId(providerId),
    actionByRole: 'provider',
    actionAt: now,
    note: 'Provider marked the job as done',
  });
  await booking.save();

  notifyBookingEvent({
    receiverId: booking.customer,
    actorId: booking.serviceProvider,
    type: 'JobMarkedDone',
    text: `Your provider marked booking ${booking.bookingReference} as done - please confirm completion.`,
  });

  return booking;
};

/**
 * Family confirms completion - the one place money actually moves in this
 * flow. Captures the held payment via the existing capturePaymentIntoDB
 * (itself idempotent, see payment.service.ts), so a duplicate confirmation
 * request never double-captures. Idempotent overall: an already-completed
 * booking is returned as-is.
 */
const confirmCompletionIntoDB = async (bookingId: string, customerId: string) => {
  const booking = await Booking.findById(bookingId);

  if (!booking) {
    throw new AppError(httpStatus.NOT_FOUND, 'Booking not found');
  }

  if (booking.customer.toString() !== customerId) {
    throw new AppError(httpStatus.FORBIDDEN, 'You are not the customer on this booking');
  }

  if (booking.status === BookingStatus.COMPLETED) {
    return booking;
  }

  if (booking.status !== BookingStatus.PROVIDER_COMPLETED) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Only bookings marked done by the provider can be confirmed (current status: ${booking.status})`
    );
  }

  if (!booking.payment) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Booking has no payment hold to capture');
  }

  await paymentService.capturePaymentIntoDB(booking.payment.toString());

  const now = new Date();
  booking.status = BookingStatus.COMPLETED;
  booking.completedAt = now;
  booking.statusHistory.push({
    status: BookingStatus.COMPLETED,
    actionBy: new Types.ObjectId(customerId),
    actionByRole: 'family',
    actionAt: now,
    note: 'Family confirmed completion - payment captured',
  });
  await booking.save();

  notifyBookingEvent({
    receiverId: booking.serviceProvider,
    actorId: booking.customer,
    type: 'PaymentReleased',
    text: `Booking ${booking.bookingReference} is complete - payment has been released.`,
  });
  notifyBookingEvent({
    receiverId: booking.customer,
    actorId: booking.serviceProvider,
    type: 'BookingCompleted',
    text: `You confirmed completion of booking ${booking.bookingReference}.`,
  });

  return booking;
};

/**
 * Family reschedules a confirmed booking - re-runs the same
 * availability/conflict/minimum-notice validation createBookingIntoDB does,
 * against the new date/slot, then updates the schedule in place. Status
 * stays 'confirmed' (no separate status for rescheduling); the change is
 * still recorded in statusHistory. Not available once the job has started
 * or moved further (status must be exactly 'confirmed').
 */
const rescheduleBookingIntoDB = async (
  bookingId: string,
  customerId: string,
  payload: { bookingDate: Date | string; timeSlotId: string }
) => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const booking = await Booking.findById(bookingId).session(session);

    if (!booking) {
      throw new AppError(httpStatus.NOT_FOUND, 'Booking not found');
    }

    if (booking.customer.toString() !== customerId) {
      throw new AppError(httpStatus.FORBIDDEN, 'You are not the customer on this booking');
    }

    if (booking.status !== BookingStatus.CONFIRMED) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        `Only confirmed bookings can be rescheduled (current status: ${booking.status})`
      );
    }

    const newBookingDate = new Date(payload.bookingDate);
    const dayOfWeek = getDayOfWeekFromDate(newBookingDate);

    const availability = await Availability.findOne({
      user: booking.serviceProvider,
    }).session(session);

    if (!availability) {
      throw new AppError(httpStatus.NOT_FOUND, 'This provider has no availability set up');
    }

    if (!availability.bookingRules.acceptingBookings) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'This provider is not accepting bookings right now'
      );
    }

    const daySchedule = availability.weeklySchedule.find((d) => d.day === dayOfWeek);

    if (!daySchedule || !daySchedule.isAvailable) {
      throw new AppError(httpStatus.BAD_REQUEST, `Provider is not available on ${dayOfWeek}`);
    }

    // daySchedule.slots is typed as a plain TTimeSlot[] (see
    // availability.interface.ts - kept a plain-data shape since
    // availability.service.ts also uses it to construct new schedule
    // entries, which a Mongoose DocumentArray type wouldn't accept as
    // literals). Mongoose's `.id()` on a real subdocument array is just a
    // convenience wrapper for finding by `_id` - TTimeSlot already carries
    // an optional `_id`, so this achieves the exact same lookup with no
    // cast needed.
    const slot = daySchedule.slots.find(
      (s) => s._id && String(s._id) === String(payload.timeSlotId)
    );

    if (!slot) {
      throw new AppError(httpStatus.NOT_FOUND, 'Selected time slot no longer exists');
    }

    if (
      !isBookingWithinMinimumWindow(
        newBookingDate,
        slot.startTime,
        availability.bookingRules.minimumBookingHours
      )
    ) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        `Bookings must be rescheduled at least ${availability.bookingRules.minimumBookingHours} hours in advance`
      );
    }

    const conflictingBooking = await Booking.findOne({
      _id: { $ne: booking._id },
      serviceProvider: booking.serviceProvider,
      bookingDate: newBookingDate,
      timeSlotId: payload.timeSlotId,
      status: { $in: [BookingStatus.PENDING, BookingStatus.CONFIRMED] },
    }).session(session);

    if (conflictingBooking) {
      throw new AppError(httpStatus.CONFLICT, 'This slot has already been booked');
    }

    const previousSchedule = `${booking.bookingDate.toISOString().slice(0, 10)} ${booking.timeSlot.startTime}-${booking.timeSlot.endTime}`;

    booking.bookingDate = newBookingDate;
    booking.dayOfWeek = dayOfWeek;
    booking.timeSlotId = new Types.ObjectId(payload.timeSlotId);
    booking.timeSlot = { startTime: slot.startTime, endTime: slot.endTime };

    booking.statusHistory.push({
      status: BookingStatus.CONFIRMED,
      actionBy: new Types.ObjectId(customerId),
      actionByRole: 'family',
      actionAt: new Date(),
      note: `Family rescheduled from ${previousSchedule}`,
    });

    await booking.save({ session });

    await session.commitTransaction();
    session.endSession();

    notifyBookingEvent({
      receiverId: booking.serviceProvider,
      actorId: booking.customer,
      type: 'BookingRescheduled',
      text: `Booking ${booking.bookingReference} was rescheduled to ${newBookingDate
        .toISOString()
        .slice(0, 10)} ${slot.startTime}-${slot.endTime}.`,
    });

    return booking;
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};

/**
 * Admin-only "all bookings" list - unlike getMyBookings, this applies no
 * customer/provider scoping.
 *
 * `searchTerm` matches against the customer's or serviceProvider's fullName
 * /email - since those are User refs (not fields on Booking itself),
 * QueryBuilder's regex .search() can't reach them directly, so matching User
 * ids are resolved first and then matched via customer/serviceProvider $in.
 * `status` is an exact match. `from`/`to` (on bookingDate) follow the same
 * convention as getMyEarnings above.
 */
const getAllBookingsFromDB = async (query: Record<string, unknown>) => {
  const { from, to, searchTerm, status, ...restQuery } = query as {
    from?: string;
    to?: string;
    searchTerm?: string;
    status?: string;
  } & Record<string, unknown>;

  const filter: Record<string, unknown> = {};

  if (from || to) {
    filter.bookingDate = {
      ...(from && { $gte: new Date(from) }),
      ...(to && { $lte: new Date(to) }),
    };
  }

  if (status) {
    filter.status = status;
  }

  if (searchTerm) {
    const matchedUserIds = await User.find({
      $or: [
        { fullName: { $regex: searchTerm, $options: 'i' } },
        { email: { $regex: searchTerm, $options: 'i' } },
      ],
    }).distinct('_id');

    filter.$or = [
      { customer: { $in: matchedUserIds } },
      { serviceProvider: { $in: matchedUserIds } },
    ];
  }

  const bookingQuery = new QueryBuilder(Booking.find(filter), {
    sort: '-bookingDate',
    ...restQuery,
  })
    .filter()
    .sort()
    .paginate()
    .fields();

  const result = await bookingQuery.modelQuery
    .populate('customer', 'fullName profileImage email phone')
    .populate('serviceProvider', 'fullName profileImage email phone')
    .populate('payment');
  const meta = await bookingQuery.countTotal();

  return { meta, result };
};

/**
 * Admin-only platform-wide earnings for the dashboard: same shape as
 * getMyEarnings above (summary totals + paginated history of completed
 * bookings), but with no serviceProvider scope - across every provider.
 * Complements overviewService.getEarningOverview, which only returns
 * monthly chart totals with no per-booking detail or pagination.
 *
 * `searchTerm` matches the customer's or serviceProvider's fullName/email,
 * same resolution as getAllBookingsFromDB above. `from`/`to` (on
 * bookingDate) scope both the summary and the history list.
 */
const getAllEarningsFromDB = async (query: Record<string, unknown>) => {
  const { from, to, searchTerm, ...restQuery } = query as {
    from?: string;
    to?: string;
    searchTerm?: string;
  } & Record<string, unknown>;

  const baseMatch: Record<string, unknown> = {};

  if (from || to) {
    baseMatch.bookingDate = {
      ...(from && { $gte: new Date(from) }),
      ...(to && { $lte: new Date(to) }),
    };
  }

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [summary] = await Booking.aggregate([
    { $match: baseMatch },
    {
      $group: {
        _id: null,
        totalRevenue: {
          $sum: { $cond: [{ $eq: ['$status', 'completed'] }, '$paymentAmount', 0] },
        },
        totalCommission: {
          $sum: { $cond: [{ $eq: ['$status', 'completed'] }, '$commissionAmount', 0] },
        },
        totalProviderEarning: {
          $sum: { $cond: [{ $eq: ['$status', 'completed'] }, '$providerEarning', 0] },
        },
        pendingEarnings: {
          $sum: { $cond: [{ $eq: ['$status', 'confirmed'] }, '$providerEarning', 0] },
        },
        thisMonthRevenue: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ['$status', 'completed'] },
                  { $gte: ['$bookingDate', startOfMonth] },
                ],
              },
              '$paymentAmount',
              0,
            ],
          },
        },
        completedBookings: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
        totalBookings: { $sum: 1 },
      },
    },
  ]);

  const historyFilter: Record<string, unknown> = { ...baseMatch, status: 'completed' };

  if (searchTerm) {
    const matchedUserIds = await User.find({
      $or: [
        { fullName: { $regex: searchTerm, $options: 'i' } },
        { email: { $regex: searchTerm, $options: 'i' } },
      ],
    }).distinct('_id');

    historyFilter.$or = [
      { customer: { $in: matchedUserIds } },
      { serviceProvider: { $in: matchedUserIds } },
    ];
  }

  const historyQuery = new QueryBuilder(Booking.find(historyFilter), {
    sort: '-bookingDate',
    ...restQuery,
  })
    .filter()
    .sort()
    .paginate()
    .fields();

  const result = await historyQuery.modelQuery
    .populate('customer', 'fullName profileImage email phone')
    .populate('serviceProvider', 'fullName profileImage email phone')
    .populate('payment');
  const meta = await historyQuery.countTotal();

  return {
    summary: {
      totalRevenue: summary?.totalRevenue ?? 0,
      totalCommission: summary?.totalCommission ?? 0,
      totalProviderEarning: summary?.totalProviderEarning ?? 0,
      pendingEarnings: summary?.pendingEarnings ?? 0,
      thisMonthRevenue: summary?.thisMonthRevenue ?? 0,
      completedBookings: summary?.completedBookings ?? 0,
      totalBookings: summary?.totalBookings ?? 0,
    },
    meta,
    result,
  };
};

export const bookingService = {
  createBookingIntoDB,
  createBookingWithHoldIntoDB,
  getBookingByIdFromDB,
  getMyBookings,
  getAllBookingsFromDB,
  getMyEarnings,
  getAllEarningsFromDB,
  acceptBookingIntoDB,
  declineBookingIntoDB,
  withdrawBookingIntoDB,
  cancelConfirmedBookingIntoDB,
  startJobIntoDB,
  markJobDoneIntoDB,
  confirmCompletionIntoDB,
  rescheduleBookingIntoDB,
};