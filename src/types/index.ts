export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type RiskAction = 'allow' | 'verify' | 'review' | 'block';
export type AlertSeverity = 'info' | 'warning' | 'critical';
export type AlertStatus = 'active' | 'acknowledged' | 'resolved';
export type TransactionStatus = 'pending' | 'completed' | 'failed' | 'refunded' | 'chargeback';
export type ChargebackStatus = 'open' | 'evidence_submitted' | 'won' | 'lost' | 'pending_review';
export type ReturnStatus = 'initiated' | 'approved' | 'denied' | 'completed';
export type PaymentMethod = 'card' | 'upi' | 'netbanking' | 'wallet' | 'emi';
export type FeedbackLabel = 'legitimate' | 'fraudulent' | 'unknown';

export interface Transaction {
  id: string;
  orderId: string;
  amount: number;
  currency: string;
  paymentMethod: PaymentMethod;
  customerEmail: string;
  customerPhone: string;
  customerIp: string;
  cardBin?: string;
  cardLast4?: string;
  upiId?: string;
  status: TransactionStatus;
  riskScore: number;
  riskLevel: RiskLevel;
  recommendedAction: RiskAction;
  factors: RiskFactor[];
  createdAt: string;
  merchantDecision?: RiskAction;
  feedbackLabel?: FeedbackLabel;
  investigationNotes?: string;
}

export interface RiskFactor {
  name: string;
  value: number;
  weight: number;
  contribution: number;
  description: string;
}

export interface RiskAnalysis {
  transactionId: string;
  score: number;
  level: RiskLevel;
  action: RiskAction;
  factors: RiskFactor[];
  financialImpact: FinancialImpact;
  timestamp: string;
}

export interface FinancialImpact {
  exposure: number;
  recoverableLoss: number;
  falsePositiveCost: number;
  netProtection: number;
}

export interface Alert {
  id: string;
  title: string;
  description: string;
  severity: AlertSeverity;
  status: AlertStatus;
  transactionIds: string[];
  totalExposure: number;
  createdAt: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
  spikeData?: SpikeData;
}

export interface SpikeData {
  baselineCount: number;
  currentCount: number;
  spikePercent: number;
  windowMinutes: number;
  normalRange: [number, number];
}

export interface Customer {
  id: string;
  email: string;
  phone: string;
  name: string;
  accountAge: number;
  totalTransactions: number;
  totalSpent: number;
  chargebackCount: number;
  refundCount: number;
  avgRiskScore: number;
  riskLevel: RiskLevel;
  createdAt: string;
}

export interface Chargeback {
  id: string;
  transactionId: string;
  customerId: string;
  amount: number;
  reason: string;
  status: ChargebackStatus;
  evidence?: string;
  filedAt: string;
  resolvedAt?: string;
}

export interface Return {
  id: string;
  transactionId: string;
  customerId: string;
  amount: number;
  reason: string;
  status: ReturnStatus;
  riskScore: number;
  riskLevel: RiskLevel;
  initiatedAt: string;
  completedAt?: string;
}

export interface WebhookEvent {
  id: string;
  eventType: string;
  payload: Record<string, unknown>;
  receivedAt: string;
  processed: boolean;
}

export interface PolicyRule {
  id: string;
  name: string;
  field: string;
  operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte' | 'contains';
  threshold: number;
  action: RiskAction;
  enabled: boolean;
}

export interface ModelMetrics {
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  auc: number;
  falsePositiveRate: number;
  truePositiveRate: number;
  confusionMatrix: { tp: number; tn: number; fp: number; fn: number };
  evaluatedAt: string;
  sampleSize: number;
}

export interface ModelDrift {
  featureName: string;
  baselineMean: number;
  currentMean: number;
  driftPercent: number;
  isDrifting: boolean;
}

export interface DemoScenario {
  id: string;
  name: string;
  description: string;
  amount: number;
  paymentMethod: PaymentMethod;
  customerEmail: string;
  expectedRisk: RiskLevel;
  expectedAction: RiskAction;
  tags: string[];
}

export interface DailyStats {
  date: string;
  transactions: number;
  totalVolume: number;
  highRiskCount: number;
  blockedCount: number;
  chargebackCount: number;
  avgRiskScore: number;
}
