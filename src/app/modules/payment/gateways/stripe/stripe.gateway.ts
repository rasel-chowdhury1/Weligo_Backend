import httpStatus from 'http-status';
import Stripe from 'stripe';
import AppError from '../../../../error/AppError';
import { toSmallestCurrencyUnit } from '../../payment.utils';
import {
  IPaymentGatewayStrategy,
  TAuthorizePaymentInput,
  TAuthorizePaymentResult,
} from '../gateway.interface';
import { getStripeClient } from './stripe.utils';

// docs: https://stripe.com/docs/payments/checkout/place-a-hold-on-a-payment-method
//
// authorize-then-capture flow, mirroring the Datatrans strategy:
// `authorize` creates a Checkout Session whose underlying PaymentIntent has
// capture_method: 'manual' (the hold-to-be). Unlike a direct PaymentIntent
// call, Checkout does NOT attach a PaymentIntent until the customer actually
// submits payment details on the hosted page - session.payment_intent is
// null right after creation. So `transactionId` here is the Checkout Session
// id (cs_...), used only to look the Payment record back up when the
// checkout.session.completed webhook arrives; the real PaymentIntent id
// (pi_...) that `capture`/`void`/`refund` need is captured by
// payment.service.ts from that webhook and stored separately as
// payment.stripePaymentIntentId (see gateways/stripe/stripe.utils.ts).
//
// Apple Pay isn't a separate Stripe payment_method_type - it's offered
// automatically on the Checkout page through the `card` type once the
// customer's device/browser is eligible and the domain is verified for
// Apple Pay in the Stripe Dashboard. The session config below is identical
// for 'card' and 'apple_pay'; `paymentMethod` is only kept for metadata/logging.
const toAppError = (error: unknown, fallbackMessage: string): AppError => {
  if (error instanceof AppError) {
    return error;
  }
  if (error instanceof Stripe.errors.StripeError) {
    return new AppError(httpStatus.BAD_GATEWAY, error.message || fallbackMessage);
  }
  return new AppError(httpStatus.BAD_GATEWAY, fallbackMessage);
};

export class StripePaymentStrategy implements IPaymentGatewayStrategy {
  constructor(private readonly paymentMethod: 'card' | 'apple_pay') {}

  async authorize(input: TAuthorizePaymentInput): Promise<TAuthorizePaymentResult> {
    const stripe = getStripeClient();
    const amountInSmallestUnit = toSmallestCurrencyUnit(input.amount, input.currency);
    const appBaseUrl = process.env.APP_BASE_URL;

    try {
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        payment_method_types: ['card'], // covers both card and Apple Pay, see class comment
        line_items: [
          {
            price_data: {
              currency: input.currency.toLowerCase(),
              unit_amount: amountInSmallestUnit,
              product_data: {
                name: `Booking payment ${input.reference}`,
              },
            },
            quantity: 1,
          },
        ],
        payment_intent_data: {
          capture_method: 'manual', // authorize now, capture later once the booking/service is completed
          metadata: {
            bookingId: input.bookingId ?? '',
            paymentId: input.paymentId ?? '',
            gatewayReference: input.reference,
            paymentMethod: this.paymentMethod,
          },
        },
        metadata: {
          bookingId: input.bookingId ?? '',
          paymentId: input.paymentId ?? '',
          gatewayReference: input.reference,
        },
        success_url: `${appBaseUrl}/payments/return?status=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${appBaseUrl}/payments/return?status=cancel`,
      });

      if (!session.url) {
        throw new AppError(httpStatus.BAD_GATEWAY, 'Stripe did not return a checkout URL');
      }

      console.log('Stripe Checkout Session created', session.id);

      // session.payment_intent is intentionally NOT read here - it's null
      // until the customer submits payment details on the hosted page. The
      // Checkout Session id is what we track until the webhook resolves it.
      return {
        transactionId: session.id,
        redirectUrl: session.url,
      };
    } catch (error) {
      throw toAppError(error, 'Stripe checkout session creation failed');
    }
  }

  async capture(transactionId: string, amount: number, currency: string) {
    const stripe = getStripeClient();

    try {
      const paymentIntent = await stripe.paymentIntents.capture(transactionId, {
        amount_to_capture: toSmallestCurrencyUnit(amount, currency),
      });

      return { captureId: paymentIntent.id };
    } catch (error) {
      throw toAppError(error, 'Stripe capture failed');
    }
  }

  async void(transactionId: string) {
    const stripe = getStripeClient();

    try {
      await stripe.paymentIntents.cancel(transactionId);
      return { voided: true };
    } catch (error) {
      throw toAppError(error, 'Stripe cancellation failed');
    }
  }

  async refund(transactionId: string, amount: number, currency: string) {
    const stripe = getStripeClient();

    try {
      const refund = await stripe.refunds.create({
        payment_intent: transactionId,
        amount: toSmallestCurrencyUnit(amount, currency),
      });

      return { refundId: refund.id };
    } catch (error) {
      throw toAppError(error, 'Stripe refund failed');
    }
  }
}
