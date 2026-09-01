import { describe, it, expect } from 'vitest';
import {
  computeFeatures,
  minMax,
  amountDeviation,
  accountAge,
  attemptCount,
  velocity,
  chargebackHistory,
  refundHistory,
  amountMagnitude,
  FEATURE_NAMES,
} from '../src/services/features.js';

describe('Feature normalization (Part 2.3 / Part 7.1)', () => {
  it('minMax clamps to [0,1] and handles degenerate ranges', () => {
    expect(minMax(5, 0, 10)).toBe(0.5);
    expect(minMax(-5, 0, 10)).toBe(0);
    expect(minMax(50, 0, 10)).toBe(1);
    expect(minMax(anything(), 0, 0)).toBe(0);
    function anything() { return 5; }
  });

  it('computes all 7 features in [0,1] and matches FEATURE_NAMES', () => {
    const feats = computeFeatures({
      amount: 4000,
      merchantAvgAmount: 2000,
      accountAgeDays: 10,
      attemptCount: 3,
      velocity: 5,
      priorChargebacks: 0.2,
      priorRefunds: 0.1,
    });
    for (const name of FEATURE_NAMES) {
      expect(feats).toHaveProperty(name);
      const v = feats[name];
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
    expect(Object.keys(feats)).toHaveLength(7);
  });

  it('amountDeviation rises with the deviation from merchant average', () => {
    const low = amountDeviation({ amount: 2000, merchantAvgAmount: 2000, accountAgeDays: 30, attemptCount: 1, velocity: 0, priorChargebacks: 0, priorRefunds: 0 });
    const high = amountDeviation({ amount: 8000, merchantAvgAmount: 2000, accountAgeDays: 30, attemptCount: 1, velocity: 0, priorChargebacks: 0, priorRefunds: 0 });
    expect(low).toBeLessThan(high);
    expect(high).toBeLessThanOrEqual(1);
  });

  it('accountAge: brand new < 1 day is max risk (1.0)', () => {
    expect(accountAge({ amount: 1, merchantAvgAmount: 1, accountAgeDays: 0, attemptCount: 1, velocity: 0, priorChargebacks: 0, priorRefunds: 0 })).toBe(1.0);
  });

  it('accountAge: returns a lower (safer) value for an old account', () => {
    const fresh = accountAge({ amount: 1, merchantAvgAmount: 1, accountAgeDays: 3, attemptCount: 1, velocity: 0, priorChargebacks: 0, priorRefunds: 0 });
    const old = accountAge({ amount: 1, merchantAvgAmount: 1, accountAgeDays: 400, attemptCount: 1, velocity: 0, priorChargebacks: 0, priorRefunds: 0 });
    expect(fresh).toBeGreaterThan(old);
    expect(old).toBe(0.1);
  });

  it('attemptCount is monotonic and capped', () => {
    expect(attemptCount({ amount: 1, merchantAvgAmount: 1, accountAgeDays: 30, attemptCount: 1, velocity: 0, priorChargebacks: 0, priorRefunds: 0 })).toBe(0);
    expect(attemptCount({ amount: 1, merchantAvgAmount: 1, accountAgeDays: 30, attemptCount: 8, velocity: 0, priorChargebacks: 0, priorRefunds: 0 })).toBe(1);
  });

  it('velocity is monotonic and capped', () => {
    expect(velocity({ amount: 1, merchantAvgAmount: 1, accountAgeDays: 30, attemptCount: 1, velocity: 0, priorChargebacks: 0, priorRefunds: 0 })).toBe(0);
    expect(velocity({ amount: 1, merchantAvgAmount: 1, accountAgeDays: 30, attemptCount: 1, velocity: 20, priorChargebacks: 0, priorRefunds: 0 })).toBe(1);
  });

  it('chargebackHistory and refundHistory are capped at 1', () => {
    expect(chargebackHistory({ amount: 1, merchantAvgAmount: 1, accountAgeDays: 30, attemptCount: 1, velocity: 0, priorChargebacks: 2, priorRefunds: 0 })).toBe(1);
    expect(refundHistory({ amount: 1, merchantAvgAmount: 1, accountAgeDays: 30, attemptCount: 1, velocity: 0, priorChargebacks: 0, priorRefunds: 2 })).toBe(1);
  });

  it('amountMagnitude increases with amount', () => {
    const small = amountMagnitude({ amount: 120, merchantAvgAmount: 500, accountAgeDays: 30, attemptCount: 1, velocity: 0, priorChargebacks: 0, priorRefunds: 0 });
    const large = amountMagnitude({ amount: 150000, merchantAvgAmount: 500, accountAgeDays: 30, attemptCount: 1, velocity: 0, priorChargebacks: 0, priorRefunds: 0 });
    expect(small).toBeLessThan(large);
  });

  it('computeFeatures matches the Python training feature schema', () => {
    const feats = computeFeatures({ amount: 5000, merchantAvgAmount: 2000, accountAgeDays: 20, attemptCount: 2, velocity: 4, priorChargebacks: 0.1, priorRefunds: 0.05 });
    expect(JSON.stringify(Array.from(FEATURE_NAMES))).toBe(
      JSON.stringify(['amount_deviation', 'account_age', 'attempt_count', 'velocity', 'chargeback_history', 'refund_history', 'amount_magnitude']),
    );
    for (const k of Object.keys(feats)) {
      expect(FEATURE_NAMES).toContain(k);
    }
  });
});
