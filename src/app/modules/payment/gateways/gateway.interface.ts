// Shared contract both gateway implementations (Datatrans and Stripe) conform to.
// Moved out of payment.service.ts so gateway code can live under gateways/<name>/
// without a circular import back into the service.

export type TAuthorizePaymentInput = {
  amount: number; // major currency unit, e.g. 58.00 CHF
  currency: string;
  reference: string; // our internal gatewayReference, kept separate from the gateway's own id
  bookingId?: string; // passed through as gateway metadata where supported (e.g. Stripe PaymentIntent metadata)
  paymentId?: string;
};

export type TAuthorizePaymentResult = {
  transactionId: string;
  // customer completes the hold on the gateway's hosted page - Datatrans' own
  // checkout page, or a Stripe Checkout Session URL (session.url).
  redirectUrl?: string;
};

export interface IPaymentGatewayStrategy {
  authorize(input: TAuthorizePaymentInput): Promise<TAuthorizePaymentResult>;
  capture(transactionId: string, amount: number, currency: string): Promise<{ captureId: string }>;
  void(transactionId: string): Promise<{ voided: boolean }>;
  refund(transactionId: string, amount: number, currency: string): Promise<{ refundId: string }>;
}
