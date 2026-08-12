import mongoose from 'mongoose';
import httpStatus from 'http-status';
import { Availability } from '../availability/availability.model';
import { Booking } from './booking.model';
import { TBooking } from './booking.interface';
import {
  getDayOfWeekFromDate,
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
  | 'cancelled';

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

    const slot = daySchedule.slots.id(payload.timeSlotId);

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
          status: 'pending',
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
    await Booking.findByIdAndUpdate(booking._id, { status: 'cancelled' });
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



const cancelBookingFromDB = async (bookingId: string) => {
  const booking = await Booking.findById(bookingId);

  if (!booking) {
    throw new AppError(httpStatus.NOT_FOUND, 'Booking not found');
  }

  if (['completed', 'cancelled', 'no-show'].includes(booking.status)) {
    throw new AppError(httpStatus.BAD_REQUEST, `Booking is already ${booking.status}`);
  }

  // capture only ever happens at completion in this flow, so a booking being
  // cancelled should never have a captured payment - just release the hold
  if (booking.payment) {
    const payment = await paymentService.getPaymentByIdFromDB(booking.payment.toString());

    if (['pending', 'authorized'].includes(payment.paymentStatus)) {
      await paymentService.voidPaymentIntoDB(payment._id.toString());
    }
  }

  booking.status = 'cancelled';
  await booking.save();

  return booking;
};

/**
 * Marks a booking completed and captures the held payment in the same step -
 * this is the one place money actually moves in this flow.
 */
const completeBookingIntoDB = async (bookingId: string) => {
  const booking = await Booking.findById(bookingId);

  if (!booking) {
    throw new AppError(httpStatus.NOT_FOUND, 'Booking not found');
  }

  if (booking.status !== 'confirmed') {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Only confirmed bookings can be completed (current status: ${booking.status})`
    );
  }

  if (!booking.payment) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Booking has no payment hold to capture');
  }

  await paymentService.capturePaymentIntoDB(booking.payment.toString());

  booking.status = 'completed';
  await booking.save();

  return booking;
};

const updateBookingStatusIntoDB = async (bookingId: string, status: TBooking['status']) => {
  const booking = await Booking.findByIdAndUpdate(bookingId, { status }, { new: true });

  if (!booking) {
    throw new AppError(httpStatus.NOT_FOUND, 'Booking not found');
  }

  return booking;
};

export const bookingService = {
  createBookingIntoDB,
  createBookingWithHoldIntoDB,
  getBookingByIdFromDB,
  getMyBookings,
  getMyEarnings,
  cancelBookingFromDB,
  completeBookingIntoDB,
  updateBookingStatusIntoDB,
};