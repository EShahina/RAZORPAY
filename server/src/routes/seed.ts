import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import type { Config } from '../config.js';
import { seedDatabase } from '../services/dataService.js';
import { logger } from '../lib/logger.js';

/**
 * Regenerate the synthetic corpus (Part 8 demo).
 * POST /api/seed — idempotent; rate-limited.
 */
export function seedRouter(config: Config): Router {
  const router = Router();

  router.post('/', async (req: Request, res: Response) => {
    await z
      .object({ confirm: z.enum(['true', 'false', '1', '0']).or(z.boolean()).optional() })
      .safeParse(req.body ?? {});
    const count = await seedDatabase(config.modelPath);
    logger.info({ count }, 'database reseeded via /api/seed');
    return res.json({ ok: true, count, message: `seeded ${count} transactions` });
  });

  return router;
}
