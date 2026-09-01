import { Router, type Request, type Response } from 'express';
import crypto from 'node:crypto';
import Razorpay from 'razorpay';
import type { Config } from '../config.js';
import { scoreRawEvent } from '../services/risk.js';
import { computeFeatures } from '../services/features.js';
import { getModel } from '../model/scorer.js';
import { getStore } from '../db/store.js';
import { logger } from '../lib/logger.js';
import { processRazorpayWebhook } from './webhooks.js';
import { computeSignature } from '../services/webhookSignature.js';

/**
 * Razorpay test-mode integration (Orders API + Checkout + signature verify).
 *
 * Flow:
 *   1. POST /api/razorpay/orders
 *        Creates a Razorpay Order (paise) and returns { order_id, amount, key_id }.
 *   2. The frontend opens Razorpay Checkout with that order_id + key_id.
 *   3. On `payment.success` the client posts the payment/order/signature to
 *      POST /api/razorpay/verify. We verify the signature and, if valid,
 *      score the captured payment and write it into the transactions feed.
 *
 * The SDK is only constructed when keys are configured; until then /orders
 * returns a 503 with a clear "keys not configured" message.
 */

function getClient(config: Config): Razorpay | null {
  if (!config.razorpayKeyId || !config.razorpayKeySecret) return null;
  return new Razorpay({
    key_id: config.razorpayKeyId,
    key_secret: config.razorpayKeySecret,
  });
}

const WEBHOOK_EVENT_TYPES = [
  'payment.captured',
  'payment.failed',
  'payment.authorized',
  'refund.created',
  'refund.processed',
  'chargeback.created',
] as const;

/** Build a realistic Razorpay webhook payload for a given event type. */
export function buildTestWebhookPayload(type: string): Record<string, unknown> {
  const amount = (Math.floor(Math.random() * 50000) + 100) * 100; // paise
  const paymentId = `pay_test_${Math.random().toString(36).slice(2, 12)}`;
  switch (type) {
    case 'payment.failed':
      return {
        event: 'payment.failed',
        account_id: 'acct_test',
        contains: ['payment'],
        payload: {
          payment: {
            entity: {
              id: paymentId,
              amount,
              currency: 'INR',
              status: 'failed',
              method: 'card',
              error_code: 'badateway_card_expired',
              error_description: 'The card has expired.',
            },
          },
        },
      };
    case 'payment.authorized':
      return {
        event: 'payment.authorized',
        account_id: 'acct_test',
        contains: ['payment'],
        payload: {
          payment: {
            entity: {
              id: paymentId,
              amount,
              currency: 'INR',
              status: 'authorized',
              method: 'netbanking',
            },
          },
        },
      };
    case 'refund.created':
      return {
        event: 'refund.created',
        account_id: 'acct_test',
        contains: ['refund'],
        payload: {
          refund: {
            entity: {
              id: `rfnd_test_${Math.random().toString(36).slice(2, 12)}`,
              amount: Math.floor(amount * 0.5),
              currency: 'INR',
              status: 'pending',
            },
          },
        },
      };
    case 'refund.processed':
      return {
        event: 'refund.processed',
        account_id: 'acct_test',
        contains: ['refund'],
        payload: {
          refund: {
            entity: {
              id: `rfnd_test_${Math.random().toString(36).slice(2, 12)}`,
              amount: Math.floor(amount * 0.5),
              currency: 'INR',
              status: 'processed',
            },
          },
        },
      };
    case 'chargeback.created':
      return {
        event: 'chargeback.created',
        account_id: 'acct_test',
        contains: ['chargeback'],
        payload: {
          chargeback: {
            entity: {
              id: `chb_test_${Math.random().toString(36).slice(2, 12)}`,
              amount,
              currency: 'INR',
              reason: 'fraudulent',
              status: 'open',
            },
          },
        },
      };
    case 'payment.captured':
    default:
      return {
        event: 'payment.captured',
        account_id: 'acct_test',
        contains: ['payment'],
        payload: {
          payment: {
            entity: {
              id: paymentId,
              amount,
              currency: 'INR',
              status: 'captured',
              method: 'card',
              order_id: `order_test_${Math.random().toString(36).slice(2, 12)}`,
              card: { bin: '411111' },
              created_at: Math.floor(Date.now() / 1000),
            },
          },
        },
      };
  }
}

