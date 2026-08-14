import crypto from 'crypto';

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
