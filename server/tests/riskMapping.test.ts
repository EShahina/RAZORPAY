import { describe, it, expect, beforeAll } from 'vitest';
import path from 'node:path';
import {
  riskLevelForScore,
  actionForLevel,
  scoreRawEvent,
  DEFAULT_THRESHOLDS,
  type Thresholds,
} from '../src/services/risk.js';
import { loadModel } from '../src/model/scorer.js';

const MODEL = path.resolve(__dirname, '../src/model/risk_model_v1.json');

describe('Risk tier + action mapping (Part 4.2 / Part 7.1)', () => {
  beforeAll(() => {
    loadModel(MODEL);
  });

  it('maps scores to tiers using configurable thresholds (default 40/75/90)', () => {
    expect(riskLevelForScore(10, DEFAULT_THRESHOLDS)).toBe('low');
    expect(riskLevelForScore(39, DEFAULT_THRESHOLDS)).toBe('low');
    expect(riskLevelForScore(40, DEFAULT_THRESHOLDS)).toBe('medium');
    expect(riskLevelForScore(74, DEFAULT_THRESHOLDS)).toBe('medium');
    expect(riskLevelForScore(75, DEFAULT_THRESHOLDS)).toBe('high');
    expect(riskLevelForScore(89, DEFAULT_THRESHOLDS)).toBe('high');
    expect(riskLevelForScore(90, DEFAULT_THRESHOLDS)).toBe('critical');
    expect(riskLevelForScore(100, DEFAULT_THRESHOLDS)).toBe('critical');
  });

  it('is configurable via custom thresholds', () => {
    const t: Thresholds = { medium: 30, high: 60, critical: 80 };
    expect(riskLevelForScore(15, t)).toBe('low');
    expect(riskLevelForScore(50, t)).toBe('medium');
    expect(riskLevelForScore(70, t)).toBe('high');
    expect(riskLevelForScore(85, t)).toBe('critical');
  });

  it('maps levels to recommended merchant actions', () => {
    expect(actionForLevel('low')).toBe('allow');
    expect(actionForLevel('medium')).toBe('verify');
    expect(actionForLevel('high')).toBe('review');
    expect(actionForLevel('critical')).toBe('manual_review');
  });

  function risky(overrides: Partial<Parameters<typeof scoreRawEvent>[0]> = {}) {
    return scoreRawEvent({
      amount: overrides.amount ?? 20000,
      merchantAvgAmount: overrides.merchantAvgAmount ?? 2000,
      accountAgeDays: overrides.accountAgeDays ?? 2,
      attemptCount: overrides.attemptCount ?? 6,
      velocity: overrides.velocity ?? 15,
      priorChargebacks: overrides.priorChargebacks ?? 0.6,
      priorRefunds: overrides.priorRefunds ?? 0.4,
      model: loadModel(MODEL),
      ...overrides,
    });
  }

  it('returns a riskScore in 0..100 with an explanation and top contributors', () => {
    const result = risky();
    expect(result.riskScore).toBeGreaterThanOrEqual(0);
    expect(result.riskScore).toBeLessThanOrEqual(100);
    expect(typeof result.explanation).toBe('string');
    expect(result.explanation.length).toBeGreaterThan(0);
    // exactly 7 features, top-5 surfaced (Part 4.1)
    expect(result.contributions.length).toBe(7);
    const top = result.contributions.slice(0, 5);
    expect(top.length).toBe(5);
    for (const c of top) {
      expect(c.label).toBeTruthy();
      expect(typeof c.detail).toBe('string');
      expect(c.normalized).toBeGreaterThanOrEqual(0);
      expect(c.normalized).toBeLessThanOrEqual(1);
      expect(['increases', 'decreases', 'neutral']).toContain(c.direction);
    }
    expect(result.level).toBeDefined();
    expect(result.action).toBeDefined();
    expect(result.modelVersion).toBe('v1.0.0');
  });

  it('a safe, low-risk transaction scores LOW and is ALLOWED', () => {
    const safe = risky({ amount: 2000, merchantAvgAmount: 2000, accountAgeDays: 1000, attemptCount: 1, velocity: 0, priorChargebacks: 0.01, priorRefunds: 0.02 });
    expect(safe.riskScore).toBeLessThan(40);
    expect(safe.level).toBe('low');
    expect(safe.action).toBe('allow');
  });

  it('exposes confidence in a calibrated range (no misleading over-confidence)', () => {
    const low = risky({ amount: 2000, merchantAvgAmount: 2000, accountAgeDays: 1000, attemptCount: 1, velocity: 0, priorChargebacks: 0, priorRefunds: 0 });
    const high = risky();
    for (const r of [low, high]) {
      expect(r.confidence).toBeGreaterThanOrEqual(0.3);
      expect(r.confidence).toBeLessThanOrEqual(0.99);
    }
  });
});
