import crypto from 'node:crypto';

/**
 * Razorpay webhook signature verification (Part 2.2 — MANDATORY).
 *
 * Razorpay signs webhooks by HMAC-SHA256 over the concatenation:
 *
 *     message = `${webhook.body}${"|"}${webhook.timestamp}`
 *     expected = base64( HMAC_SHA256( secret, message ) )
 *
 * and delivers it in the `X-Razorpay-Signature` header alongside
 * `X-Razorpay-Webhook-Id` and `X-Razorpay-Webhook-Timestamp`.
 *
 * We verify using crypto.timingSafeEqual over the raw digests (constant-time
 * comparison) so the comparison is not susceptible to timing side-channels.
 * An unsigned or invalid signature is REJECTED (the caller returns 401).
 */

export interface VerifyResult {
  valid: boolean;
  reason?: string;
}

/**
 * Verify a Razorpay webhook signature.
 *
 * @param body            the raw request body string (exactly as received)
 * @param signatureHeader the X-Razorpay-Signature header value (base64 HMAC)
 * @param timestampHeader the X-Razorpay-Webhook-Timestamp header value
 * @param secret          the webhook secret (from env RAZORPAY_WEBHOOK_SECRET)
 */
export function verifyWebhookSignature(
  body: string,
  signatureHeader: string | undefined,
  timestampHeader: string | undefined,
  secret: string,
): VerifyResult {
  if (!signatureHeader || !timestampHeader) {
    return { valid: false, reason: 'missing signature or timestamp header' };
  }
  if (!secret) {
    return { valid: false, reason: 'webhook secret not configured' };
  }
  try {
    const message = `${body}|${timestampHeader}`;
    const expected = crypto
      .createHmac('sha256', secret)
      .update(message)
      .digest('base64');
    return timingSafeEqualBase64(expected, signatureHeader);
  } catch {
    return { valid: false, reason: 'signature verification failed' };
  }
}

function timingSafeEqualBase64(a: string, b: string): VerifyResult {
  try {
    const bufA = Buffer.from(a, 'base64');
    const bufB = Buffer.from(b, 'base64');
    if (bufA.length !== bufB.length) {
      return { valid: false, reason: 'signature length mismatch' };
    }
    if (!crypto.timingSafeEqual(bufA, bufB)) {
      return { valid: false, reason: 'signature mismatch' };
    }
    return { valid: true };
  } catch {
    return { valid: false, reason: 'unable to decode signature' };
  }
}

/** Helper to compute the expected signature for a payload (used in tests/seeding). */
export function computeSignature(body: string, timestamp: string, secret: string): string {
  const message = `${body}|${timestamp}`;
  return crypto.createHmac('sha256', secret).update(message).digest('base64');
}
