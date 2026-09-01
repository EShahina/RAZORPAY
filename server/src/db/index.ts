import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

/**
 * SQLite persistence layer (Part 2.5).
 *
 * Stores transactions, alerts, customers, disputes (chargebacks), and the active
 * model version. Replaces the prototype's localStorage with a real, durable store.
 */

export interface Db {
  raw: Database.Database;
  insertTransaction(t: unknown): void;
  insertCustomer(c: unknown): void;
  insertAlert(a: unknown): void;
  insertDispute(d: unknown): void;
}

let dbInstance: Database.Database | null = null;

export function initDb(dbPath: string): Database.Database {
  if (dbInstance) return dbInstance;
  if (dbPath !== ':memory:') {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  migrate(db);
  dbInstance = db;
  return db;
}

function migrate(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS model_versions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      model_version TEXT NOT NULL,
      model_name TEXT NOT NULL,
      trained_at TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      phone TEXT NOT NULL,
      name TEXT,
      account_age_days INTEGER NOT NULL DEFAULT 0,
      prior_chargebacks REAL NOT NULL DEFAULT 0,
      prior_refunds REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      merchant_id TEXT NOT NULL,
      vertical TEXT,
      amount REAL NOT NULL,
      currency TEXT NOT NULL DEFAULT 'INR',
      payment_method TEXT,
      card_bin TEXT,
      email TEXT,
      phone TEXT,
      ip TEXT,
      device_id TEXT,
      customer_id TEXT,
      status TEXT NOT NULL DEFAULT 'completed',
      risk_score INTEGER NOT NULL,
      risk_level TEXT NOT NULL,
      action TEXT NOT NULL,
      confidence REAL NOT NULL,
      features_json TEXT,
      factors_json TEXT,
      explanation TEXT,
      merchant_decision TEXT,
      investigation_notes TEXT,
      feedback TEXT,
      actual_fraud INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY (customer_id) REFERENCES customers(id)
    );
    CREATE INDEX IF NOT EXISTS idx_tx_created ON transactions(created_at);
    CREATE INDEX IF NOT EXISTS idx_tx_risk ON transactions(risk_score);

    CREATE TABLE IF NOT EXISTS alerts (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      severity TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      transaction_ids TEXT,
      total_exposure REAL NOT NULL DEFAULT 0,
      spike_json TEXT,
      created_at TEXT NOT NULL,
      acknowledged_at TEXT,
      resolved_at TEXT
    );

    CREATE TABLE IF NOT EXISTS disputes (
      id TEXT PRIMARY KEY,
      transaction_id TEXT NOT NULL,
      customer_id TEXT,
      amount REAL NOT NULL,
      reason TEXT,
      status TEXT NOT NULL DEFAULT 'open',
      evidence TEXT,
      filed_at TEXT NOT NULL,
      resolved_at TEXT,
      FOREIGN KEY (transaction_id) REFERENCES transactions(id)
    );

    CREATE TABLE IF NOT EXISTS returns (
      id TEXT PRIMARY KEY,
      transaction_id TEXT NOT NULL,
      customer_id TEXT,
      amount REAL NOT NULL,
      reason TEXT,
      status TEXT NOT NULL DEFAULT 'initiated',
      risk_score INTEGER NOT NULL DEFAULT 0,
      risk_level TEXT NOT NULL DEFAULT 'low',
      initiated_at TEXT NOT NULL,
      completed_at TEXT
    );
  `);
}

export function getDb(): Database.Database {
  if (!dbInstance) throw new Error('Database not initialized. Call initDb() first.');
  return dbInstance;
}

export function closeDb(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

export function resetDbForTests(): void {
  closeDb();
}
