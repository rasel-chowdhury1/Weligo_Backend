import { Types, Model } from 'mongoose';
import { TPaymentMethod } from '../booking/booking.interface';

export const PAYMENT_STATUSES = [
  'pending', // record created, not yet sent to the gateway
  'authorized', // hold placed on the customer's funds, not yet captured
  'processing', // capture requested, awaiting gateway confirmation
  'captured', // held funds have actually been charged/settled
  'failed', // authorization or capture failed at the gateway
  'voided', // hold released without charging (e.g. booking cancelled before capture)
  'refunded',
  'partially-refunded',
  'cancelled',
] as const;
export type TPaymentStatus = (typeof PAYMENT_STATUSES)[number];

// CHF default since twint is a Swiss-only payment method
export const CURRENCIES = ['CHF', 'EUR', 'USD'] as const;
export type TCurrency = (typeof CURRENCIES)[number];

export type TPayment = {
  booking: Types.ObjectId; // ref: Booking
  payer: Types.ObjectId; // ref: User

  amount: number; // total amount charged to the customer
  commissionAmount: number; // platform's cut of amount
  providerEarning: number; // amount - commissionAmount, what the provider receives
  currency: TCurrency;

  paymentMethod: TPaymentMethod; // 'twint' | 'card'
  paymentStatus: TPaymentStatus;

  transactionId?: string; // charge id returned by the gateway
  gatewayReference?: string; // twint/card reference used for reconciliation

  // Stripe-specific identifiers - only populated for Stripe-routed payments.
  // transactionId holds the Checkout Session id immediately after authorize();
  // Checkout doesn't create/attach a PaymentIntent until the customer actually
  // submits payment details, so stripePaymentIntentId is only filled in once
  // the webhook reports it (see linkStripeCheckoutSession in payment.service.ts).
  stripeCheckoutSessionId?: string;
  stripePaymentIntentId?: string;

  authorizedAt?: Date; // when the hold was placed
  capturedAt?: Date; // when the held funds were actually charged

  refundedAmount: number;
  refundReason?: string;
  failureReason?: string;

  gatewayResponse?: Record<string, unknown>; // raw payload, kept for debugging/audit

  createdAt: Date;
  updatedAt: Date;
};

export type PaymentModel = Model<TPayment>;