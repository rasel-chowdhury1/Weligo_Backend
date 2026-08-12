import mongoose from 'mongoose';
import httpStatus from 'http-status';
import { Booking } from '../booking/booking.model';
import { Payment } from './payment.model';
import { TPaymentMethod, PAYMENT_METHODS } from '../booking/booking.interface';
import { calculateCommissionSplit } from '../booking/booking.utils';
import {
  generateTransactionReference,
  toSmallestCurrencyUnit,
  verifyDatatransSignature,
} from './payment.utils';
import AppError from '../../error/AppError';

// ---- Datatrans client ----------------------------------------------------
// docs: https://docs.datatrans.ch  |  api reference: https://api-reference.datatrans.ch

const DATATRANS_BASE_URL =
  process.env.DATATRANS_BASE_URL ?? 'https://api.sandbox.datatrans.com';

const DATATRANS_PAY_BASE_URL = DATATRANS_BASE_URL.includes('sandbox')
  ? 'https://pay.sandbox.datatrans.com'
  : 'https://pay.datatrans.com';

const getDatatransAuthHeader = (): string => {
  const merchantId = process.env.DATATRANS_MERCHANT_ID as string;
  const password = process.env.DATATRANS_PASSWORD as string;
  return `Basic ${Buffer.from(`${merchantId}:${password}`).toString('base64')}`;
};

