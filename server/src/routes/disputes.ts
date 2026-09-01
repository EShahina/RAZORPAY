import { Router, type Request, type Response } from 'express';
import { getStore } from '../db/store.js';

export function disputesRouter(): Router {
  const router = Router();

  router.get('/', async (_req: Request, res: Response) => {
    const rows = await getStore().listDisputes();
    return res.json({ data: rows });
  });

  router.get('/returns', async (_req: Request, res: Response) => {
    const rows = await getStore().listReturns();
    return res.json({ data: rows });
  });

  return router;
}