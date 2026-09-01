import { describe, it, expect } from 'vitest';
import { runSimulation, actionForScore, type ScoreRow, type CostConstants } from '../src/services/costModel.js';

const COST: CostConstants = {
  falsePositiveCost: 250,
  reviewCost: 25,
  falseNegativeCost: 900,
  avgOrderValue: 2000,
};

function row(amount: number, riskScore: number, actualFraud: boolean): ScoreRow {
  return { amount, riskScore, actualFraud };
}

describe('Business-cost simulator math (Part 5 / Part 7.1)', () => {
  const rows: ScoreRow[] = [
    // 3 fraudulent transactions (all should be caught at any reasonable threshold given high scores)
    row(1000, 95, true),
    row(2000, 90, true),
    row(3000, 85, true),
    // 2 legitimate transactions that get flagged (false positives) at a low threshold
    row(500, 50, false),
    row(700, 55, false),
    // 1 legitimate that should be allowed through
    row(300, 10, false),
  ];

  it('recovers fraud value that is blocked above the decision threshold', () => {
    const r = runSimulation(rows, 40, COST);
    // all 3 fraud have score >= 85 > 40 -> caught
    expect(r.recoverableLoss).toBe(1000 + 2000 + 3000);
  });

  it('counts false positives on flagged legit transactions using fpCost constant', () => {
    const r = runSimulation(rows, 40, COST);
    // legit flagged: 500 (score 50) & 700 (score 55); 300 (score 10) is allowed
    expect(r.falsePositiveCost).toBe(2 * COST.falsePositiveCost);
  });

  it('counts manual review labor only for review/block actions', () => {
    const r = runSimulation(rows, 40, COST);
    // fraud at 95/90 -> block, 85 -> block (>=75); legit at 55 -> review,
    // legit at 50 -> verify. review/block actions = 4.
    expect(r.reviewCost).toBe(4 * COST.reviewCost);
  });

  it('computes net protection = recoverableLoss - FP cost - review labor', () => {
    const r = runSimulation(rows, 40, COST);
    const expected = (1000 + 2000 + 3000) - (2 * 250) - (4 * 25);
    expect(r.netProtection).toBe(expected);
  });

  it('calculates recall and false-positive-rate correctly', () => {
    const r = runSimulation(rows, 40, COST);
    expect(r.recall).toBe(1); // all 3 fraud caught
    // FPR = flagged legit / total legit = 2 / 3
    expect(r.falsePositiveRate).toBeCloseTo(2 / 3, 4);
  });

  it('a lenient threshold flags more and a strict threshold flags less (Part 5 slider)', () => {
    const lenient = runSimulation(rows, 10, COST);
    const strict = runSimulation(rows, 97, COST);
    // Lenient: even the low-risk legit (score 10) is now flagged -> more FPs
    expect(lenient.falsePositiveRate).toBeGreaterThan(strict.falsePositiveRate);
    // Strict: fewer fraud caught -> lower recall
    expect(strict.recall).toBeLessThan(lenient.recall);
    // Net protection falls as the threshold rises away from the optimal point
    expect(strict.netProtection).toBeLessThan(lenient.netProtection);
  });

  it('actionForScore maps a sliding threshold to allow/verify/review/block', () => {
    expect(actionForScore(30, 40)).toBe('allow');
    expect(actionForScore(45, 40)).toBe('verify');
    expect(actionForScore(60, 40)).toBe('review');
    expect(actionForScore(80, 40)).toBe('block');
    // Same score is allowed under a stricter threshold
    expect(actionForScore(45, 90)).toBe('allow');
  });
});
