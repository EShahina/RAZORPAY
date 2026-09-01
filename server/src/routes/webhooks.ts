import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import type { Config } from '../config.js';
import { verifyWebhookSignature } from '../services/webhookSignature.js';
import { scoreRawEvent } from '../services/risk.js';
import { getModel } from '../model/scorer.js';
import { getStore } from '../db/store.js';
import { logger } from '../lib/logger.js';
import { computeFeatures } from '../services/features.js';

/** Razorpay payment event body schema (validated before processing). */
const razorpayWebhookSchema = z.object({
  entity: z.string().optional(),
  account_id: z.string().optional(),
  event: z.string().default('payment.captured'),
  contains: z.array(z.any()).optional(),
  payload: z
    .object({
      payment: z
        .object({
          entity: z
            .object({
              id: z.string(),
              amount: z.number().optional(),
              status: z.string().optional(),
              method: z.string().optional(),
              order_id: z.string().optional(),
              created_at: z.number().optional(),
              card: z.object({ bin: z.string().optional() }).optional(),
            })
            .partial(),
        })
        .optional(),
    })
    .optional(),
});

export interface WebhookProcessResult {
  status: number;
  body: Record<string, unknown>;
}

/**
 * Shared webhook pipeline: verify signature -> validate payload -> score &
 * persist captured payments. Used by both the live `/webhooks/razorpay`
 * endpoint and the `POST /api/razorpay/test-webhook` end-to-end tester so a
 * simulated event exercises the exact same code path as a real Razorpay event.
 */
export async function processRazorpayWebhook(
  config: Config,
  rawBody: string,
  signature?: string,
  timestamp?: string,
): Promise<WebhookProcessResult> {
  const result = verifyWebhookSignature(rawBody, signature, timestamp, config.razorpayWebhookSecret);
  if (!result.valid) {
    logger.warn(
      { reason: result.reason, ip: undefined },
      'rejected unauthorised webhook',
    );
    // do not reveal details in the response to an unauthorised caller
    return { status: 401, body: { error: 'invalid signature' } };
  }

  let jsonBody: unknown;
  try {
    jsonBody = JSON.parse(rawBody);
  } catch {
    return { status: 400, body: { error: 'invalid payload' } };
  }

  const parsed = razorpayWebhookSchema.safeParse(jsonBody);
  if (!parsed.success) {
    logger.warn({ errors: parsed.error.issues }, 'rejected malformed webhook payload');
    return { status: 400, body: { error: 'invalid payload', issues: parsed.error.issues } };
  }

  const event = parsed.data.event;
  const payment = parsed.data.payload?.payment?.entity;

  let txnId: string | null = null;
  let risk: { score: number; level: string; action: string } | null = null;
  if (event === 'payment.captured' && payment?.id) {
    // Score in real time from webhook fields (merchant decision still required later).
    const features = computeFeatures({
      amount: (payment.amount ?? 0) / 100,
      merchantAvgAmount: config.cost.avgOrderValue,
      accountAgeDays: 1,
      attemptCount: 1,
      velocity: 0,
      priorChargebacks: 0,
      priorRefunds: 0,
    });
    const scored = scoreRawEvent({
      amount: (payment.amount ?? 0) / 100,
      merchantAvgAmount: config.cost.avgOrderValue,
      accountAgeDays: 1,
      attemptCount: 1,
      velocity: 0,
      priorChargebacks: 0,
      priorRefunds: 0,
      model: getModel(),
    });
    txnId = `whk_${payment.id}`;
    risk = { score: scored.riskScore, level: scored.level, action: scored.action };
    try {
      await getStore().insertOrReplaceTransaction({
        id: txnId,
        order_id: payment.order_id ?? txnId,
        merchant_id: config.razorpayKeyId || 'mz_demo',
        vertical: 'ecommerce',
        amount: (payment.amount ?? 0) / 100,
        currency: 'INR',
        pm: payment.method ?? 'card',
        card_bin: null,
        email: null,
        phone: null,
        device_id: null,
        customer_id: null,
        status: 'pending',
        risk_score: scored.riskScore,
        risk_level: scored.level,
        action: scored.action,
        confidence: scored.confidence,
        features_json: JSON.stringify(features),
        factors_json: JSON.stringify(scored.contributions),
        explanation: scored.explanation,
        created_at: new Date().toISOString(),
      });
    } catch (e) {
      logger.error({ err: (e as Error).message }, 'failed to persist webhook transaction');
    }
  }

  logger.info({ event, txnId, risk }, 'processed webhook');

  // Acknowledge immediately (Razorpay expects a 2xx fast return).
  return { status: 200, body: { received: true, event, txnId, risk } };
}

export function webhookRouter(config: Config): Router {
  const router = Router();

  router.post('/', async (req: Request, res: Response) => {
    const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    const sig = req.header('X-Razorpay-Signature');
    const ts = req.header('X-Razorpay-Webhook-Timestamp');
    const result = await processRazorpayWebhook(config, rawBody, sig, ts);
    return res.status(result.status).json(result.body);
  });

  return router;
}
