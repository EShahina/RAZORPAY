import { Router, type Request, type Response } from 'express';
import { getDb } from '../db/index.js';

export function disputesRouter(): Router {
  const router = Router();

  router.get('/', (_req: Request, res: Response) => {
    const rows = getDb()
      .prepare(
        `SELECT d.*, t.risk_score, t.risk_level, t.amount AS txn_amount
         FROM disputes d LEFT JOIN transactions t ON t.id = d.transaction_id
         ORDER BY d.filed_at DESC`,
      )
      .all();
    return res.json({ data: rows });
  });

  router.get('/returns', (_req: Request, res: Response) => {
    const rows = getDb()
      .prepare(
        `SELECT r.*, t.risk_score, t.risk_level FROM returns r
         LEFT JOIN transactions t ON t.id = r.transaction_id ORDER BY r.initiated_at DESC`,
      )
      .all();
    return res.json({ data: rows });
  });

  return router;
}
