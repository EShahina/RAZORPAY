import { Router, type Request, type Response } from 'express';
import { getDb } from '../db/index.js';

export function customersRouter(): Router {
  const router = Router();

  router.get('/', (req: Request, res: Response) => {
    const rows = getDb()
      .prepare(
        `SELECT id, email, phone, account_age_days AS account_age, prior_chargebacks,
                prior_refunds,
                (SELECT COUNT(*) FROM transactions t WHERE t.customer_id = c.id) AS total_transactions,
                (SELECT SUM(amount) FROM transactions t WHERE t.customer_id = c.id) AS total_spent,
                (SELECT AVG(risk_score) FROM transactions t WHERE t.customer_id = c.id) AS avg_risk
         FROM customers c
         ORDER BY avg_risk DESC NULLS LAST`,
      )
      .all();
    return res.json({ data: rows });
  });

  router.get('/:id/transactions', (req: Request, res: Response) => {
    const rows = getDb()
      .prepare(`SELECT * FROM transactions WHERE customer_id = ? ORDER BY created_at DESC LIMIT 100`)
      .all(req.params.id);
    return res.json({ data: rows });
  });

  return router;
}