function verifyPaymentSignature(orderId: string, paymentId: string, signature: string, secret: string): boolean {
  if (!orderId || !paymentId || !signature || !secret) return false;
  try {
    const expected = crypto
      .createHmac('sha256', secret)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');
    const a = Buffer.from(expected, 'hex');
    const b = Buffer.from(signature, 'hex');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/** Score a captured payment and persist it into the transactions table. */
async function persistCapturedPayment(config: Config, params: {
  paymentId: string;
  orderId: string;
  amountPaise: number;
  method: string;
  email?: string;
  phone?: string;
  cardLast4?: string;
  created?: number;
}) {
  const amount = params.amountPaise / 100;
  const features = computeFeatures({
    amount,
    merchantAvgAmount: config.cost.avgOrderValue,
    accountAgeDays: 1,
    attemptCount: 1,
    velocity: 0,
    priorChargebacks: 0,
    priorRefunds: 0,
  });
  const result = scoreRawEvent({
    amount,
    merchantAvgAmount: config.cost.avgOrderValue,
    accountAgeDays: 1,
    attemptCount: 1,
    velocity: 0,
    priorChargebacks: 0,
    priorRefunds: 0,
    model: getModel(),
  });

  const id = `pay_${params.paymentId}`;
  try {
    await getStore().insertOrReplaceTransaction({
      id,
      order_id: params.orderId,
      merchant_id: config.razorpayKeyId || 'mz_test',
      vertical: 'ecommerce',
      amount,
      currency: 'INR',
      payment_method: params.method || 'card',
      card_bin: params.cardLast4 ?? null,
      email: params.email ?? null,
      phone: params.phone ?? null,
      device_id: null,
      customer_id: null,
      status: 'completed',
      risk_score: result.riskScore,
      risk_level: result.level,
      action: result.action,
      confidence: result.confidence,
      features_json: JSON.stringify(features),
      factors_json: JSON.stringify(result.contributions),
      explanation: result.explanation,
      created_at: params.created ? new Date(params.created * 1000).toISOString() : new Date().toISOString(),
    });
  } catch (e) {
    logger.error({ err: (e as Error).message }, 'failed to persist razorpay payment');
    throw e;
  }

  return {
    transactionId: id,
    orderId: params.orderId,
    amount,
    riskScore: result.riskScore,
    riskLevel: result.level,
    action: result.action,
    explanation: result.explanation,
    contributions: result.contributions,
  };
}

export function razorpayRouter(config: Config): Router {
  const router = Router();

  // Create a Razorpay order (test mode). Expects { amount, currency?, receipt?, method? }.
  router.post('/orders', async (req: Request, res: Response) => {
    const client = getClient(config);
    if (!client) {
      return res.status(503).json({
        error: 'Razorpay keys not configured',
        hint: 'Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in server/.env',
      });
    }

    const amount = Number(req.body?.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: 'invalid amount' });
    }

    const currency = String(req.body?.currency || 'INR').toUpperCase();
    const receipt = String(req.body?.receipt || `rcpt_${Date.now()}`);
    const notes: Record<string, string> = {
      source: 'merchantshield-testmode',
      email: String(req.body?.email || ''),
      phone: String(req.body?.phone || ''),
    };

    try {
      const order = await client.orders.create({
        amount: Math.round(amount * 100),
        currency,
        receipt,
        notes,
      });
      logger.info({ orderId: order.id, amount, currency }, 'created razorpay order');
      return res.status(201).json({
        order_id: order.id,
        amount,
        currency,
        key_id: config.razorpayKeyId,
        test_mode: config.razorpayKeyId.startsWith('rzp_test_'),
        receipt,
      });
    } catch (e) {
      logger.error({ err: (e as Error).message }, 'razorpay order creation failed');
      return res.status(502).json({ error: 'razorpay order creation failed', detail: (e as Error).message });
    }
  });

  // Verify a completed checkout payment and persist the scored transaction.
  router.post('/verify', async (req: Request, res: Response) => {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = (req.body ?? {}) as {
      razorpay_order_id?: string;
      razorpay_payment_id?: string;
      razorpay_signature?: string;
    };

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ error: 'missing payment verification fields' });
    }

    const valid = verifyPaymentSignature(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      config.razorpayKeySecret,
    );
    if (!valid) {
      logger.warn(
        { orderId: razorpay_order_id, paymentId: razorpay_payment_id, ip: req.ip },
        'rejected razorpay payment with invalid signature',
      );
      return res.status(401).json({ error: 'invalid signature' });
    }

    // Fetch the payment from Razorpay to confirm it was captured.
    try {
      const client = getClient(config);
      if (!client) throw new Error('keys not configured');
      const payment = await client.payments.fetch(razorpay_payment_id);
      const captured = payment.status === 'captured';

      const saved = persistCapturedPayment(config, {
        paymentId: razorpay_payment_id,
        orderId: razorpay_order_id,
        amountPaise: typeof payment.amount === 'number' ? payment.amount : 0,
        method: payment.method || 'card',
        email: typeof payment.email === 'string' ? payment.email : undefined,
        phone: typeof payment.contact === 'string' ? payment.contact : undefined,
        cardLast4: payment.card?.last4,
        created: typeof payment.created_at === 'number' ? payment.created_at : undefined,
      });

      return res.status(200).json({
        verified: true,
        status: payment.status,
        captured,
        payment_id: razorpay_payment_id,
        ...saved,
      });
    } catch (e) {
      logger.error(
        { err: (e as Error).message, paymentId: razorpay_payment_id },
        'razorpay payment verification failed',
      );
      return res.status(502).json({ error: 'razorpay payment verification failed', detail: (e as Error).message });
    }
  });

  // List payments fetched from the Razorpay API (test mode).
  router.get('/payments', async (req: Request, res: Response) => {
    const client = getClient(config);
    if (!client) {
      return res.status(503).json({
        error: 'Razorpay keys not configured',
        hint: 'Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in server/.env',
      });
    }
    const count = Math.min(parseInt(String(req.query.count || '20'), 10) || 20, 100);
    try {
      const data = await client.payments.all({ count });
      const items = (data.items || []).map((p) => ({
        payment_id: p.id,
        status: p.status,
        amount: typeof p.amount === 'number' ? p.amount / 100 : Number(p.amount || 0) / 100,
        currency: p.currency,
        method: p.method,
        email: p.email,
        contact: typeof p.contact === 'string' ? p.contact : String(p.contact ?? ''),
        card_last4: p.card?.last4,
        created_at: p.created_at,
      }));
      return res.json({ entity: data.entity, count: data.count, items });
    } catch (e) {
      logger.error({ err: (e as Error).message }, 'razorpay payments fetch failed');
      return res.status(502).json({ error: 'razorpay payments fetch failed', detail: (e as Error).message });
    }
  });

  // End-to-end webhook test: builds, signs and delivers a webhook through the
  // exact same pipeline as a real Razorpay event (verification + scoring +
  // persistence).
  router.post('/test-webhook', async (req: Request, res: Response) => {
    const requested = String(req.body?.event || '');
    const type = (WEBHOOK_EVENT_TYPES as readonly string[]).includes(requested)
      ? requested
      : WEBHOOK_EVENT_TYPES[Math.floor(Math.random() * WEBHOOK_EVENT_TYPES.length)];
    const payload = buildTestWebhookPayload(type);
    const rawBody = JSON.stringify(payload);
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = computeSignature(rawBody, timestamp, config.razorpayWebhookSecret);
    const result = await processRazorpayWebhook(config, rawBody, signature, timestamp);
    return res.status(result.status).json({ ...result.body, tested_event: payload });
  });

  return router;
}
