import { describe, it, expect } from 'vitest';
import { verifyWebhookSignature, computeSignature } from '../src/services/webhookSignature.js';

const SECRET = 'test_webhook_secret_123';
const TIMESTAMP = '1588670992';

describe('Webhook signature verification (Part 2.2 / Part 7.1)', () => {
  const body = JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: { id: 'pay_0001', amount: 10000 } } } });

  it('accepts a valid signature (verify(vailid) -> VALID)', () => {
    const sig = computeSignature(body, TIMESTAMP, SECRET);
    const result = verifyWebhookSignature(body, sig, TIMESTAMP, SECRET);
    expect(result.valid).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it('rejects a tampered body (verify(invalid body) -> INVALID)', () => {
    const sig = computeSignature(body, TIMESTAMP, SECRET);
    const tampered = body.replace('pay_0001', 'pay_9999');
    const result = verifyWebhookSignature(tampered, sig, TIMESTAMP, SECRET);
    expect(result.valid).toBe(false);
    expect(result.reason).toBeTruthy();
  });

  it('rejects a wrong secret (verify(invalid secret) -> INVALID)', () => {
    const sig = computeSignature(body, TIMESTAMP, 'a_different_secret');
    const result = verifyWebhookSignature(body, sig, TIMESTAMP, SECRET);
    expect(result.valid).toBe(false);
  });

  it('rejects when the signature or timestamp header is missing', () => {
    expect(verifyWebhookSignature(body, undefined, TIMESTAMP, SECRET).valid).toBe(false);
    expect(verifyWebhookSignature(body, computeSignature(body, TIMESTAMP, SECRET), undefined, SECRET).valid).toBe(false);
  });

  it('rejects when the secret is unconfigured', () => {
    const sig = computeSignature(body, TIMESTAMP, SECRET);
    expect(verifyWebhookSignature(body, sig, TIMESTAMP, '').valid).toBe(false);
  });

  it('rejects a wrong timestamp (tampered header)', () => {
    const sig = computeSignature(body, TIMESTAMP, SECRET);
    const result = verifyWebhookSignature(body, sig, '1999999999', SECRET);
    expect(result.valid).toBe(false);
  });
});
