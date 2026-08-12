import { Request, Response } from 'express';
import httpStatus from 'http-status';
import catchAsync from '../../utils/catchAsync'; // adjust to your actual utility path
import sendResponse from '../../utils/sendResponse'; // adjust to your actual utility path
import { bookingService } from './booking.service';

const createBooking = catchAsync(async (req: Request, res: Response) => {
  const { amount, ...bookingPayload } = req.body;


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



const cancelBooking = catchAsync(async (req: Request, res: Response) => {
  const result = await bookingService.cancelBookingFromDB(req.params.bookingId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Booking cancelled',
    data: result,
  });
});

const completeBooking = catchAsync(async (req: Request, res: Response) => {
  const result = await bookingService.completeBookingIntoDB(req.params.bookingId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Booking completed and payment captured',
    data: result,
  });
});

export const bookingController = {
  createBooking,
  getBooking,
  getMyBookings,
  cancelBooking,
  completeBooking,
};