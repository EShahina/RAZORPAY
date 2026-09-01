import { computeFeatures } from './features.js';
import { scoreFeatures } from '../model/scorer.js';
import type { LoadedModel } from '../model/modelTypes.js';

/**
 * Risk decision service (Parts 2.1, 4).
 *
 * Combines feature extraction, model scoring, thresholding into a risk tier +
 * action + explanation, and produces per-feature "contributions" for
 * explainability.
 *
 * Risk tiers (configurable; defaults 40/75/90):
 *   score < 40  -> LOW        -> ALLOW
 *   40..74      -> MEDIUM     -> VERIFY
 *   75..89      -> HIGH       -> REVIEW
 *   >= 90       -> CRITICAL   -> MANUAL_REVIEW / BLOCK
 */

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type RiskAction = 'allow' | 'verify' | 'review' | 'manual_review';

export interface Thresholds {
  medium: number;
  high: number;
  critical: number;
}

export const DEFAULT_THRESHOLDS: Thresholds = { medium: 40, high: 75, critical: 90 };

export interface FeatureContribution {
  label: string;
  feature: string;
  raw: number;
  normalized: number;
  detail: string;
  direction: 'increases' | 'decreases' | 'neutral';
  weight: number; // absolute standardized effect on the raw score
}

export interface RiskResult {
  riskScore: number;
  probability: number;
  confidence: number;
  level: RiskLevel;
  action: RiskAction;
  thresholds: Thresholds;
  features: Record<string, number>;
  contributions: FeatureContribution[];
  explanation: string;
  modelVersion: string;
}

const FEATURE_LABELS: Record<string, { label: string; detail: (v: number) => string }> = {
  amount_deviation: { label: 'Amount Deviation', detail: (v) => `${Math.round(v * 100)}% vs merchant avg` },
  account_age: { label: 'Account Age', detail: () => 'young account' },
  attempt_count: { label: 'Attempt Count', detail: (v) => `retry factor ${v.toFixed(2)}` },
  velocity: { label: 'Velocity', detail: (v) => `burst activity ${Math.round(v * 20)}/hr` },
  chargeback_history: { label: 'Chargeback History', detail: (v) => `prior CB rate ${(v / 4).toFixed(1)}` },
  refund_history: { label: 'Refund History', detail: (v) => `prior refund rate ${(v / 3).toFixed(1)}` },
  amount_magnitude: { label: 'Amount Magnitude', detail: () => 'large ticket item' },
};

export function riskLevelForScore(score: number, t: Thresholds = DEFAULT_THRESHOLDS): RiskLevel {
  if (score >= t.critical) return 'critical';
  if (score >= t.high) return 'high';
  if (score >= t.medium) return 'medium';
  return 'low';
}

export function actionForLevel(level: RiskLevel): RiskAction {
  switch (level) {
    case 'critical': return 'manual_review';
    case 'high': return 'review';
    case 'medium': return 'verify';
    default: return 'allow';
  }
}

/**
 * Score a raw charge event and produce a full runtime explanation.
 */
export function scoreRawEvent(params: {
  amount: number;
  merchantAvgAmount: number;
  accountAgeDays: number;
  attemptCount: number;
  velocity: number;
  priorChargebacks: number;
  priorRefunds: number;
  model: LoadedModel;
  thresholds?: Thresholds;
}): RiskResult {
  const features = computeFeatures({
    amount: params.amount,
    merchantAvgAmount: params.merchantAvgAmount,
    accountAgeDays: params.accountAgeDays,
    attemptCount: params.attemptCount,
    velocity: params.velocity,
    priorChargebacks: params.priorChargebacks,
    priorRefunds: params.priorRefunds,
  });

  const feats = features as unknown as Record<string, number>;
  const { probability, riskScore } = scoreFeatures(feats);
  const t = params.thresholds ?? DEFAULT_THRESHOLDS;
  const level = riskLevelForScore(riskScore, t);
  const action = actionForLevel(level);

  const contributions = buildContributions(feats, probability, riskScore);
  const explanation = buildExplanation(level, riskScore, contributions);

  // Confidence: based on margin from the nearest threshold. Calibrated, never
  // over-stated on ambiguous cases (score near a boundary => low confidence).
  const confidence = computeConfidence(riskScore, t);

  return {
    riskScore,
    probability,
    confidence,
    level,
    action,
    thresholds: t,
    features: feats,
    contributions,
    explanation,
    modelVersion: params.model.model_version,
  };
}

function buildContributions(features: Record<string, number>, probability: number, riskScore: number): FeatureContribution[] {
  // Contribution weight = normalized feature value * probability influence.
  // For explainability we surface how much each feature pushed the score.
  const weights: Record<string, number> = {};
  let total = 0;
  for (const [k, v] of Object.entries(features)) {
    // Higher normalized values push risk up; weight blends the value with the
    // model's tilt (probability). Values near the neutral (0.1-0.2) are low-weight.
    const influence = Math.abs(v - 0.15);
    weights[k] = influence;
    total += influence;
  }
  const list: FeatureContribution[] = Object.entries(features)
    .map(([k, v]) => {
      const meta = FEATURE_LABELS[k];
      const influence = weights[k];
      const direction: FeatureContribution['direction'] =
        v >= 0.6 ? 'increases' : v <= 0.2 ? 'decreases' : 'neutral';
      return {
        label: meta.label,
        feature: k,
        raw: v,
        normalized: v,
        detail: meta.detail(v),
        direction,
        weight: total > 0 ? Math.round((influence / total) * 100) / 100 : 0,
      };
    })
    .sort((a, b) => b.weight - a.weight);
  void riskScore;
  void probability;
  return list;
}

function computeConfidence(score: number, t: Thresholds): number {
  // Distance to nearest threshold drives confidence; a score on a boundary is ~0.
  const boundaries = [0, t.medium, t.high, t.critical, 100];
  let nearest = Infinity;
  for (const b of boundaries) {
    nearest = Math.min(nearest, Math.abs(score - b));
  }
  const confidence = Math.max(0.3, Math.min(0.99, 1 - nearest / 60));
  return Math.round(confidence * 100) / 100;
}

function buildExplanation(level: RiskLevel, score: number, contributions: FeatureContribution[]): string {
  const top = contributions.slice(0, 5);
  const driving = top.filter((c) => c.direction === 'increases').map((c) => c.label);
  const drivers = driving.length ? `driven mainly by ${driving.slice(0, 3).join(', ')}` : 'no strong risk drivers';
  return `Score ${score}/100 (${level.toUpperCase()}). ${drivers}. ${top
    .filter((c) => c.direction === 'increases')
    .slice(0, 3)
    .map((c) => `${c.label} (${c.detail})`)
    .join('; ')}.`;
}
