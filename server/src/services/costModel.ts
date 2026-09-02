/**
 * Business-cost simulator (Part 5).
 *
 * For a given decision threshold, we classify the scored corpus into actions and
 * estimate the merchant's financial outcome. All costs are configurable constants
 * (from env / request), so the merchant can slide the threshold and watch money
 * move in real time.
 *
 * Cost model per transaction:
 *   - False positive (legit wrongly flagged risky / reviewed or blocked):
 *         fpCost = falsePositiveCost (lost AOV + goodwill + support touch)
 *   - Reviewed transaction (manual review of a HIGH/CRITICAL case):
 *         reviewCost = reviewCost (fraud-analyst labor)
 *   - False negative (fraud we allowed through):
 *         fnCost = falseNegativeCost (chargeback + dispute fee + shipping)
 *   - True positive (fraud we blocked):
 *         saved = amount (we avoid the chargeback loss)
 *
 * Net protection = value of fraud prevented - cost of false positives - review labor.
 */

export interface CostConstants {
  falsePositiveCost: number; // INR per false positive
  reviewCost: number;        // INR per manual review
  falseNegativeCost: number; // INR per fraud that slipped through
  avgOrderValue: number;     // INR
}

export interface ScoreRow {
  amount: number;
  riskScore: number;   // 0..100 model risk score
  actualFraud: boolean; // ground-truth label from the corpus
}

export type SimulatedAction = 'allow' | 'verify' | 'review' | 'block';

/**
 * Classify a transaction's simulated action given the merchant's decision
 * threshold. The threshold is the single policy dial: it is the risk-score
 * boundary above which a transaction is flagged at all. Sliding it lower
 * flags more transactions (higher recall, more false positives); sliding it
 * higher flags fewer (lower recall, fewer false positives). This ensures the
 * merchant can watch net protection vs blocked revenue change in real time
 * (Part 5.2).
 *
 *   score <  threshold          -> allow
 *   score <  threshold + 15      -> verify
 *   score <  threshold + 35      -> review
 *   score >= threshold + 35      -> block (manual_review)
 */
export function actionForScore(riskScore: number, threshold: number): SimulatedAction {
  if (riskScore < threshold) return 'allow';
  if (riskScore < threshold + 15) return 'verify';
  if (riskScore < threshold + 35) return 'review';
  return 'block';
}

export interface SimulationResult {
  threshold: number;
  counts: Record<SimulatedAction, number>;
  blockedRevenue: number;
  recoverableLoss: number;   // fraud value that (approximately) is prevented
  falsePositiveCost: number;
  reviewCost: number;
  falseNegativeCost: number;
  netProtection: number;     // recoverableLoss - falsePositiveCost - reviewCost
  totalVolume: number;
  fraudVolume: number;
  recall: number;            // fraction of fraud caught above threshold
  falsePositiveRate: number; // fraction of legit flagged above threshold
}

export function runSimulation(rows: ScoreRow[], threshold: number, c: CostConstants): SimulationResult {
  const counts: Record<SimulatedAction, number> = { allow: 0, verify: 0, review: 0, block: 0 };
  let totalVolume = 0;
  let fraudVolume = 0;
  let flaggedLegitAmount = 0;
  let flaggedLegitCount = 0;
  let flaggedFraudCount = 0;
  let fraudCaughtCount = 0;
  let fraudCaughtAmount = 0;
  let reviewCount = 0;

  for (const row of rows) {
    totalVolume += row.amount;
    if (row.actualFraud) fraudVolume += row.amount;
    const action = actionForScore(row.riskScore, threshold);
    counts[action] += 1;
    if (action !== 'allow') {
      if (row.actualFraud) {
        fraudCaughtCount += 1;
        fraudCaughtAmount += row.amount;
      } else {
        flaggedLegitCount += 1;
        flaggedLegitAmount += row.amount;
      }
      if (action === 'review' || action === 'block') reviewCount += 1;
    } else if (row.actualFraud) {
      flaggedFraudCount += 1;
    }
  }

  const fraudCount = rows.filter((r) => r.actualFraud).length;
  const recall = fraudCount > 0 ? fraudCaughtCount / fraudCount : 0;
  const fpr = rows.length - fraudCount > 0 ? flaggedLegitCount / (rows.length - fraudCount) : 0;

  // Recoverable loss: fraud value blocked above the action threshold
  const recoverableLoss = fraudCaughtAmount;
  // False positives: legit revenue flagged (lost AOV) — modelled as a fraction of
  // flagged legit value because with VERIFY we can recover some (only REVIEW/BLOCK
  // truly lose it). We apply fpCost per flagged-legit transaction as the constant.
  const falsePositiveCost = flaggedLegitCount * c.falsePositiveCost;
  const reviewCostTotal = reviewCount * c.reviewCost;
  // False negative: fraud let through
  const falseNegativeTotal = flaggedFraudCount * c.falseNegativeCost;

  const netProtection = recoverableLoss - falsePositiveCost - reviewCostTotal;

  return {
    threshold,
    counts,
    blockedRevenue: flaggedLegitAmount + fraudCaughtAmount,
    recoverableLoss: round2(recoverableLoss),
    falsePositiveCost: round2(falsePositiveCost),
    reviewCost: round2(reviewCostTotal),
    falseNegativeCost: round2(falseNegativeTotal),
    netProtection: round2(netProtection),
    totalVolume: round2(totalVolume),
    fraudVolume: round2(fraudVolume),
    recall: round4(recall),
    falsePositiveRate: round4(fpr),
  };
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}
function round4(v: number): number {
  return Math.round(v * 10000) / 10000;
}
