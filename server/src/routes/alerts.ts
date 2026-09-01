import { Router, type Request, type Response } from 'express';
import { getDb } from '../db/index.js';
import { logger } from '../lib/logger.js';

export function alertsRouter(): Router {
  const router = Router();

  // GET /api/alerts — list alerts with optional status + severity filters
  router.get('/', (req: Request, res: Response) => {
    const status = String(req.query.status || '').toLowerCase();
    const severity = String(req.query.severity || '').toLowerCase();
    let sql = `SELECT * FROM alerts`;
    const conds: string[] = [];
    const params: unknown[] = [];
    if (status && ['active', 'acknowledged', 'resolved'].includes(status)) {
      conds.push(`status = ?`);
      params.push(status);
    }
    if (severity && ['info', 'warning', 'critical'].includes(severity)) {
      conds.push(`severity = ?`);
      params.push(severity);
    }
    if (conds.length) sql += ` WHERE ${conds.join(' AND ')}`;
    sql += ` ORDER BY created_at DESC`;
    const alerts = getDb().prepare(sql).all(...params);
    return res.json({ data: alerts });
  });

  // POST /api/alerts/:id/ack — acknowledge
  router.post('/:id/ack', (req: Request, res: Response) => {
    const info = getDb()
      .prepare(`UPDATE alerts SET status = 'acknowledged', acknowledged_at = ? WHERE id = ?`)
      .run(new Date().toISOString(), req.params.id);
    if (info.changes === 0) return res.status(404).json({ error: 'alert not found' });
    logger.info({ alertId: req.params.id }, 'alert acknowledged');
    return res.json({ ok: true, status: 'acknowledged' });
  });

  // POST /api/alerts/:id/resolve — resolve
  router.post('/:id/resolve', (req: Request, res: Response) => {
    const info = getDb()
      .prepare(`UPDATE alerts SET status = 'resolved', resolved_at = ? WHERE id = ?`)
      .run(new Date().toISOString(), req.params.id);
    if (info.changes === 0) return res.status(404).json({ error: 'alert not found' });
    logger.info({ alertId: req.params.id }, 'alert resolved');
    return res.json({ ok: true, status: 'resolved' });
  });

  // POST /api/alerts/:id/review — merchant disposition on an alert (Part 6)
  router.post('/:id/review', (req: Request, res: Response) => {
    const info = getDb()
      .prepare(`UPDATE alerts SET status = 'resolved', resolved_at = ? WHERE id = ?`)
      .run(new Date().toISOString(), req.params.id);
    if (info.changes === 0) return res.status(404).json({ error: 'alert not found' });
    logger.info({ alertId: req.params.id }, 'alert reviewed by merchant');
    return res.json({ ok: true, status: 'resolved' });
  });

  return router;
}
