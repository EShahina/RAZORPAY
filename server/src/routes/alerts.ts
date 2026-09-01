import { Router, type Request, type Response } from 'express';
import { getStore } from '../db/store.js';
import { logger } from '../lib/logger.js';

export function alertsRouter(): Router {
  const router = Router();

  // GET /api/alerts — list alerts with optional status + severity filters
  router.get('/', async (req: Request, res: Response) => {
    const status = String(req.query.status || '').toLowerCase();
    const severity = String(req.query.severity || '').toLowerCase();
    const alerts = await getStore().listAlerts({ status, severity });
    return res.json({ data: alerts });
  });

  // POST /api/alerts/:id/ack — acknowledge
  router.post('/:id/ack', async (req: Request, res: Response) => {
    const ok = await getStore().acknowledgeAlert(String(req.params.id));
    if (!ok) return res.status(404).json({ error: 'alert not found' });
    logger.info({ alertId: req.params.id }, 'alert acknowledged');
    return res.json({ ok: true, status: 'acknowledged' });
  });

  // POST /api/alerts/:id/resolve — resolve
  router.post('/:id/resolve', async (req: Request, res: Response) => {
    const ok = await getStore().resolveAlert(String(req.params.id));
    if (!ok) return res.status(404).json({ error: 'alert not found' });
    logger.info({ alertId: req.params.id }, 'alert resolved');
    return res.json({ ok: true, status: 'resolved' });
  });

  // POST /api/alerts/:id/review — merchant disposition on an alert (Part 6)
  router.post('/:id/review', async (req: Request, res: Response) => {
    const ok = await getStore().resolveAlert(String(req.params.id));
    if (!ok) return res.status(404).json({ error: 'alert not found' });
    logger.info({ alertId: req.params.id }, 'alert reviewed by merchant');
    return res.json({ ok: true, status: 'resolved' });
  });

  return router;
}