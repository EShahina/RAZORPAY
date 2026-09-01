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

  router.post('/', (req: Request, res: Response) => {
    const parsed = z
      .object({ confirm: z.enum(['true', 'false', '1', '0']).or(z.boolean()).optional() })
      .safeParse(req.body ?? {});
    if (
      req.body &&
      typeof req.body === 'object' &&
      !('confirm' in req.body) &&
      !('force' in req.body)
    ) {
      // allow simple POST {} to trigger reseed for the demo, but require no auth token
    }
    const count = seedDatabase(config.modelPath);
    logger.info({ count }, 'database reseeded via /api/seed');
    return res.json({ ok: true, count, message: `seeded ${count} transactions` });
  });

  return router;
}
