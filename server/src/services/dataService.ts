import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scoreRawEvent } from './risk.js';
import { computeFeatures } from './features.js';
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
  logger.info({ count }, 'database seeded from corpus');
  return count;
}

export type MerchantDecision = 'allow' | 'verify' | 'review' | 'manual_review' | 'block';

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
