import httpStatus from 'http-status';
import Stripe from 'stripe';
import AppError from '../../../../error/AppError';

let stripeClient: Stripe | null = null;

export const getStripeClient = (): Stripe => {
  if (!stripeClient) {
    const secretKey = process.env.STRIPE_SECRET_KEY;

    if (!secretKey) {
      throw new AppError(
        httpStatus.INTERNAL_SERVER_ERROR,
        'STRIPE_SECRET_KEY is not configured'
      );
    }

    stripeClient = new Stripe(secretKey);
  }

  return stripeClient;
};

// Normalized shape so payment.service.ts (gateway-agnostic) never has to
// import Stripe SDK types directly - keeps the strategy pattern boundary clean.
//
// No single id reliably identifies the Payment record across every event:
// checkout.session.* events carry a Session (id "cs_...", matching
// payment.stripeCheckoutSessionId/transactionId at authorize time) while
// payment_intent.* events carry a PaymentIntent (id "pi_...", matching
// payment.stripePaymentIntentId once the checkout webhook has linked it).
// `paymentId` is our own internal Payment._id, round-tripped via the
// metadata set on both the Session and its PaymentIntent at creation - it's
// the preferred, unambiguous lookup key; the two Stripe ids are exposed as a
// fallback for events where metadata is missing for any reason.
export type TNormalizedStripeWebhookEvent = {
  type: Stripe.Event.Type;
  paymentId?: string;
  checkoutSessionId?: string;
  paymentIntentId?: string;
  payload: Record<string, unknown>;
  failureReason?: string;
};

// Verifies the `Stripe-Signature` header using Stripe's own SDK helper.
// Must be called with the raw request bytes (Buffer), never
// JSON.stringify(req.body) - re-serializing can reorder/reformat and break
// the signature, same caveat as the Datatrans verifier.
export const parseStripeWebhookEvent = (
  rawBody: Buffer,
  signatureHeader: string
): TNormalizedStripeWebhookEvent => {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      'STRIPE_WEBHOOK_SECRET is not configured'
    );
  }

  let event: Stripe.Event;

  try {
    event = getStripeClient().webhooks.constructEvent(rawBody, signatureHeader, webhookSecret);
  } catch (error) {
    throw new AppError(httpStatus.UNAUTHORIZED, 'Invalid Stripe webhook signature');
  }

  console.log('Stripe webhook event type', event.type);

  // checkout.session.* events carry a Checkout Session object (id "cs_...").
  // session.payment_intent is only present once the customer has actually
  // submitted payment details - may still be null/absent for e.g. an
  // abandoned/expired session.
  if (event.type.startsWith('checkout.session.')) {
    const session = event.data.object as Stripe.Checkout.Session;
    const paymentIntentId =
      typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id;

    return {
      type: event.type,
      paymentId: session.metadata?.paymentId || undefined,
      checkoutSessionId: session.id,
      paymentIntentId,
      payload: session as unknown as Record<string, unknown>,
    };
  }

  // every other PaymentIntent lifecycle event carries the PaymentIntent itself.
  const paymentIntent = event.data.object as Stripe.PaymentIntent;

  return {
    type: event.type,
    paymentId: paymentIntent.metadata?.paymentId || undefined,
    paymentIntentId: paymentIntent.id,
    payload: paymentIntent as unknown as Record<string, unknown>,
    failureReason: paymentIntent.last_payment_error?.message,
  };
};

// Used when checkout.session.completed reports a PaymentIntent for the first
// time - checkout.session.completed alone doesn't guarantee the PaymentIntent
// is capturable (capture_method: 'manual' can still leave it 'processing'),
// so we read its real status back from Stripe rather than assuming.
export const retrieveStripePaymentIntent = async (
  paymentIntentId: string
): Promise<Stripe.PaymentIntent> => {
  try {
    return await getStripeClient().paymentIntents.retrieve(paymentIntentId);
  } catch (error) {
    throw new AppError(httpStatus.BAD_GATEWAY, 'Failed to retrieve the Stripe PaymentIntent');
  }
};
