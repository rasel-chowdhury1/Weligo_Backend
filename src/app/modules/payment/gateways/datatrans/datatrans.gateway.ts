import httpStatus from 'http-status';
import AppError from '../../../../error/AppError';
import { generateTransactionReference, toSmallestCurrencyUnit } from '../../payment.utils';
import {
  IPaymentGatewayStrategy,
  TAuthorizePaymentInput,
  TAuthorizePaymentResult,
} from '../gateway.interface';

// ---- Datatrans client ----------------------------------------------------
// docs: https://docs.datatrans.ch  |  api reference: https://api-reference.datatrans.ch
//
// Kept intact for reference/rollback - the active flow now routes card and
// apple_pay to Stripe (see ../stripe/stripe.gateway.ts). Datatrans still
// backs the 'twint' method for anyone rolling back to it, it's just not
// reachable from the current active payment methods (see
// ACTIVE_PAYMENT_METHODS in booking.interface.ts).

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

// authorize-then-capture flow: `authorize` places a hold (autoSettle: false),
// `capture` settles it later, `void` cancels an unsettled hold.
//
// twint caveat: card networks support hold/capture as standard behaviour,
// but twint is normally an instant push payment. Datatrans' own docs flag
// "User on File" as a requirement for the Authorization API with twint,
// which suggests deferred settlement on twint needs the right account
// configuration - run a real hold+settle test in the sandbox before
// assuming this works the same as it does for cards.
export class DatatransPaymentStrategy implements IPaymentGatewayStrategy {
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
