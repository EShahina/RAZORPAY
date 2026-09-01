import { Router, type Request, type Response } from 'express';
import { getStore } from '../db/store.js';

export function customersRouter(): Router {
  const router = Router();

  router.get('/', async (_req: Request, res: Response) => {
    const rows = await getStore().listCustomers();
    return res.json({ data: rows });
  });

  router.get('/:id/transactions', async (req: Request, res: Response) => {
    const rows = await getStore().listCustomerTransactions(String(req.params.id));
    return res.json({ data: rows });
  });

  return router;
}