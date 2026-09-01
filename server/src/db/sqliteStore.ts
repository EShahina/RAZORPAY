import Database from 'better-sqlite3';
import { initDb, getDb, closeDb } from './index.js';
import type { Store, TxRow, SimulatorRow, HealthTotals, AlertsFilter } from './store.js';

/**
 * SQLite backend for the storage abstraction. Wraps the existing
 * better-sqlite3 database with the exact queries the routes used before.
 */
export class SqliteStore implements Store {
  readonly kind = 'sqlite' as const;
  private dbPath: string;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
  }

  async connect(): Promise<void> {
    initDb(this.dbPath);
  }

  async close(): Promise<void> {
    closeDb();
  }

  async listTransactions(limit: number, offset: number): Promise<{ rows: TxRow[]; total: number }> {
    const db = getDb();
    const rows = db
      .prepare(
        `SELECT id, order_id, merchant_id, amount, currency, payment_method, email,
                status, risk_score, risk_level, action, confidence, explanation,
                created_at, merchant_decision, feedback
         FROM transactions ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      )
      .all(limit, offset) as unknown as TxRow[];
    const count = (db.prepare(`SELECT COUNT(*) AS c FROM transactions`).get() as { c: number }).c;
    return { rows, total: count };
  }

  async getTransaction(idOrOrder: string): Promise<TxRow | null> {
    const row = getDb()
      .prepare(`SELECT * FROM transactions WHERE id = ? OR order_id = ?`)
      .get(idOrOrder, idOrOrder) as TxRow | undefined;
    return row ?? null;
  }

  async insertOrReplaceTransaction(tx: Record<string, unknown>): Promise<void> {
    getDb()
      .prepare(
        `INSERT OR REPLACE INTO transactions
         (id, order_id, merchant_id, vertical, amount, currency, payment_method, card_bin, email, phone,
          device_id, customer_id, status, risk_score, risk_level, action, confidence,
          features_json, factors_json, explanation, created_at)
         VALUES (@id, @order_id, @merchant_id, @vertical, @amount, @currency, @pm, @card_bin, @email, @phone,
          @device_id, @customer_id, @status, @risk_score, @risk_level, @action, @confidence,
          @features_json, @factors_json, @explanation, @created_at)`,
      )
      .run(tx);
  }

  async updateMerchantDecision(id: string, decision: string, notes: string | null): Promise<boolean> {
    const info = getDb()
      .prepare(`UPDATE transactions SET merchant_decision = @d, investigation_notes = @n WHERE id = @id`)
      .run({ d: decision, n: notes, id });
    return info.changes > 0;
  }

  async updateFeedback(id: string, label: string): Promise<boolean> {
    const info = getDb().prepare(`UPDATE transactions SET feedback = @label WHERE id = @id`).run({ label, id });
    return info.changes > 0;
  }

  async countTransactions(): Promise<number> {
    const row = getDb().prepare(`SELECT COUNT(*) AS c FROM transactions`).get() as { c: number };
    return row.c;
  }

  async allTransactionsForSimulator(): Promise<SimulatorRow[]> {
    return (getDb()
      .prepare(`SELECT amount, risk_score, actual_fraud FROM transactions`)
      .all() as unknown as SimulatorRow[]).map((r) => ({
      amount: r.amount,
      risk_score: r.risk_score,
      actual_fraud: r.actual_fraud,
    }));
  }

  async healthTotals(): Promise<HealthTotals> {
    const totals = getDb()
      .prepare(
        `SELECT COUNT(*) AS total,
                SUM(CASE WHEN risk_score >= 75 THEN 1 ELSE 0 END) AS flagged,
                SUM(CASE WHEN action IN ('review','manual_review') THEN 1 ELSE 0 END) AS reviews
         FROM transactions`,
      )
      .get() as HealthTotals;
    return { total: totals.total ?? 0, flagged: totals.flagged ?? 0, reviews: totals.reviews ?? 0 };
  }

  async listCustomers(): Promise<Record<string, unknown>[]> {
    return getDb()
      .prepare(
        `SELECT id, email, phone, account_age_days AS account_age, prior_chargebacks,
                prior_refunds,
                (SELECT COUNT(*) FROM transactions t WHERE t.customer_id = c.id) AS total_transactions,
                (SELECT SUM(amount) FROM transactions t WHERE t.customer_id = c.id) AS total_spent,
                (SELECT AVG(risk_score) FROM transactions t WHERE t.customer_id = c.id) AS avg_risk
         FROM customers c
         ORDER BY avg_risk DESC NULLS LAST`,
      )
      .all() as Record<string, unknown>[];
  }

  async listCustomerTransactions(customerId: string): Promise<Record<string, unknown>[]> {
    return getDb()
      .prepare(`SELECT * FROM transactions WHERE customer_id = ? ORDER BY created_at DESC LIMIT 100`)
      .all(customerId) as Record<string, unknown>[];
  }

  async listAlerts(filter: AlertsFilter): Promise<Record<string, unknown>[]> {
    let sql = `SELECT * FROM alerts`;
    const conds: string[] = [];
    const params: unknown[] = [];
    if (filter.status && ['active', 'acknowledged', 'resolved'].includes(filter.status)) {
      conds.push(`status = ?`);
      params.push(filter.status);
    }
    if (filter.severity && ['info', 'warning', 'critical'].includes(filter.severity)) {
      conds.push(`severity = ?`);
      params.push(filter.severity);
    }
    if (conds.length) sql += ` WHERE ${conds.join(' AND ')}`;
    sql += ` ORDER BY created_at DESC`;
    return getDb().prepare(sql).all(...params) as Record<string, unknown>[];
  }

  async acknowledgeAlert(id: string): Promise<boolean> {
    const info = getDb()
      .prepare(`UPDATE alerts SET status = 'acknowledged', acknowledged_at = ? WHERE id = ?`)
      .run(new Date().toISOString(), id);
    return info.changes > 0;
  }

  async resolveAlert(id: string): Promise<boolean> {
    const info = getDb()
      .prepare(`UPDATE alerts SET status = 'resolved', resolved_at = ? WHERE id = ?`)
      .run(new Date().toISOString(), id);
    return info.changes > 0;
  }

  async listDisputes(): Promise<Record<string, unknown>[]> {
    return getDb()
      .prepare(
        `SELECT d.*, t.risk_score, t.risk_level, t.amount AS txn_amount
         FROM disputes d LEFT JOIN transactions t ON t.id = d.transaction_id
         ORDER BY d.filed_at DESC`,
      )
      .all() as Record<string, unknown>[];
  }

  async listReturns(): Promise<Record<string, unknown>[]> {
    return getDb()
      .prepare(
        `SELECT r.*, t.risk_score, t.risk_level FROM returns r
         LEFT JOIN transactions t ON t.id = r.transaction_id ORDER BY r.initiated_at DESC`,
      )
      .all() as Record<string, unknown>[];
  }

  async replaceCorpus(
    transactions: Record<string, unknown>[],
    customers: Record<string, unknown>[],
  ): Promise<number> {
    const db = getDb();
    const insertTx = db.prepare(
      `INSERT OR REPLACE INTO transactions
       (id, order_id, merchant_id, vertical, amount, currency, payment_method, email, phone,
        device_id, customer_id, status, risk_score, risk_level, action, confidence,
        features_json, factors_json, explanation, actual_fraud, created_at)
       VALUES (@id, @order_id, @merchant_id, @vertical, @amount, @currency, @payment_method,
        @email, @phone, @device_id, @customer_id, @status, @risk_score, @risk_level,
        @action, @confidence, @features_json, @factors_json, @explanation, @actual_fraud, @created_at)`,
    );
    const insertCustomer = db.prepare(
      `INSERT OR IGNORE INTO customers
       (id, email, phone, name, account_age_days, prior_chargebacks, prior_refunds, created_at)
       VALUES (@id, @email, @phone, @name, @account_age_days, @prior_chargebacks, @prior_refunds, @created_at)`,
    );

    db.prepare(`DELETE FROM transactions`).run();
    db.prepare(`DELETE FROM customers`).run();

    db.transaction(() => {
      // Customers first: transactions carry a FK to customers.
      for (const c of customers) insertCustomer.run(c);
      for (const tx of transactions) insertTx.run(tx);
    })();

    return transactions.length;
  }
}

// Re-export for type parity with the Mongo backend.
export type { Database };