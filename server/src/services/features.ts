/**
 * Feature extraction layer (Part 2.3).
 *
 * Pure, unit-testable functions that compute the 7 normalized model features from
 * a raw charge event. These MUST mirror the feature computation used to generate
 * the training corpus (server/ml/generate_dataset.py) so live scoring uses the
 * same input space the model was calibrated on. Each feature is normalized to
 * [0,1] via min-max (inference uses the same formula as training).
 */

export interface RawFeatures {
  /** Transaction amount in INR. */
  amount: number;
  /** Merchant average order value for this merchant (INR). */
  merchantAvgAmount: number;
  /** Customer account age in days. */
  accountAgeDays: number;
  /** Number of payment attempts for this order. */
  attemptCount: number;
  /** Number of transactions from this device/email in the last 60 minutes. */
  velocity: number;
  /** Historical chargeback rate for this customer (0..1). */
  priorChargebacks: number;
  /** Historical refund rate for this customer (0..1). */
  priorRefunds: number;
}

export interface NormalizedFeatures {
  amount_deviation: number;
  account_age: number;
  attempt_count: number;
  velocity: number;
  chargeback_history: number;
  refund_history: number;
  amount_magnitude: number;
}

export const FEATURE_NAMES = [
  'amount_deviation',
  'account_age',
  'attempt_count',
  'velocity',
  'chargeback_history',
  'refund_history',
  'amount_magnitude',
] as const;

/** min-max normalization helper clamped to [0,1]. */
export function minMax(value: number, lo: number, hi: number): number {
  if (hi <= lo) return 0;
  const v = (value - lo) / (hi - lo);
  return Math.max(0, Math.min(1, v));
}

/** absolute |amount - merchantAvg| / merchantAvg, scaled 0..4x deviation. */
export function amountDeviation(raw: RawFeatures): number {
  if (raw.merchantAvgAmount <= 0) return 0.5;
  const deviation = Math.abs(raw.amount - raw.merchantAvgAmount) / raw.merchantAvgAmount;
  return minMax(deviation, 0, 4);
}

/** <1 day => 1.0; linear decay to 0.1 by day 30; baseline 0.1 beyond. */
export function accountAge(raw: RawFeatures): number {
  if (raw.accountAgeDays < 1) return 1.0;
  if (raw.accountAgeDays < 30) return minMax(Math.max(0, 30 - raw.accountAgeDays), 0, 30);
  return 0.1;
}

/** attempts in [1,8] mapped linearly. */
export function attemptCount(raw: RawFeatures): number {
  return minMax(Math.max(1, raw.attemptCount), 1, 8);
}

/** velocity (txns in window) in [0,20] mapped linearly. */
export function velocity(raw: RawFeatures): number {
  return minMax(raw.velocity, 0, 20);
}

/** chargeback rate scaled by 4x, capped at 1. */
export function chargebackHistory(raw: RawFeatures): number {
  return Math.min(1, raw.priorChargebacks * 4);
}

/** refund rate scaled by 3x, capped at 1. */
export function refundHistory(raw: RawFeatures): number {
  return Math.min(1, raw.priorRefunds * 3);
}

/** log-scaled amount normalized across typical AOV range 100..200000 INR. */
export function amountMagnitude(raw: RawFeatures): number {
  return minMax(Math.log1p(raw.amount), Math.log1p(100), Math.log1p(200000));
}

/** Compute all 7 normalized features (the model's input vector). */
export function computeFeatures(raw: RawFeatures): NormalizedFeatures {
  return {
    amount_deviation: round5(amountDeviation(raw)),
    account_age: round5(accountAge(raw)),
    attempt_count: round5(attemptCount(raw)),
    velocity: round5(velocity(raw)),
    chargeback_history: round5(chargebackHistory(raw)),
    refund_history: round5(refundHistory(raw)),
    amount_magnitude: round5(amountMagnitude(raw)),
  };
}

function round5(v: number): number {
  return Math.round(v * 100000) / 100000;
}
