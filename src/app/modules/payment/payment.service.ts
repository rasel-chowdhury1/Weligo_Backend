import mongoose, { FilterQuery } from 'mongoose';
import httpStatus from 'http-status';
import { Booking } from '../booking/booking.model';
import { Payment } from './payment.model';
import { TPaymentMethod, PAYMENT_METHODS, ACTIVE_PAYMENT_METHODS } from '../booking/booking.interface';
import { calculateCommissionSplit } from '../booking/booking.utils';
import { generateTransactionReference } from './payment.utils';
import { IPaymentGatewayStrategy } from './gateways/gateway.interface';
import { DatatransPaymentStrategy } from './gateways/datatrans/datatrans.gateway';
import { verifyDatatransSignature } from './gateways/datatrans/datatrans.utils';
import { StripePaymentStrategy } from './gateways/stripe/stripe.gateway';
import {
  parseStripeWebhookEvent,
  retrieveStripePaymentIntent,
  TNormalizedStripeWebhookEvent,
} from './gateways/stripe/stripe.utils';
import AppError from '../../error/AppError';
import { TPayment } from './payment.interface';

// ---- gateway strategy pattern -------------------------------------------
// Active flow: card / apple_pay -> Stripe. Datatrans remains wired up for
// twint and is kept as a rollback path - see ACTIVE_PAYMENT_METHODS in
// booking.interface.ts, which is what actually keeps twint out of new bookings.

const getPaymentStrategy = (method: TPaymentMethod): IPaymentGatewayStrategy => {
  switch (method) {
    case 'card':
      return new StripePaymentStrategy('card');
    case 'apple_pay':
      return new StripePaymentStrategy('apple_pay');
    case 'twint':
      // not reachable from authorizePaymentIntoDB (ACTIVE_PAYMENT_METHODS
      // guard below) - kept so existing/rolled-back twint payments still work.
      return new DatatransPaymentStrategy(['TWI']);
    default:
      throw new AppError(httpStatus.BAD_REQUEST, `Unsupported payment method: ${method}`);
  }
};

// legacy fallback only: an earlier iteration stored the raw PaymentIntent id
// directly in transactionId (before the Checkout Session redirect flow).
const isLegacyStripePaymentIntentId = (transactionId?: string): boolean =>
  !!transactionId && transactionId.startsWith('pi_');

// capture/void/refund act on a payment that already has a transactionId.
// 'card' used to mean Datatrans and now means Stripe, so paymentMethod alone
// can't be trusted for older records - presence of a Stripe id (Checkout
// Session or PaymentIntent) tells us which gateway actually holds the funds.
const getStrategyForExistingPayment = (payment: TPayment): IPaymentGatewayStrategy => {
  if (
    payment.stripeCheckoutSessionId ||
    payment.stripePaymentIntentId ||
    isLegacyStripePaymentIntentId(payment.transactionId)
  ) {
    return new StripePaymentStrategy(payment.paymentMethod === 'apple_pay' ? 'apple_pay' : 'card');
  }
  return getPaymentStrategy(payment.paymentMethod);
};

// capture/void/refund must target the actual PaymentIntent, never the
// Checkout Session id - Stripe rejects those operations on a session id.
// Returns null when there's genuinely nothing at the gateway yet (a Stripe
// payment still sitting on an unconfirmed Checkout Session, customer never
// completed it) - null is a legitimate case for void, not an error.
const tryGetGatewayTransactionId = (payment: TPayment): string | null => {
  if (payment.stripePaymentIntentId) {
    return payment.stripePaymentIntentId;
  }

  if (isLegacyStripePaymentIntentId(payment.transactionId)) {
    return payment.transactionId as string;
  }

  if (payment.stripeCheckoutSessionId) {
    return null;
  }

  return payment.transactionId ?? null; // Datatrans
};

const getGatewayTransactionId = (payment: TPayment): string => {
  const transactionId = tryGetGatewayTransactionId(payment);

  if (!transactionId) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "This payment's Stripe PaymentIntent has not been linked yet - wait for the checkout webhook to confirm authorization"
    );
  }

  return transactionId;
};

// ---- core service functions ---------------------------------------------

/**
 * Places a hold for a booking. `amount` is passed in rather than computed
 * here - plug in your actual pricing/rate-card logic before calling this.
 * Payment stays "pending" until the webhook confirms the hold succeeded.
 */
