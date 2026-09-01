import type {
  Transaction,
  RiskFactor,
  RiskLevel,
  RiskAction,
  FeedbackLabel,
  PaymentMethod,
  TransactionStatus,
} from '../types';

/**
 * Lightweight typed API client for the MerchantShield backend (Express on :8080).
 * All calls go through relative /api paths which Vite proxies to the server.
 * Every function is defensive: it resolves to `null` on failure so pages can
 * fall back to seed data rather than crashing when offline.
 */

const BASE = '';

async function request<T>(path: string, init?: RequestInit): Promise<{ ok: boolean; status: number; data: T | null }> {
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...init,
    });
    if (!res.ok) return { ok: false, status: res.status, data: null };
    const data = (await res.json()) as T;
    return { ok: true, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: null };
  }
}

/* ------------------------------------------------------------------------ */
/* Serialized backend shapes (snake_case, as returned by SQLite rows)        */
/* ------------------------------------------------------------------------ */

export interface BackendTransactionRow {
  id: string;
  order_id: string;
  merchant_id: string;
  vertical?: string;
  amount: number;
  currency: string;
  payment_method?: string;
  card_bin?: string | null;
  email?: string | null;
  phone?: string | null;
  ip?: string | null;
  device_id?: string | null;
  customer_id?: string | null;
  status: string;
  risk_score: number;
  risk_level: string;
  action: string;
  confidence: number;
  features_json?: string | null;
  factors_json?: string | null;
  explanation?: string | null;
  merchant_decision?: string | null;
  investigation_notes?: string | null;
  feedback?: string | null;
  actual_fraud?: number;
  created_at: string;
}

export interface BackendContribution {
  label: string;
  detail: string;
  normalized: number;
  direction: 'increases' | 'decreases' | 'neutral';
}

export interface ScoreResponse {
  riskScore: number;
  probability: number;
  confidence: number;
  level: RiskLevel;
  action: RiskAction;
  explanation: string;
  modelVersion: string;
  contributions: BackendContribution[];
}

export interface ModelMetricsReport {
  model: {
    modelName: string;
    modelVersion: string;
    trainedAt: string;
    framework: string;
    nFeatures: number;
    nTrees: number;
    featureNames: string[];
  };
  report: Record<string, unknown>;
}

export interface ModelHealthResponse {
  status: string;
  modelVersion: string;
  trainedAt: string;
  nFeatures: number;
  nTrees: number;
  loadedTransactions: number;
  flaggedRate: number;
  reviewRate: number;
}

export interface SimulatorPolicyResponse {
  recoverableLoss: number;
  falsePositiveCost: number;
  falseNegativeCost: number;
  reviewCost: number;
  netProtection: number;
  recall: number;
  falsePositiveRate: number;
  blockedRevenue: number;
  curves: Array<{ threshold: number; netProtection: number; blockedRevenue: number; recall: number }>;
  constants: { falsePositiveCost: number; reviewCost: number; falseNegativeCost: number; avgOrderValue: number };
}

export interface TransactionListResponse {
  data: BackendTransactionRow[];
  total: number;
  limit: number;
  offset: number;
}

/* ------------------------------------------------------------------------ */
/* Mappers                                                                   */
/* ------------------------------------------------------------------------ */

const LEVELS: RiskLevel[] = ['low', 'medium', 'high', 'critical'];
const ACTIONS: RiskAction[] = ['allow', 'verify', 'review', 'block'];
const METHODS: PaymentMethod[] = ['card', 'upi', 'netbanking', 'wallet', 'emi'];
const STATUSES: TransactionStatus[] = ['pending', 'completed', 'failed', 'refunded', 'chargeback'];

function asLevel(v: unknown): RiskLevel {
  return (LEVELS as string[]).includes(String(v)) ? (v as RiskLevel) : 'low';
}
function asAction(v: unknown): RiskAction {
  const s = String(v ?? '').toLowerCase();
  if (s === 'manual_review' || s === 'manual' || s === 'blocked') return 'block';
  return (ACTIONS as string[]).includes(s) ? (s as RiskAction) : 'allow';
}
function asMethod(v: unknown): PaymentMethod {
  const m = String(v ?? 'card');
  return (METHODS as string[]).includes(m) ? (m as PaymentMethod) : 'card';
}
function asStatus(v: unknown): TransactionStatus {
  const s = String(v ?? 'completed');
  return (STATUSES as string[]).includes(s) ? (s as TransactionStatus) : 'completed';
}

