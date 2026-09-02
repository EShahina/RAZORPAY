import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scoreRawEvent } from './risk.js';
import { getModel, loadModel } from '../model/scorer.js';
import { getStore } from '../db/store.js';
import { logger } from '../lib/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface SeededTx {
  id: string;
  order_id: string;
  merchant_id: string;
  amount: number;
  payment_method: string;
  email: string;
  phone: string;
  device_id: string;
  customer_id: string;
  created: string;
  actualFraud: boolean;
  features: Record<string, number>;
  riskScore: number;
  level: string;
  action: string;
}

/**
 * Load the synthetic labeled corpus from the bundled CSV (20k rows) so the demo
 * and /api/seed can run fully offline. Returns the parsed rows (lazily cached).
 */
let cachedRows: SeededTx[] | null = null;

export function loadCorpusRows(): SeededTx[] {
  if (cachedRows) return cachedRows;
  const csvPath = resolveCsvPath();
  const text = fs.readFileSync(csvPath, 'utf-8');
  const lines = text.split('\n').filter((l) => l.length > 0);
  const header = lines[0].split(',');
  const idx = (name: string) => header.indexOf(name);
  const rows: SeededTx[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    if (cols.length < 2) continue;
    const f = (name: string) => cols[idx(name)];
    const n = (name: string) => parseFloat(f(name));
    rows.push({
      id: `txn_${i - 1}`,
      order_id: f('order_id'),
      merchant_id: f('merchant_id'),
      amount: n('amount'),
      payment_method: f('payment_method'),
      email: f('email'),
      phone: f('phone'),
      device_id: f('device_id'),
      customer_id: f('customer_id'),
      created: f('timestamp'),
      actualFraud: parseInt(f('is_fraud'), 10) === 1,
      features: {
        amount_deviation: n('amount_deviation'),
        account_age: n('account_age'),
        attempt_count: n('attempt_count'),
        velocity: n('velocity'),
        chargeback_history: n('chargeback_history'),
        refund_history: n('refund_history'),
        amount_magnitude: n('amount_magnitude'),
      },
      riskScore: 0,
      level: 'low',
      action: 'allow',
    });
  }
  cachedRows = rows;
  return rows;
}

function resolveCsvPath(): string {
  const candidates = [
    path.resolve(__dirname, '../data/corpus.csv'),
    path.resolve(__dirname, '../../ml/data/corpus.csv'),
  ];
  for (const c of candidates) if (fs.existsSync(c)) return c;
  throw new Error(`Corpus CSV not found (tried ${candidates.join(', ')})`);
}

function parseCsvLine(line: string): string[] {
  // simple split; the corpus has no embedded commas/quotes in the needed fields
  return line.split(',');
}

/**
 * Regenerate the corpus from the CSV, scoring each row with the real model.
 * Replaces all existing rows/documents (idempotent seed) — used by POST /api/seed
 * and startup. Works on whichever store is active (SQLite or MongoDB).
 */
export async function seedDatabase(modelPath: string): Promise<number> {
  loadModel(modelPath);
  const model = getModel();
  const rows = loadCorpusRows();
  const transactions: Record<string, unknown>[] = [];
  const customers: Record<string, unknown>[] = [];

  for (const row of rows) {
    const result = scoreRawEvent({
      amount: row.amount,
      merchantAvgAmount: 2000,
      accountAgeDays: Math.max(0, Math.round(30 - row.features.account_age * 30)),
      attemptCount: 1 + Math.round(row.features.attempt_count * 7),
      velocity: Math.round(row.features.velocity * 20),
      priorChargebacks: row.features.chargeback_history / 4,
      priorRefunds: row.features.refund_history / 3,
      model,
    });
    customers.push({
      id: row.customer_id,
      email: row.email,
      phone: row.phone,
      name: '',
      account_age_days: Math.max(0, Math.round(30 - row.features.account_age * 30)),
      prior_chargebacks: row.features.chargeback_history / 4,
      prior_refunds: row.features.refund_history / 3,
      created_at: row.created,
    });
    transactions.push({
      id: row.id,
      order_id: row.order_id,
      merchant_id: row.merchant_id,
      vertical: 'ecommerce',
      amount: row.amount,
      currency: 'INR',
      payment_method: row.payment_method,
      email: row.email,
      phone: row.phone,
      device_id: row.device_id,
      customer_id: row.customer_id,
      status: 'completed',
      risk_score: result.riskScore,
      risk_level: result.level,
      action: result.action,
      confidence: result.confidence,
      features_json: JSON.stringify(row.features),
      factors_json: JSON.stringify(result.contributions),
      explanation: result.explanation,
      actual_fraud: row.actualFraud ? 1 : 0,
      created_at: row.created,
    });
  }

  const count = await getStore().replaceCorpus(transactions, customers);
  const alertCount = await getStore().replaceAlerts(buildSeedAlerts(transactions));
  logger.info({ count, alertCount }, 'database seeded from corpus');
  return count;
}

