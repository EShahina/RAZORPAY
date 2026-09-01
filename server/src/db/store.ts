import type { Config } from '../config.js';
import { SqliteStore } from './sqliteStore.js';
import { MongoStore } from './mongoStore.js';

/** Row/document shapes returned by both backends (snake_case columns). */
export interface TxRow {
  id: string;
  order_id: string;
  merchant_id: string;
  [key: string]: unknown;
}

export interface SimulatorRow {
  amount: number;
  risk_score: number;
  actual_fraud: number;
}

export interface HealthTotals {
  total: number;
  flagged: number;
  reviews: number;
}

export interface AlertsFilter {
  status?: string;
  severity?: string;
}

/**
 * Storage abstraction used by every route + the data service. The API contract
 * is identical for both backends (rows use the same snake_case field names),
 * so the frontend and tests are unaffected by which store is active.
 */
export interface Store {
  readonly kind: 'sqlite' | 'mongodb';

  connect(): Promise<void>;

  // ---- transactions ----
  listTransactions(limit: number, offset: number): Promise<{ rows: TxRow[]; total: number }>;
  getTransaction(idOrOrder: string): Promise<TxRow | null>;
  insertOrReplaceTransaction(tx: Record<string, unknown>): Promise<void>;
  updateMerchantDecision(id: string, decision: string, notes: string | null): Promise<boolean>;
  updateFeedback(id: string, label: string): Promise<boolean>;
  countTransactions(): Promise<number>;
  allTransactionsForSimulator(): Promise<SimulatorRow[]>;
  healthTotals(): Promise<HealthTotals>;

  // ---- customers ----
  listCustomers(): Promise<Record<string, unknown>[]>;
  listCustomerTransactions(customerId: string): Promise<Record<string, unknown>[]>;

  // ---- alerts ----
  listAlerts(filter: AlertsFilter): Promise<Record<string, unknown>[]>;
  acknowledgeAlert(id: string): Promise<boolean>;
  resolveAlert(id: string): Promise<boolean>;

  // ---- disputes / returns ----
  listDisputes(): Promise<Record<string, unknown>[]>;
  listReturns(): Promise<Record<string, unknown>[]>;

  // ---- seeding (idempotent: replaces all rows/documents) ----
  replaceCorpus(transactions: Record<string, unknown>[], customers: Record<string, unknown>[]): Promise<number>;
  replaceAlerts(alerts: Record<string, unknown>[]): Promise<number>;

  close(): Promise<void>;
}

let store: Store | null = null;

/**
 * Initialise the active store. When MONGODB_URI is configured the app uses
 * MongoDB (async connect); otherwise it falls back to the existing SQLite
 * (better-sqlite3) backend so local dev + tests keep working unchanged.
 */
export async function initStore(config: Config, dbPath?: string): Promise<Store> {
  if (store) return store;
  if (config.mongoUri) {
    store = new MongoStore(config.mongoUri, config.mongoDbName);
    await store.connect();
  } else {
    store = new SqliteStore(dbPath ?? config.databasePath);
    await store.connect();
  }
  return store;
}

export function getStore(): Store {
  if (!store) throw new Error('Store not initialized. Call initStore() first.');
  return store;
}

export async function closeStore(): Promise<void> {
  if (store) {
    await store.close();
    store = null;
  }
}