function parseContributionList(raw: string | null | undefined): RiskFactor[] {
  if (!raw) return [];
  try {
    const items = JSON.parse(raw) as BackendContribution[];
    const total = items.reduce((sum, c) => sum + c.normalized, 0) || 1;
    return items.map((c) => {
      const weight = total > 0 ? c.normalized / total : 0;
      const contribution = c.direction === 'increases' ? c.normalized * 60 : c.direction === 'decreases' ? -c.normalized * 20 : 0;
      return {
        name: c.label,
        value: c.normalized,
        weight,
        contribution: Math.max(-100, Math.min(100, contribution)),
        description: c.detail,
      };
    });
  } catch {
    return [];
  }
}

function mapTransactionRow(row: BackendTransactionRow): Transaction {
  const factors = parseContributionList(row.factors_json);
  return {
    id: row.id,
    orderId: row.order_id || row.id,
    amount: row.amount,
    currency: row.currency || 'INR',
    paymentMethod: asMethod(row.payment_method),
    customerEmail: row.email || '—',
    customerPhone: row.phone || '—',
    customerIp: row.ip || '—',
    cardBin: row.card_bin ?? undefined,
    cardLast4: undefined,
    upiId: undefined,
    status: asStatus(row.status),
    riskScore: row.risk_score,
    riskLevel: asLevel(row.risk_level),
    recommendedAction: asAction(row.action),
    factors,
    createdAt: row.created_at,
    merchantDecision: row.merchant_decision ? asAction(row.merchant_decision) : undefined,
    feedbackLabel: (['legitimate', 'fraudulent', 'unknown'] as string[]).includes(String(row.feedback ?? ''))
      ? (row.feedback as FeedbackLabel)
      : undefined,
    investigationNotes: row.investigation_notes ?? undefined,
  };
}

/* ------------------------------------------------------------------------ */
/* API functions                                                             */
/* ------------------------------------------------------------------------ */

export async function fetchTransactions(limit = 500): Promise<{ data: Transaction[]; total: number }> {
  const res = await request<TransactionListResponse>(`/api/transactions?limit=${limit}`);
  if (!res.ok || !res.data) return { data: [], total: 0 };
  return { data: res.data.data.map(mapTransactionRow), total: res.data.total };
}

export async function fetchTransactionDetail(id: string): Promise<Transaction | null> {
  const res = await request<BackendTransactionRow>(`/api/transactions/${encodeURIComponent(id)}`);
  if (!res.ok || !res.data) return null;
  return mapTransactionRow(res.data);
}

export async function recordDecision(
  id: string,
  decision: RiskAction,
  notes?: string,
): Promise<boolean> {
  const res = await request<{ ok: boolean }>(`/api/transactions/${encodeURIComponent(id)}/review`, {
    method: 'POST',
    body: JSON.stringify({ decision, notes }),
  });
  return res.ok;
}

export async function recordFeedback(
  id: string,
  label: FeedbackLabel,
): Promise<boolean> {
  const res = await request<{ ok: boolean }>(`/api/transactions/${encodeURIComponent(id)}/feedback`, {
    method: 'POST',
    body: JSON.stringify({ label }),
  });
  return res.ok;
}

export interface ScoreInput {
  amount: number;
  merchantAvgAmount?: number;
  accountAgeDays?: number;
  attemptCount?: number;
  velocity?: number;
  priorChargebacks?: number;
  priorRefunds?: number;
}

export async function scoreTransaction(input: ScoreInput): Promise<ScoreResponse | null> {
  const res = await request<ScoreResponse>('/api/transactions/score', {
    method: 'POST',
    body: JSON.stringify({ merchantAvgAmount: 2000, ...input }),
  });
  return res.data;
}

export async function fetchModelMetrics(): Promise<ModelMetricsReport | null> {
  const res = await request<ModelMetricsReport>('/api/model/metrics');
  return res.data;
}

export async function fetchModelHealth(): Promise<ModelHealthResponse | null> {
  const res = await request<ModelHealthResponse>('/api/model/health');
  return res.data;
}

export async function fetchSimulatorPolicy(threshold = 60): Promise<SimulatorPolicyResponse | null> {
  const res = await request<SimulatorPolicyResponse>(`/api/simulator/policy?threshold=${threshold}`);
  return res.data;
}