const authorizePaymentIntoDB = async (bookingId: string, amount: number) => {
  const booking = await Booking.findById(bookingId);

  if (!booking) {
    throw new AppError(httpStatus.NOT_FOUND, 'Booking not found');
  }

  if (!PAYMENT_METHODS.includes(booking.paymentMethod)) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Booking has no valid payment method set');
  }

  if (!ACTIVE_PAYMENT_METHODS.includes(booking.paymentMethod as (typeof ACTIVE_PAYMENT_METHODS)[number])) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Payment method "${booking.paymentMethod}" is no longer accepted for new bookings`
    );
  }

  const existingPayment = await Payment.findOne({
    booking: booking._id,
    paymentStatus: { $in: ['pending', 'authorized', 'processing', 'captured'] },
  });

  if (existingPayment && existingPayment.paymentStatus !== 'pending') {
    throw new AppError(httpStatus.BAD_REQUEST, 'This booking already has an active payment');
  }

  if (existingPayment) {
    // hold was already requested (e.g. customer refreshed checkout) - reuse it.
    // redirectUrl isn't persisted, so a refreshed checkout can't re-fetch the
    // original Stripe Checkout URL from here; the frontend should fall back to
    // GET /payments/booking/:bookingId and prompt the customer to retry.
    return { payment: existingPayment, redirectUrl: undefined };
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
    bookingId: booking._id.toString(),
    paymentId: payment._id.toString(),
  });

  console.log("gateway result =>>>> ", gatewayResult)

  payment.transactionId = gatewayResult.transactionId;

  // ACTIVE_PAYMENT_METHODS guard above already restricts this path to
  // card/apple_pay, which always route to Stripe - gatewayResult.transactionId
  // is the Checkout Session id here; the real PaymentIntent id only becomes
  // known once the checkout webhook reports it (see handleCheckoutSessionCompleted).
  payment.stripeCheckoutSessionId = gatewayResult.transactionId;

  await payment.save();

  return { payment, redirectUrl: gatewayResult.redirectUrl };
};

/**
 * Called from the webhook once the gateway confirms the hold succeeded.
 * Flips payment to "authorized" and the booking to "confirmed" atomically -
 * the slot is secured even though no money has moved yet.
 */
const confirmAuthorizationIntoDB = async (
  paymentFilter: FilterQuery<TPayment>,
  gatewayPayload: Record<string, unknown>
) => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const payment = await Payment.findOne(paymentFilter).session(session);

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
 * Idempotent reconciliation for Stripe's `payment_intent.succeeded` webhook.
 * The synchronous path (capturePaymentIntoDB, below) is what normally moves
 * a payment to "captured" - this is a safety net in case that process died
 * after the gateway confirmed the capture but before the DB write landed.
 */
const confirmCaptureIntoDB = async (
  paymentFilter: FilterQuery<TPayment>,
  gatewayPayload: Record<string, unknown>
) => {
  const payment = await Payment.findOne(paymentFilter);

  if (!payment) {
    throw new AppError(httpStatus.NOT_FOUND, 'Payment not found for this transaction');
  }

  if (!['authorized', 'processing', 'captured'].includes(payment.paymentStatus)) {
    // unexpected state (e.g. already refunded/voided) - don't clobber it
    return payment;
  }

  if (payment.paymentStatus === 'captured') {
    return payment;
  }

  payment.paymentStatus = 'captured';
  payment.capturedAt = payment.capturedAt ?? new Date();
  payment.gatewayResponse = gatewayPayload;
  await payment.save();

  return payment;
};

/**
 * Idempotent reconciliation for Stripe's `payment_intent.canceled` webhook -
 * same role as confirmCaptureIntoDB but for the void path.
 */
const confirmVoidIntoDB = async (
  paymentFilter: FilterQuery<TPayment>,
  gatewayPayload: Record<string, unknown>
) => {
  const payment = await Payment.findOne(paymentFilter);

  if (!payment) {
    throw new AppError(httpStatus.NOT_FOUND, 'Payment not found for this transaction');
  }

  if (!['pending', 'authorized'].includes(payment.paymentStatus)) {
    // already voided, or moved past voidable state (captured/refunded) - no-op
    return payment;
  }

  payment.paymentStatus = 'voided';
  payment.gatewayResponse = gatewayPayload;
  await payment.save();

  return payment;
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

  const strategy = getStrategyForExistingPayment(payment);
  await strategy.capture(getGatewayTransactionId(payment), payment.amount, payment.currency);

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

  // a Stripe payment still sitting on an unconfirmed Checkout Session (customer
  // never completed it) has no PaymentIntent yet - nothing to cancel at the
  // gateway, the abandoned session simply expires on Stripe's side.
  const gatewayTransactionId = tryGetGatewayTransactionId(payment);

  if (gatewayTransactionId) {
    const strategy = getStrategyForExistingPayment(payment);
    await strategy.void(gatewayTransactionId);
  }

  payment.paymentStatus = 'voided';
  await payment.save();

  return payment;
};

const markPaymentFailedIntoDB = async (
  paymentFilter: FilterQuery<TPayment>,
  gatewayPayload: Record<string, unknown>
) => {
  const payment = await Payment.findOneAndUpdate(
    paymentFilter,
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
    return confirmAuthorizationIntoDB({ transactionId: event.transactionId }, event);
  }

  if (event.status === 'failed' || event.status === 'canceled') {
    return markPaymentFailedIntoDB({ transactionId: event.transactionId }, event);
  }

  return null;
};

// Prefers our own Payment._id (round-tripped via Stripe metadata - see
// stripe.gateway.ts) since it's unambiguous; falls back to whichever Stripe
// id(s) this particular event carries.
const resolveStripePaymentFilter = (event: TNormalizedStripeWebhookEvent): FilterQuery<TPayment> => {
  if (event.paymentId) {
    return { _id: event.paymentId };
  }

  const or: FilterQuery<TPayment>[] = [];

  if (event.paymentIntentId) {
    or.push({ stripePaymentIntentId: event.paymentIntentId }, { transactionId: event.paymentIntentId });
  }

  if (event.checkoutSessionId) {
    or.push({ stripeCheckoutSessionId: event.checkoutSessionId }, { transactionId: event.checkoutSessionId });
  }

  if (!or.length) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Stripe webhook event has no identifiable payment reference');
  }

  return { $or: or };
};

// Persists whichever Stripe id(s) this event carries. checkout.session.* and
// payment_intent.* events can arrive in either order, so this runs ahead of
// every event type below rather than only inside the checkout.session.completed
// handler - the PaymentIntent id needs to be linked exactly once, regardless
// of which event happens to report it first.
const linkStripeIdentifiers = async (
  paymentFilter: FilterQuery<TPayment>,
  ids: { checkoutSessionId?: string; paymentIntentId?: string }
) => {
  const payment = await Payment.findOne(paymentFilter);

  if (!payment) {
    return;
  }

  let changed = false;

  if (ids.checkoutSessionId && payment.stripeCheckoutSessionId !== ids.checkoutSessionId) {
    payment.stripeCheckoutSessionId = ids.checkoutSessionId;
    changed = true;
  }

  if (ids.paymentIntentId && payment.stripePaymentIntentId !== ids.paymentIntentId) {
    payment.stripePaymentIntentId = ids.paymentIntentId;
    changed = true;
  }

  if (changed) {
    await payment.save();
  }
};

/**
 * checkout.session.completed fires when the customer finishes Stripe
 * Checkout, but it's NOT proof of an authorized hold by itself - with
 * capture_method: 'manual' the session's own payment_status can still be
 * 'unpaid' at this point (funds are authorized, not captured). So instead of
 * trusting the event, this retrieves the real PaymentIntent and acts on its
 * actual status - the same authority the payment_intent.* events below use
 * directly when they arrive on their own.
 */
const handleCheckoutSessionCompleted = async (
  paymentFilter: FilterQuery<TPayment>,
  event: TNormalizedStripeWebhookEvent
) => {
  if (!event.paymentIntentId) {
    // checkout completed without ever creating a PaymentIntent (e.g. a
    // $0 line item or another edge case) - nothing to reconcile
    return null;
  }

  const paymentIntent = await retrieveStripePaymentIntent(event.paymentIntentId);
  const payload = paymentIntent as unknown as Record<string, unknown>;

  switch (paymentIntent.status) {
    case 'requires_capture':
      return confirmAuthorizationIntoDB(paymentFilter, payload);
    case 'succeeded':
      return confirmCaptureIntoDB(paymentFilter, payload);
    case 'canceled':
      return confirmVoidIntoDB(paymentFilter, payload);
    default:
      // requires_payment_method / requires_action / processing - ids are
      // already linked above, nothing else to do until a follow-up event
      return null;
  }
};

/**
 * Single entry point for Stripe webhooks. Verifies the Stripe-Signature
 * header via the Stripe SDK (see gateways/stripe/stripe.utils.ts), then
 * routes based on the Checkout Session / PaymentIntent lifecycle event.
 * Every handler below is status-guarded, so replayed/duplicate events are
 * safe no-ops and never confirm a booking or move money twice.
 */
const handleStripeWebhookEvent = async (rawBody: Buffer, signatureHeader: string) => {
  const event = parseStripeWebhookEvent(rawBody, signatureHeader);
  const paymentFilter = resolveStripePaymentFilter(event);

  if (event.checkoutSessionId || event.paymentIntentId) {
    await linkStripeIdentifiers(paymentFilter, {
      checkoutSessionId: event.checkoutSessionId,
      paymentIntentId: event.paymentIntentId,
    });
  }

  switch (event.type) {
    case 'checkout.session.completed':
      return handleCheckoutSessionCompleted(paymentFilter, event);

    // fires when the PaymentIntent enters requires_capture - i.e. the hold
    // succeeded. Equivalent to Datatrans' "authorized" status.
    case 'payment_intent.amount_capturable_updated':
      return confirmAuthorizationIntoDB(paymentFilter, event.payload);

    // fires once a manual capture completes - reconciliation safety net,
    // capturePaymentIntoDB is the primary path that sets this.
    case 'payment_intent.succeeded':
      return confirmCaptureIntoDB(paymentFilter, event.payload);

    case 'payment_intent.payment_failed':
      return markPaymentFailedIntoDB(paymentFilter, {
        reason: event.failureReason ?? 'Stripe payment failed',
        ...event.payload,
      });

    // reconciliation safety net for voidPaymentIntoDB
    case 'payment_intent.canceled':
      return confirmVoidIntoDB(paymentFilter, event.payload);

    default:
      return null;
  }
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

  const strategy = getStrategyForExistingPayment(payment);
  await strategy.refund(getGatewayTransactionId(payment), amount, payment.currency);

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
  handleStripeWebhookEvent,
  refundPaymentFromDB,
  getPaymentByIdFromDB,
  getPaymentByBookingFromDB,
};