const datatransRequest = async (path: string, body?: Record<string, unknown>) => {
  const response = await fetch(`${DATATRANS_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      Authorization: getDatatransAuthHeader(),
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new AppError(
      httpStatus.BAD_GATEWAY,
      (data?.error?.message as string) ?? 'Datatrans request failed'
    );
  }

  return data;
};

// ---- gateway strategy pattern -------------------------------------------
// authorize-then-capture flow: `authorize` places a hold (autoSettle: false),
// `capture` settles it later, `void` cancels an unsettled hold.
//
// twint caveat: card networks support hold/capture as standard behaviour,
// but twint is normally an instant push payment. Datatrans' own docs flag
// "User on File" as a requirement for the Authorization API with twint,
// which suggests deferred settlement on twint needs the right account
// configuration - run a real hold+settle test in the sandbox before
// assuming this works the same as it does for cards.

type TAuthorizePaymentInput = {
  amount: number; // major currency unit, e.g. 58.00 CHF
  currency: string;
  reference: string;
};

type TAuthorizePaymentResult = {
  transactionId: string;
  redirectUrl?: string; // customer completes the hold via QR scan or 3DS here
};

interface IPaymentGatewayStrategy {
  authorize(input: TAuthorizePaymentInput): Promise<TAuthorizePaymentResult>;
  capture(transactionId: string, amount: number, currency: string): Promise<{ captureId: string }>;
  void(transactionId: string): Promise<{ voided: boolean }>;
  refund(transactionId: string, amount: number, currency: string): Promise<{ refundId: string }>;
}

class DatatransPaymentStrategy implements IPaymentGatewayStrategy {
  constructor(private readonly paymentMethods: string[]) {}

  async authorize(input: TAuthorizePaymentInput): Promise<TAuthorizePaymentResult> {
    const amountInMinorUnits = toSmallestCurrencyUnit(input.amount, input.currency);

    const data = await datatransRequest('/v1/transactions', {
      currency: input.currency,
      refno: input.reference,
      amount: amountInMinorUnits,
      paymentMethods: this.paymentMethods, // ['TWI'] for twint, ['ECA','VIS'] for card
      autoSettle: false, // this is the hold - money isn't captured until you call /settle
      redirect: {
        successUrl: `${process.env.APP_BASE_URL}/payments/return?status=success`,
        cancelUrl: `${process.env.APP_BASE_URL}/payments/return?status=cancel`,
        errorUrl: `${process.env.APP_BASE_URL}/payments/return?status=error`,
      },
    });

    return {
      transactionId: data.transactionId as string,
      redirectUrl: `${DATATRANS_PAY_BASE_URL}/v1/start/${data.transactionId}`,
    };
  }

  async capture(transactionId: string, amount: number, currency: string) {
    // NB: confirm the exact required fields for /settle against your API
    // reference version - amount/currency/refno match Datatrans' general
    // pattern but this endpoint isn't fully documented in the public JSON ref
    await datatransRequest(`/v1/transactions/${transactionId}/settle`, {
      amount: toSmallestCurrencyUnit(amount, currency),
      currency,
      refno: generateTransactionReference('CAP'),
    });

    return { captureId: transactionId };
  }

  async void(transactionId: string) {
    await datatransRequest(`/v1/transactions/${transactionId}/cancel`);
    return { voided: true };
  }

  async refund(transactionId: string, amount: number, currency: string) {
    const data = await datatransRequest(`/v1/transactions/${transactionId}/credit`, {
      amount: toSmallestCurrencyUnit(amount, currency),
      currency,
      refno: generateTransactionReference('RFD'),
    });

    return { refundId: (data.transactionId as string) ?? generateTransactionReference('RFD') };
  }
}

const getPaymentStrategy = (method: TPaymentMethod): IPaymentGatewayStrategy => {
  switch (method) {
    case 'twint':
      return new DatatransPaymentStrategy(['TWI']);
    case 'card':
      return new DatatransPaymentStrategy(['ECA', 'VIS']); // Mastercard, Visa - add AMX etc. if needed
    default:
      throw new AppError(httpStatus.BAD_REQUEST, `Unsupported payment method: ${method}`);
  }
};

// ---- core service functions ---------------------------------------------

/**
 * Places a hold for a booking. `amount` is passed in rather than computed
 * here - plug in your actual pricing/rate-card logic before calling this.
 * Payment stays "pending" until the webhook confirms the hold succeeded.
 */
const authorizePaymentIntoDB = async (bookingId: string, amount: number) => {
  const booking = await Booking.findById(bookingId);
try {
    

  if (!booking) {
    throw new AppError(httpStatus.NOT_FOUND, 'Booking not found');
  }

  if (!PAYMENT_METHODS.includes(booking.paymentMethod)) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Booking has no valid payment method set');
  }

  const existingPayment = await Payment.findOne({
    booking: booking._id,
    paymentStatus: { $in: ['pending', 'authorized', 'processing', 'captured'] },
  });

  if (existingPayment && existingPayment.paymentStatus !== 'pending') {
    throw new AppError(httpStatus.BAD_REQUEST, 'This booking already has an active payment');
  }

  if (existingPayment) {
    // hold was already requested (e.g. customer refreshed checkout) - reuse it
    return existingPayment;
  }

  const currency = 'CHF';
  const { commissionAmount, providerEarning } = calculateCommissionSplit(amount);

  const payment = await Payment.create({
    booking: booking._id,
    payer: booking.customer,
    amount,
    commissionAmount,
    providerEarning,
    currency,
    paymentMethod: booking.paymentMethod,
    paymentStatus: 'pending',
    gatewayReference: generateTransactionReference('REF'),
  });

  const strategy = getPaymentStrategy(booking.paymentMethod);

  const gatewayResult = await strategy.authorize({
    amount,
    currency,
    reference: payment.gatewayReference as string,
  });

  console.log({gatewayResult})

  payment.transactionId = gatewayResult.transactionId;
  await payment.save();

  return { payment, redirectUrl: gatewayResult.redirectUrl };

  } catch (error) {
    console.log("error =>>>>>>>>>>>>>>> ", error)
}
};

/**
 * Called from the webhook once Datatrans confirms the hold succeeded.
 * Flips payment to "authorized" and the booking to "confirmed" atomically -
 * the slot is secured even though no money has moved yet.
 */
const confirmAuthorizationIntoDB = async (
  transactionId: string,
  gatewayPayload: Record<string, unknown>
) => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const payment = await Payment.findOne({ transactionId }).session(session);

    if (!payment) {
      throw new AppError(httpStatus.NOT_FOUND, 'Payment not found for this transaction');
    }

    // webhook retried after success - don't reprocess
    if (payment.paymentStatus === 'authorized') {
      await session.commitTransaction();
      session.endSession();
      return payment;
    }

    payment.paymentStatus = 'authorized';
    payment.authorizedAt = new Date();
    payment.gatewayResponse = gatewayPayload;
    await payment.save({ session });

    const booking = await Booking.findByIdAndUpdate(
      payment.booking,
      { status: 'confirmed', payment: payment._id },
      { new: true, session }
    );

    if (!booking) {
      throw new AppError(httpStatus.NOT_FOUND, 'Booking not found for this payment');
    }

    await session.commitTransaction();
    session.endSession();

    return payment;
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};

/**
 * Charges a previously authorized hold. Called from
 * bookingService.completeBookingIntoDB once the service is delivered.
 */
const capturePaymentIntoDB = async (paymentId: string) => {
  const payment = await Payment.findById(paymentId);

  if (!payment) {
    throw new AppError(httpStatus.NOT_FOUND, 'Payment not found');
  }

  if (payment.paymentStatus !== 'authorized') {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Only authorized payments can be captured (current status: ${payment.paymentStatus})`
    );
  }

  const strategy = getPaymentStrategy(payment.paymentMethod);
  await strategy.capture(payment.transactionId as string, payment.amount, payment.currency);

  payment.paymentStatus = 'captured';
  payment.capturedAt = new Date();
  await payment.save();

  return payment;
};

