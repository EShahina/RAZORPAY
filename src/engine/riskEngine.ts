import type { Transaction, RiskFactor, RiskAnalysis, RiskLevel, RiskAction, FinancialImpact, PolicyRule } from '../types';

const FEATURE_WEIGHTS = {
  amountDeviation: 0.20,
  accountAge: 0.15,
  attemptCount: 0.15,
  velocity: 0.15,
  chargebackHistory: 0.15,
  refundHistory: 0.10,
  ipRisk: 0.10,
};

function calculateAmountDeviation(transaction: Transaction, avgAmount: number): number {
  if (avgAmount === 0) return 0.5;
  const deviation = Math.abs(transaction.amount - avgAmount) / avgAmount;
  return Math.min(1, deviation / 3);
}

function calculateAccountAgeFactor(accountAgeDays: number): number {
  if (accountAgeDays < 1) return 1.0;
  if (accountAgeDays < 7) return 0.8;
  if (accountAgeDays < 30) return 0.6;
  if (accountAgeDays < 90) return 0.3;
  return 0.1;
}

function calculateAttemptFactor(attemptCount: number): number {
  return Math.min(1, (attemptCount - 1) * 0.3);
}

function calculateVelocityFactor(recentTxCount: number): number {
  return Math.min(1, recentTxCount / 10);
}

function calculateChargebackFactor(chargebackRate: number): number {
  return Math.min(1, chargebackRate * 5);
}

function calculateRefundFactor(refundRate: number): number {
  return Math.min(1, refundRate * 3);
}

function calculateIpRiskFactor(ip: string): number {
  let hash = 0;
  for (let i = 0; i < ip.length; i++) {
    hash = ((hash << 5) - hash + ip.charCodeAt(i)) | 0;
  }
  return Math.abs(hash % 100) / 100;
}

export function analyzeTransaction(
  transaction: Transaction,
  context: {
    avgAmount: number;
    accountAgeDays: number;
    recentTxCount: number;
    chargebackRate: number;
    refundRate: number;
  },
  policyRules?: PolicyRule[]
): RiskAnalysis {
  const factors: RiskFactor[] = [
    {
      name: 'Amount Deviation',
      value: calculateAmountDeviation(transaction, context.avgAmount),
      weight: FEATURE_WEIGHTS.amountDeviation,
      contribution: calculateAmountDeviation(transaction, context.avgAmount) * FEATURE_WEIGHTS.amountDeviation,
      description: `Transaction amount ₹${transaction.amount} vs avg ₹${context.avgAmount}`,
    },
    {
      name: 'Account Age',
      value: calculateAccountAgeFactor(context.accountAgeDays),
      weight: FEATURE_WEIGHTS.accountAge,
      contribution: calculateAccountAgeFactor(context.accountAgeDays) * FEATURE_WEIGHTS.accountAge,
      description: `Account is ${context.accountAgeDays} days old`,
    },
    {
      name: 'Attempt Count',
      value: calculateAttemptFactor(transaction.amount > 0 ? Math.ceil(transaction.amount / 1000) : 1),
      weight: FEATURE_WEIGHTS.attemptCount,
      contribution: calculateAttemptFactor(Math.max(1, Math.ceil(transaction.amount / 5000))) * FEATURE_WEIGHTS.attemptCount,
      description: `Payment attempt pattern analysis`,
    },
    {
      name: 'Velocity',
      value: calculateVelocityFactor(context.recentTxCount),
      weight: FEATURE_WEIGHTS.velocity,
      contribution: calculateVelocityFactor(context.recentTxCount) * FEATURE_WEIGHTS.velocity,
      description: `${context.recentTxCount} transactions in last hour`,
    },
    {
      name: 'Chargeback History',
      value: calculateChargebackFactor(context.chargebackRate),
      weight: FEATURE_WEIGHTS.chargebackHistory,
      contribution: calculateChargebackFactor(context.chargebackRate) * FEATURE_WEIGHTS.chargebackHistory,
      description: `Chargeback rate: ${(context.chargebackRate * 100).toFixed(1)}%`,
    },
    {
      name: 'Refund History',
      value: calculateRefundFactor(context.refundRate),
      weight: FEATURE_WEIGHTS.refundHistory,
      contribution: calculateRefundFactor(context.refundRate) * FEATURE_WEIGHTS.refundHistory,
      description: `Refund rate: ${(context.refundRate * 100).toFixed(1)}%`,
    },
    {
      name: 'IP Risk',
      value: calculateIpRiskFactor(transaction.customerIp),
      weight: FEATURE_WEIGHTS.ipRisk,
      contribution: calculateIpRiskFactor(transaction.customerIp) * FEATURE_WEIGHTS.ipRisk,
      description: `IP address risk assessment`,
    },
  ];

  const rawScore = factors.reduce((sum, f) => sum + f.contribution, 0);
  const score = Math.round(Math.min(100, Math.max(0, rawScore * 100)));

  let overriddenAction: RiskAction | null = null;
  if (policyRules) {
    for (const rule of policyRules) {
      if (!rule.enabled) continue;
      const fieldValue = getFieldValue(transaction, rule.field);
      if (fieldValue !== null && compareValues(fieldValue, rule.threshold, rule.operator)) {
        overriddenAction = rule.action;
      }
    }
  }

  const level = getRiskLevel(score);
  const action = overriddenAction || getRecommendedAction(level);
  const financialImpact = calculateFinancialImpact(transaction.amount, score, level);

  return {
    transactionId: transaction.id,
    score,
    level,
    action,
    factors,
    financialImpact,
    timestamp: new Date().toISOString(),
  };
}

function getFieldValue(transaction: Transaction, field: string): number | null {
  switch (field) {
    case 'amount': return transaction.amount;
    case 'riskScore': return transaction.riskScore;
    default: return null;
  }
}

function compareValues(value: number, threshold: number, operator: string): boolean {
  switch (operator) {
    case 'gt': return value > threshold;
    case 'lt': return value < threshold;
    case 'eq': return value === threshold;
    case 'gte': return value >= threshold;
    case 'lte': return value <= threshold;
    default: return false;
  }
}

function getRiskLevel(score: number): RiskLevel {
  if (score >= 80) return 'critical';
  if (score >= 60) return 'high';
  if (score >= 30) return 'medium';
  return 'low';
}

function getRecommendedAction(level: RiskLevel): RiskAction {
  if (level === 'critical') return 'block';
  if (level === 'high') return 'review';
  if (level === 'medium') return 'verify';
  return 'allow';
}

function calculateFinancialImpact(amount: number, score: number, level: RiskLevel): FinancialImpact {
  const riskProb = score / 100;
  const exposure = amount * riskProb;
  const recoverableLoss = exposure * 0.6;
  const falsePositiveCost = level === 'medium' ? amount * 0.05 : 0;
  const netProtection = recoverableLoss - falsePositiveCost;
  return {
    exposure: Math.round(exposure * 100) / 100,
    recoverableLoss: Math.round(recoverableLoss * 100) / 100,
    falsePositiveCost: Math.round(falsePositiveCost * 100) / 100,
    netProtection: Math.round(netProtection * 100) / 100,
  };
}

export function getRiskColor(level: RiskLevel): string {
  switch (level) {
    case 'critical': return '#ef4444';
    case 'high': return '#f97316';
    case 'medium': return '#eab308';
    case 'low': return '#22c55e';
  }
}

export function getActionColor(action: RiskAction): string {
  switch (action) {
    case 'block': return '#ef4444';
    case 'review': return '#f97316';
    case 'verify': return '#eab308';
    case 'allow': return '#22c55e';
  }
}
