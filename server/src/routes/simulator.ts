import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import type { Config } from '../config.js';
import { getStore } from '../db/store.js';
import { runSimulation, actionForScore, type ScoreRow } from '../services/costModel.js';

/**
 * Business-cost simulator (Part 5).
 *
 * GET /api/simulator/policy?threshold=...
 * Computes recoverable loss, review cost, FP cost, FN cost, and net protection
 * across the scored corpus at a chosen threshold.
 */
export function simulatorRouter(config: Config): Router {
  const router = Router();

  router.get('/policy', async (req: Request, res: Response) => {
    const q = z
      .object({ threshold: z.coerce.number().min(0).max(100).optional().default(60) })
      .safeParse(req.query);
    if (!q.success) return res.status(400).json({ error: 'invalid threshold' });
    const threshold = q.data.threshold;

    const rows = (await getStore().allTransactionsForSimulator()).map(
      (r) => ({ amount: r.amount, riskScore: r.risk_score, actualFraud: r.actual_fraud === 1 }) as ScoreRow,
    );

    const result = runSimulation(rows, threshold, config.cost);

    // Sweep a range so the UI can draw the net-protection vs blocked-revenue curve.
    const curves = [35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95].map((t) => {
      const r = runSimulation(rows, t, config.cost);
      return { threshold: t, netProtection: r.netProtection, blockedRevenue: r.blockedRevenue, recall: r.recall };
    });

    return res.json({ ...result, curves, constants: config.cost });
  });

  router.get('/action-map', (_req: Request, res: Response) => {
    // expose the tier mapping for the UI
    const map = [30, 55, 80, 95].map((score) => ({ riskScore: score, action: actionForScore(score, 60) }));
    return res.json({ actionMap: map, tiers: { verify: 40, review: 75, manual: 90 } });
  });

  return router;
}
