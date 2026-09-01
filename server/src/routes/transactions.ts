import { Router, type Request, type Response } from 'express';
import crypto from 'node:crypto';
import { z } from 'zod';
import type { Config } from '../config.js';
import { scoreRawEvent } from '../services/risk.js';
import { computeFeatures } from '../services/features.js';
import { getModel } from '../model/scorer.js';
import { getStore } from '../db/store.js';
import { recordMerchantDecision, recordFeedback } from '../services/dataService.js';
import { logger } from '../lib/logger.js';

const scoreSchema = z.object({
  amount: z.number().positive().max(10_000_000),
  merchantAvgAmount: z.number().positive().optional().default(2000),
  accountAgeDays: z.number().min(0).max(20000).default(1),
  attemptCount: z.number().int().min(1).max(50).default(1),
  velocity: z.number().int().min(0).max(1000).default(0),
  priorChargebacks: z.number().min(0).max(1).default(0),
  priorRefunds: z.number().min(0).max(1).default(0),
});

export function transactionsRouter(config: Config): Router {
  const router = Router();

  // POST /api/transactions/score — score one transaction (idempotent given same input)
  router.post('/score', (req: Request, res: Response) => {
    const parsed = scoreSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'invalid payload', issues: parsed.error.issues });
    }
    const p = parsed.data;
    const features = computeFeatures({
      amount: p.amount,
      merchantAvgAmount: p.merchantAvgAmount,
      accountAgeDays: p.accountAgeDays,
      attemptCount: p.attemptCount,
      velocity: p.velocity,
      priorChargebacks: p.priorChargebacks,
      priorRefunds: p.priorRefunds,
    });
    const result = scoreRawEvent({ ...p, model: getModel() });
    logger.info({ amount: p.amount, risk: result.riskScore }, 'scored transaction');
    return res.status(200).json({
      idempotency_key: sha256(JSON.stringify(parsed.data)),
      ...result,
    });
  });

  // GET /api/transactions
  router.get('/', async (req: Request, res: Response) => {
    const limit = Math.min(parseInt(String(req.query.limit || '50'), 10) || 50, 500);
    const offset = parseInt(String(req.query.offset || '0'), 10) || 0;
    const { rows, total } = await getStore().listTransactions(limit, offset);
    return res.json({ data: rows, total, limit, offset });
  });

  // GET /api/transactions/:id (with factors + explanation)
  router.get('/:id', async (req: Request, res: Response) => {
    const id = String(req.params.id);
    const row = await getStore().getTransaction(id);
    if (!row) return res.status(404).json({ error: 'transaction not found' });
    return res.json(row);
  });

  // POST /api/transactions/:id/review — merchant decision (human-in-the-loop)
  router.post('/:id/review', async (req: Request, res: Response) => {
    const schema = z.object({
      decision: z.enum(['allow', 'verify', 'review', 'manual_review', 'block']),
      notes: z.string().max(2000).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'invalid decision', issues: parsed.error.issues });
    const id = String(req.params.id);
    const ok = await recordMerchantDecision(id, parsed.data.decision, parsed.data.notes);
    if (!ok) return res.status(404).json({ error: 'transaction not found' });
    logger.info({ txnId: id, decision: parsed.data.decision }, 'merchant decision recorded');
    return res.json({ ok: true, decision: parsed.data.decision });
  });

  // POST /api/transactions/:id/feedback
  router.post('/:id/feedback', async (req: Request, res: Response) => {
    const schema = z.object({ label: z.enum(['legitimate', 'fraudulent']) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'invalid feedback' });
    const id = String(req.params.id);
    const ok = await recordFeedback(id, parsed.data.label);
    if (!ok) return res.status(404).json({ error: 'transaction not found' });
    return res.json({ ok: true, label: parsed.data.label });
  });

  return router;
}

function sha256(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}