/** Deterministic set of operational alerts derived from the seeded transactions. */
function buildSeedAlerts(transactions: Record<string, unknown>[]): Record<string, unknown>[] {
  const first = (n: number) => transactions
    .filter((t) => Number(t.risk_score) >= 75)
    .slice(0, n)
    .map((t) => String(t.id));
  const totalExposure = (ids: string[]) =>
    ids.reduce((sum, id) => {
      const t = transactions.find((x) => x.id === id);
      return sum + (t ? Number(t.amount) || 0 : 0);
    }, 0);

  const activeHighRisk = first(3);
  return [
    {
      id: 'ALERT-001',
      title: 'UPI Transaction Velocity Spike',
      description: 'Detected a rapid increase in high-risk transactions across your storefront in the last 15 minutes.',
      severity: 'critical',
      status: 'active',
      transaction_ids: JSON.stringify(activeHighRisk),
      total_exposure: totalExposure(activeHighRisk),
      spike_json: JSON.stringify({ baselineCount: 5, currentCount: 22, spikePercent: 340, windowMinutes: 15 }),
      created_at: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
      acknowledged_at: null,
      resolved_at: null,
    },
    {
      id: 'ALERT-002',
      title: 'High-Value Card Transaction from New Account',
      description: 'A high-value card transaction was attempted from a newly created account with an out-of-country card BIN.',
      severity: 'critical',
      status: 'active',
      transaction_ids: JSON.stringify([activeHighRisk[0] ?? '']),
      total_exposure: activeHighRisk[0] ? Number(transactions.find((t) => t.id === activeHighRisk[0])?.amount) || 0 : 0,
      spike_json: null,
      created_at: new Date(Date.now() - 35 * 60 * 1000).toISOString(),
      acknowledged_at: null,
      resolved_at: null,
    },
    {
      id: 'ALERT-003',
      title: 'Multiple Failed Payment Attempts',
      description: 'Multiple successive payment failures detected from disposable email accounts within a short window.',
      severity: 'warning',
      status: 'acknowledged',
      transaction_ids: JSON.stringify([activeHighRisk[1] ?? '']),
      total_exposure: activeHighRisk[1] ? Number(transactions.find((t) => t.id === activeHighRisk[1])?.amount) || 0 : 0,
      spike_json: null,
      created_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
      acknowledged_at: new Date(Date.now() - 2.5 * 60 * 60 * 1000).toISOString(),
      resolved_at: null,
    },
    {
      id: 'ALERT-004',
      title: 'Account Takeover Suspected',
      description: 'A large netbanking transaction from an account created days ago. Impossible-travel detected between login locations.',
      severity: 'critical',
      status: 'active',
      transaction_ids: JSON.stringify([activeHighRisk[2] ?? '']),
      total_exposure: activeHighRisk[2] ? Number(transactions.find((t) => t.id === activeHighRisk[2])?.amount) || 0 : 0,
      spike_json: null,
      created_at: new Date(Date.now() - 28 * 60 * 1000).toISOString(),
      acknowledged_at: null,
      resolved_at: null,
    },
    {
      id: 'ALERT-005',
      title: 'Card Testing Pattern Detected',
      description: 'Multiple micro-transactions from different cards originating from the same IP and disposable email.',
      severity: 'warning',
      status: 'resolved',
      transaction_ids: JSON.stringify([activeHighRisk[0] ?? '']),
      total_exposure: activeHighRisk[0] ? Number(transactions.find((t) => t.id === activeHighRisk[0])?.amount) || 0 : 0,
      spike_json: null,
      created_at: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
      acknowledged_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
      resolved_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'ALERT-006',
      title: 'High Refund Rate on Customer Account',
      description: 'A customer has a rising refund rate with an increasing average risk score.',
      severity: 'info',
      status: 'acknowledged',
      transaction_ids: JSON.stringify([activeHighRisk[1] ?? '']),
      total_exposure: activeHighRisk[1] ? Number(transactions.find((t) => t.id === activeHighRisk[1])?.amount) || 0 : 0,
      spike_json: null,
      created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      acknowledged_at: new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString(),
      resolved_at: null,
    },
    {
      id: 'ALERT-007',
      title: 'Bot Activity on Payment Gateway',
      description: 'Automated bot pattern detected with many payment attempts in a short window from a known proxy IP.',
      severity: 'critical',
      status: 'resolved',
      transaction_ids: JSON.stringify([activeHighRisk[2] ?? '']),
      total_exposure: activeHighRisk[2] ? Number(transactions.find((t) => t.id === activeHighRisk[2])?.amount) || 0 : 0,
      spike_json: null,
      created_at: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
      acknowledged_at: new Date(Date.now() - 70 * 60 * 1000).toISOString(),
      resolved_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    },
  ];
}

export type MerchantDecision = 'allow' | 'verify' | 'review' | 'manual_review' | 'block';

/**
 * Seed the operational alerts whenever the alerts store is empty, deriving them
 * from high-risk transactions already present in the store. This runs on every
 * startup so a pre-populated (Mongo) store still gets alerts without forcing a
 * full corpus re-seed that would wipe merchant decisions/feedback.
 */
export async function seedAlertsIfEmpty(): Promise<number> {
  const existing = await getStore().listAlerts({});
  if (existing.length > 0) return 0;
  const { rows } = await getStore().listTransactions(500, 0);
  const txs = rows.map((t) => ({
    id: t.id,
    risk_score: t.risk_score,
    amount: t.amount,
  }));
  return getStore().replaceAlerts(buildSeedAlerts(txs));
}

/** Record a merchant's final decision on a transaction (Part 6: human-in-the-loop). */
export async function recordMerchantDecision(
  txnId: string,
  decision: MerchantDecision,
  notes?: string,
): Promise<boolean> {
  return getStore().updateMerchantDecision(txnId, decision, notes ?? null);
}

/** Record fraud feedback (ground truth) for model monitoring/eval. */
export async function recordFeedback(txnId: string, label: string): Promise<boolean> {
  return getStore().updateFeedback(txnId, label);
}

export function countTransactions(): Promise<number> {
  return getStore().countTransactions();
}
