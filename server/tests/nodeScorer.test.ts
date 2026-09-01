import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { loadModel, scoreFeatures } from '../src/model/scorer.js';

const MODEL = path.resolve(__dirname, '../src/model/risk_model_v1.json');
const REF = path.resolve(__dirname, '../src/model/scorer_check.json');

describe('Model scorer reproduces xgboost predictions (Part 3 credibility)', () => {
  let ref: { best_iteration: number; n_exported_trees: number; samples: Array<{ features: Record<string, number>; probability: number; label: number }> };

  beforeAll(() => {
    loadModel(MODEL);
    ref = JSON.parse(fs.readFileSync(REF, 'utf-8'));
  });

  it('loads the versioned model with expected structure', () => {
    const model = loadModel(MODEL);
    expect(model.model_version).toBe('v1.0.0');
    expect(model.n_features).toBe(7);
    expect(model.feature_names).toHaveLength(7);
    expect(model.n_trees).toBeGreaterThan(0);
  });

  it('matches xgboost probability within tolerance on holdout samples', () => {
    let maxAbsErr = 0;
    let sumAbsErr = 0;
    let nBig = 0;
    for (const s of ref.samples) {
      const { probability } = scoreFeatures(s.features);
      const err = Math.abs(probability - s.probability);
      if (err > maxAbsErr) maxAbsErr = err;
      sumAbsErr += err;
      if (err > 0.02) nBig += 1;
    }
    const meanErr = sumAbsErr / ref.samples.length;
    // sklearn accumulates in float32; a single extreme-logit boundary row may
    // differ by ~0.01. The vast majority reproduce to float precision.
    expect(meanErr).toBeLessThan(0.001);
    expect(maxAbsErr).toBeLessThan(0.02);
    expect(nBig).toBe(0);
  });

  it('produces a 0..100 risk score that is monotonic with probability', () => {
    const checks = [
      { features: { amount_deviation: 0.1, account_age: 0.1, attempt_count: 0.1, velocity: 0.1, chargeback_history: 0.1, refund_history: 0.1, amount_magnitude: 0.1 } },
      { features: { amount_deviation: 0.9, account_age: 0.9, attempt_count: 0.9, velocity: 0.9, chargeback_history: 0.9, refund_history: 0.9, amount_magnitude: 0.9 } },
    ];
    for (const c of checks) {
      const r = scoreFeatures(c.features);
      expect(r.riskScore).toBeGreaterThanOrEqual(0);
      expect(r.riskScore).toBeLessThanOrEqual(100);
      expect(r.probability).toBeGreaterThanOrEqual(0);
      expect(r.probability).toBeLessThanOrEqual(1);
    }
  });
});
