import { Request, Response } from 'express';
import httpStatus from 'http-status';
import catchAsync from '../../utils/catchAsync'; // adjust to your actual utility path
import sendResponse from '../../utils/sendResponse'; // adjust to your actual utility path
import { paymentService } from './payment.service';
import AppError from '../../error/AppError';

const handleWebhook = catchAsync(async (req: Request, res: Response) => {

  const signatureHeader = req.header('Datatrans-Signature') as string;

  // rawBody is attached in app.ts via express.json({ verify }) - see notes.
  // signature verification needs the exact original bytes, not a re-serialized req.body
  const rawBodyBuffer = (req as Request & { rawBody?: Buffer }).rawBody;
 
  if (!rawBodyBuffer) {
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      'req.rawBody is missing - check that express.json({ verify }) is registered in app.ts before any routes'
    );
  }
 
  const rawBody = rawBodyBuffer.toString('utf8');

  try {
    const result =  await paymentService.handlePaymentWebhook(rawBody, signatureHeader);
    console.log("result =>>> ", result)
  } catch (error) {
    console.log("error from handle web hook ==>>> ", rawBodyBuffer)
  }



  // Datatrans just needs a 2xx to stop retrying - no response body required
  res.sendStatus(httpStatus.OK);
});

const handleStripeWebhook = catchAsync(async (req: Request, res: Response) => {
  const signatureHeader = req.header('stripe-signature') as string;

  // rawBody is attached in app.ts via express.json({ verify }) - same
  // mechanism the Datatrans webhook above relies on. Stripe's signature
  // verification needs the exact original bytes, not a re-serialized req.body.
  const rawBodyBuffer = (req as Request & { rawBody?: Buffer }).rawBody;

  if (!rawBodyBuffer) {
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      'req.rawBody is missing - check that express.json({ verify }) is registered in app.ts before any routes'
    );
  }

  await paymentService.handleStripeWebhookEvent(rawBodyBuffer, signatureHeader);

  // Stripe just needs a 2xx to stop retrying - no response body required
  res.sendStatus(httpStatus.OK);
});

const getPayment = catchAsync(async (req: Request, res: Response) => {
  const result = await paymentService.getPaymentByIdFromDB(req.params.paymentId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Payment retrieved successfully',
    data: result,
  });
});

const getPaymentByBooking = catchAsync(async (req: Request, res: Response) => {
  const result = await paymentService.getPaymentByBookingFromDB(req.params.bookingId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Payment retrieved successfully',
    data: result,
  });
});

const getMyTransactions = catchAsync(async (req: Request, res: Response) => {
  const { userId, role } = req.user;

  const result = await paymentService.getMyTransactionsFromDB(userId, role, req.query);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    meta: result.meta,
    message: 'Transactions retrieved successfully',
    data: result.result,
  });
});

const getAllTransactions = catchAsync(async (req: Request, res: Response) => {
  const result = await paymentService.getAllTransactionsFromDB(req.query);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    meta: result.meta,
    message: 'Transactions retrieved successfully',
    data: result.result,
  });
});

const refundPayment = catchAsync(async (req: Request, res: Response) => {
  const { amount, reason } = req.body;

  const result = await paymentService.refundPaymentFromDB(req.params.paymentId, amount, reason);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Refund processed successfully',
    data: result,
  });
});

export const paymentController = {
  handleWebhook,
  handleStripeWebhook,
  getPayment,
  getPaymentByBooking,
  getMyTransactions,
  getAllTransactions,
  refundPayment,
};