/**
 * Releases a hold without charging anything - use this when a booking is
 * cancelled before the payment was ever captured.
 */
const voidPaymentIntoDB = async (paymentId: string) => {
  const payment = await Payment.findById(paymentId);

  if (!payment) {
    throw new AppError(httpStatus.NOT_FOUND, 'Payment not found');
  }

  if (!['pending', 'authorized'].includes(payment.paymentStatus)) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Only pending or authorized payments can be voided (current status: ${payment.paymentStatus})`
    );
  }

  if (payment.transactionId) {
    const strategy = getPaymentStrategy(payment.paymentMethod);
    await strategy.void(payment.transactionId);
  }

  payment.paymentStatus = 'voided';
  await payment.save();

  return payment;
};

const markPaymentFailedIntoDB = async (
  transactionId: string,
  gatewayPayload: Record<string, unknown>
) => {
  const payment = await Payment.findOneAndUpdate(
    { transactionId },
    {
      paymentStatus: 'failed',
      failureReason: (gatewayPayload?.reason as string) ?? 'Payment failed at the gateway',
      gatewayResponse: gatewayPayload,
    },
    { new: true }
  );

  if (!payment) {
    throw new AppError(httpStatus.NOT_FOUND, 'Payment not found for this transaction');
  }

  return payment;
};

/**
 * Single entry point for Datatrans webhooks. Verifies the Datatrans-Signature
 * header first, then routes based on the transaction status in the payload.
 * Status values below (authorized/settled/canceled/failed) match Datatrans'
 * documented lifecycle - confirm against a real sandbox webhook payload
 * before going live, field names can vary slightly by API version.
 */
const handlePaymentWebhook = async (rawBody: string, signatureHeader: string) => {
  const hmacKey = process.env.DATATRANS_WEBHOOK_HMAC_KEY as string;

  const isValidSignature = verifyDatatransSignature(rawBody, signatureHeader, hmacKey);

  if (!isValidSignature) {
    throw new AppError(httpStatus.UNAUTHORIZED, 'Invalid webhook signature');
  }

  const event = JSON.parse(rawBody) as {
    transactionId: string;
    status: 'authorized' | 'settled' | 'canceled' | 'failed' | string;
    [key: string]: unknown;
  };

  if (event.status === 'authorized') {
    return confirmAuthorizationIntoDB(event.transactionId, event);
  }

  if (event.status === 'failed' || event.status === 'canceled') {
    return markPaymentFailedIntoDB(event.transactionId, event);
  }

  return null;
};

const refundPaymentFromDB = async (paymentId: string, amount: number, reason: string) => {
  const payment = await Payment.findById(paymentId);

  if (!payment) {
    throw new AppError(httpStatus.NOT_FOUND, 'Payment not found');
  }

  if (!['captured', 'partially-refunded'].includes(payment.paymentStatus)) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Only captured payments can be refunded');
  }

  const refundableAmount = payment.amount - payment.refundedAmount;

  if (amount > refundableAmount) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Refund amount exceeds the refundable balance');
  }

  const strategy = getPaymentStrategy(payment.paymentMethod);
  await strategy.refund(payment.transactionId as string, amount, payment.currency);

  payment.refundedAmount += amount;
  payment.refundReason = reason;
  payment.paymentStatus =
    payment.refundedAmount >= payment.amount ? 'refunded' : 'partially-refunded';

  await payment.save();

  return payment;
};

const getPaymentByIdFromDB = async (paymentId: string) => {
  const payment = await Payment.findById(paymentId);

  if (!payment) {
    throw new AppError(httpStatus.NOT_FOUND, 'Payment not found');
  }

  return payment;
};

const getPaymentByBookingFromDB = async (bookingId: string) => {
  const payment = await Payment.findOne({ booking: bookingId }).sort({ createdAt: -1 });

  if (!payment) {
    throw new AppError(httpStatus.NOT_FOUND, 'No payment found for this booking');
  }

  return payment;
};

export const paymentService = {
  authorizePaymentIntoDB,
  confirmAuthorizationIntoDB,
  capturePaymentIntoDB,
  voidPaymentIntoDB,
  markPaymentFailedIntoDB,
  handlePaymentWebhook,
  refundPaymentFromDB,
  getPaymentByIdFromDB,
  getPaymentByBookingFromDB,
};