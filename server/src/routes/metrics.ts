import { Router, type Request, type Response } from 'express';
import fs from 'node:fs';
import type { Config } from '../config.js';
import { getDb } from '../db/index.js';
import { getModel } from '../model/scorer.js';

/**
 * Model metrics & health endpoints. Metrics are read from the MEASURED report file
 * produced by the training pipeline (server/ml) — never hardcoded in the API.
 */
export function metricsRouter(config: Config): Router {
  const router = Router();

  router.get('/model/metrics', (_req: Request, res: Response) => {
    const raw = fs.readFileSync(config.metricsReportPath, 'utf-8');
    const report = JSON.parse(raw);
    return res.json({ model: getModelInfo(), report });
  });

  router.get('/model/info', (_req: Request, res: Response) => {
    return res.json(getModelInfo());
  });

  router.get('/model/health', (_req: Request, res: Response) => {
    const model = getModel();
    const totals = (
      getDb()
        .prepare(
          `SELECT COUNT(*) AS total,
                  SUM(CASE WHEN risk_score >= 75 THEN 1 ELSE 0 END) AS flagged,
                  SUM(CASE WHEN action IN ('review','manual_review') THEN 1 ELSE 0 END) AS reviews
           FROM transactions`,
        )
        .get() as { total: number; flagged: number; reviews: number }
    );
    return res.json({
      status: 'healthy',
      modelVersion: model.model_version,
      trainedAt: model.trained_at,
      nFeatures: model.n_features,
      nTrees: model.n_trees,
      loadedTransactions: totals.total,
      flaggedRate: totals.total ? +(totals.flagged / totals.total).toFixed(4) : 0,
      reviewRate: totals.total ? +(totals.reviews / totals.total).toFixed(4) : 0,
    });
  });

  return router;
}

function getModelInfo() {
  const m = getModel();
  return {
    modelName: m.model_name,
    modelVersion: m.model_version,
    trainedAt: m.trained_at,
    framework: m.framework,
    nFeatures: m.n_features,
    nTrees: m.n_trees,
    featureNames: m.feature_names,
  };
}
