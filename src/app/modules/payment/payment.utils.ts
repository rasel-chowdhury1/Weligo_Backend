import crypto from 'crypto';

// gateways operate in the smallest currency unit (Rappen for CHF, cents for EUR/USD).
// extend this list if you ever support a zero-decimal currency like JPY.
const ZERO_DECIMAL_CURRENCIES: string[] = [];

export const toSmallestCurrencyUnit = (amount: number, currency: string): number => {
  if (ZERO_DECIMAL_CURRENCIES.includes(currency)) {
    return Math.round(amount);
  }
  return Math.round(amount * 100);
};

export const fromSmallestCurrencyUnit = (amount: number, currency: string): number => {
  if (ZERO_DECIMAL_CURRENCIES.includes(currency)) {
    return amount;
  }
  return amount / 100;
};

export const formatCurrency = (amount: number, currency: string): string => {
  return new Intl.NumberFormat('de-CH', {
    style: 'currency',
    currency,
  }).format(amount);
};

// prefix lets you tell at a glance which flow a reference came from,
// e.g. TWINT-..., CARD-..., RFD-... for refunds
export const generateTransactionReference = (prefix = 'TXN'): string => {
  const randomPart = crypto.randomBytes(6).toString('hex').toUpperCase();
  return `${prefix}-${Date.now()}-${randomPart}`;
};

export const isSupportedPaymentMethod = (
  method: string,
  supportedMethods: readonly string[]
): boolean => supportedMethods.includes(method);

// Datatrans signs webhooks via the `Datatrans-Signature` header, formatted as
// "t=<timestamp>,s0=<hexSignature>". The signed content is the timestamp
// concatenated directly with the raw request body, HMAC-SHA256'd with your
// hex-encoded Datatrans HMAC key (Webadmin > Security > enable webhook signing).
// Must be checked against the raw request bytes, not JSON.stringify(req.body) -
// re-serializing can reorder/reformat and break the signature.
export const verifyDatatransSignature = (
  rawBody: string,
  signatureHeader: string,
  hmacKeyHex: string
): boolean => {
  const parts = Object.fromEntries(
    signatureHeader.split(',').map((part) => part.split('=') as [string, string])
  );

  const timestamp = parts.t;
  const expectedSignature = parts.s0;

  if (!timestamp || !expectedSignature) {
    return false;
  }

  const key = Buffer.from(hmacKeyHex, 'hex');
  const signedContent = `${timestamp}${rawBody}`;

  const computedSignature = crypto.createHmac('sha256', key).update(signedContent).digest('hex');

  try {
    return crypto.timingSafeEqual(Buffer.from(computedSignature), Buffer.from(expectedSignature));
  } catch {
    return false;
  }
};