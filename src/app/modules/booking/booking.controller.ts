import { Request, Response } from 'express';
import httpStatus from 'http-status';
import catchAsync from '../../utils/catchAsync'; // adjust to your actual utility path
import sendResponse from '../../utils/sendResponse'; // adjust to your actual utility path
import { bookingService } from './booking.service';

const createBooking = catchAsync(async (req: Request, res: Response) => {
  const {userId} = req.user;
  const { amount, ...bookingPayload } = req.body;

  bookingPayload.customer = userId;


  console.log("body of create booking =>>> ", req.body)
  // amount comes from the client for now - move this to a server-side
  // pricing calculation (provider rate x duration x ageGroup, etc.) before
  // going live, never trust a client-supplied charge amount in production

  const result = await bookingService.createBookingWithHoldIntoDB(bookingPayload, amount);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Booking created - complete the payment hold to confirm it',
    data: result,
  });
});

const getBooking = catchAsync(async (req: Request, res: Response) => {
  const result = await bookingService.getBookingByIdFromDB(req.params.bookingId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Booking retrieved successfully',
    data: result,
  });
});

const getMyBookings = catchAsync(async (req: Request, res: Response) => {
  const { userId, role } = req.user;

  const result = await bookingService.getMyBookings(userId, role, req.query);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    meta: result.meta,
    message: 'Bookings retrieved successfully',
    data: result.result,
  });
});



const getMyEarnings = catchAsync(async (req: Request, res: Response) => {
  const { userId } = req.user;

  const result = await bookingService.getMyEarnings(userId, req.query);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    meta: result.meta,
    message: 'Earnings retrieved successfully',
    data: { summary: result.summary, history: result.result },
  });
});

const getAllBookings = catchAsync(async (req: Request, res: Response) => {
  const result = await bookingService.getAllBookingsFromDB(req.query);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    meta: result.meta,
    message: 'Bookings retrieved successfully',
    data: result.result,
  });
});

const getAllEarnings = catchAsync(async (req: Request, res: Response) => {
  const result = await bookingService.getAllEarningsFromDB(req.query);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    meta: result.meta,
    message: 'Earnings retrieved successfully',
    data: { summary: result.summary, history: result.result },
  });
});

// ---- provider actions -----------------------------------------------------

const acceptBooking = catchAsync(async (req: Request, res: Response) => {
  const { userId } = req.user;
  const result = await bookingService.acceptBookingIntoDB(req.params.bookingId, userId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Booking accepted',
    data: result,
  });
});

const declineBooking = catchAsync(async (req: Request, res: Response) => {
  const { userId } = req.user;
  const { reason } = req.body;
  const result = await bookingService.declineBookingIntoDB(req.params.bookingId, userId, reason);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Booking declined',
    data: result,
  });
});

const startJob = catchAsync(async (req: Request, res: Response) => {
  const { userId } = req.user;
  const result = await bookingService.startJobIntoDB(req.params.bookingId, userId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Job started',
    data: result,
  });
});

const markJobDone = catchAsync(async (req: Request, res: Response) => {
  const { userId } = req.user;
  const result = await bookingService.markJobDoneIntoDB(req.params.bookingId, userId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Job marked as done',
    data: result,
  });
});

// ---- family actions ---------------------------------------------------

const withdrawBooking = catchAsync(async (req: Request, res: Response) => {
  const { userId } = req.user;
  const { reason } = req.body;
  const result = await bookingService.withdrawBookingIntoDB(req.params.bookingId, userId, reason);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Booking withdrawn',
    data: result,
  });
});

const rescheduleBooking = catchAsync(async (req: Request, res: Response) => {
  const { userId } = req.user;
  const { bookingDate, timeSlotId } = req.body;
  const result = await bookingService.rescheduleBookingIntoDB(req.params.bookingId, userId, {
    bookingDate,
    timeSlotId,
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Booking rescheduled',
    data: result,
  });
});

const confirmCompletion = catchAsync(async (req: Request, res: Response) => {
  const { userId } = req.user;
  const result = await bookingService.confirmCompletionIntoDB(req.params.bookingId, userId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Booking completed and payment captured',
    data: result,
  });
});

// ---- shared (family or provider) - only valid from CONFIRMED -----------

const cancelConfirmedBooking = catchAsync(async (req: Request, res: Response) => {
  const { userId, role } = req.user;
  const { reason } = req.body;
  const result = await bookingService.cancelConfirmedBookingIntoDB(
    req.params.bookingId,
    userId,
    role,
    reason
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Booking cancelled',
    data: result,
  });
});

export const bookingController = {
  createBooking,
  getBooking,
  getMyBookings,
  getMyEarnings,
  getAllBookings,
  getAllEarnings,
  acceptBooking,
  declineBooking,
  startJob,
  markJobDone,
  withdrawBooking,
  rescheduleBooking,
  confirmCompletion,
  cancelConfirmedBooking,
};