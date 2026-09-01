import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { pinoHttp } from 'pino-http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from './config.js';
import { initDb } from './db/index.js';
import { loadModel } from './model/scorer.js';
import { logger } from './lib/logger.js';
import { webhookRouter } from './routes/webhooks.js';
import { transactionsRouter } from './routes/transactions.js';
import { alertsRouter } from './routes/alerts.js';
import { metricsRouter } from './routes/metrics.js';
import { simulatorRouter } from './routes/simulator.js';
import { seedRouter } from './routes/seed.js';
import { customersRouter } from './routes/customers.js';
import { disputesRouter } from './routes/disputes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp(opts?: { skipSeed?: boolean; dbMemory?: boolean }) {
  const config = loadConfig();
  initDb(opts?.dbMemory ? ':memory:' : config.databasePath);
  // Load the versioned trained model (Part 2.4) — fail fast if missing.
  loadModel(config.modelPath);

  const app = express();
  app.disable('x-powered-by');
  app.use(pinoHttp({ logger }));
  app.use(cors({ origin: true }));
  app.use(
    express.json({
      limit: '256kb',
      // Preserve the raw body for Razorpay signature verification.
      verify: (req, _res, buf) => {
        (req as express.Request & { rawBody?: Buffer }).rawBody = buf;
      },
    }),
  );

  // Rate-limit sensitive endpoints (Part 7.4).
  const scoreLimiter = rateLimit({ windowMs: 60_000, max: 60, standardHeaders: true, legacyHeaders: false });
  const seedLimiter = rateLimit({ windowMs: 60_000, max: 5, standardHeaders: true, legacyHeaders: false });

  app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'merchantshield', ts: Date.now() }));
  app.use('/webhooks/razorpay', webhookRouter(config));
  app.use('/api/transactions', scoreLimiter, transactionsRouter(config));
  app.use('/api/alerts', alertsRouter());
  app.use('/api', metricsRouter(config));
  app.use('/api/simulator', simulatorRouter(config));
  app.use('/api/customers', customersRouter());
  app.use('/api/disputes', disputesRouter());
  app.use('/api/seed', seedLimiter, seedRouter(config));

  // In production, serve the built Vite frontend (monorepo: ../dist).
  const frontendDist = path.resolve(__dirname, '../../dist');
  app.use(express.static(frontendDist));
  app.use((req, res) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/webhooks')) {
      return res.status(404).json({ error: 'not found' });
    }
    res.sendFile(path.join(frontendDist, 'index.html'));
  });

  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    logger.error({ err: err.message }, 'unhandled error');
    res.status(500).json({ error: 'internal error' });
  });

  return { app, config };
}

export function startServer() {
  const { app, config } = createApp();
  app.listen(config.port, () => {
    logger.info({ port: config.port }, 'MerchantShield server listening');
  });
}

// Allow direct execution: npm run dev / node dist/index.js
if (process.argv[1] && process.argv[1] === fileURLToPath(import.meta.url)) {
  startServer();
}
