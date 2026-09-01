import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import type { Config } from '../config.js';
import { verifyWebhookSignature } from '../services/webhookSignature.js';
import { scoreRawEvent } from '../services/risk.js';
import { getModel } from '../model/scorer.js';
import { getDb } from '../db/index.js';
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

export function webhookRouter(config: Config): Router {
  const router = Router();

  router.post('/', (req: Request, res: Response) => {
    const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    const sig = req.header('X-Razorpay-Signature');
    const ts = req.header('X-Razorpay-Webhook-Timestamp');

    // MANDATORY Part 2.2 — reject unsigned or tampered webhooks with 401.
    const result = verifyWebhookSignature(rawBody, sig, ts, config.razorpayWebhookSecret);
    if (!result.valid) {
      logger.warn(
        { event: req.body?.event, reason: result.reason, ip: req.ip },
        'rejected unauthorised webhook',
      );
      // do not reveal details in the response to an unauthorised caller
      return res.status(401).json({ error: 'invalid signature' });
    }

    const parsed = razorpayWebhookSchema.safeParse(req.body);
    if (!parsed.success) {
      logger.warn({ errors: parsed.error.issues }, 'rejected malformed webhook payload');
      return res.status(400).json({ error: 'invalid payload', issues: parsed.error.issues });
    }

    const event = parsed.data.event;
    const payment = parsed.data.payload?.payment?.entity;

    let txnId: string | null = null;
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
      const result = scoreRawEvent({
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
      try {
        getDb()
          .prepare(
            `INSERT OR REPLACE INTO transactions
             (id, order_id, merchant_id, vertical, amount, currency, payment_method, email, phone,
              device_id, customer_id, status, risk_score, risk_level, action, confidence,
              features_json, factors_json, explanation, created_at)
             VALUES (@id, @order_id, @merchant_id, 'ecommerce', @amount, 'INR', @pm, NULL, NULL,
              NULL, NULL, 'pending', @risk, @level, @action, @conf, @feats, @factors, @expl, @created)`,
          )
          .run({
            id: txnId,
            order_id: payment.order_id ?? txnId,
            merchant_id: config.razorpayKeyId || 'mz_demo',
            amount: (payment.amount ?? 0) / 100,
            pm: payment.method ?? 'card',
            risk: result.riskScore,
            level: result.level,
            action: result.action,
            conf: result.confidence,
            feats: JSON.stringify(features),
            factors: JSON.stringify(result.contributions),
            expl: result.explanation,
            created: new Date().toISOString(),
          });
      } catch (e) {
        logger.error({ err: (e as Error).message }, 'failed to persist webhook transaction');
      }
    }

    logger.info({ event, txnId, risk: null }, 'processed webhook');

    // Acknowledge immediately (Razorpay expects a 2xx fast return).
    return res.status(200).json({ received: true, event, txnId });
  });

  return router;
}
