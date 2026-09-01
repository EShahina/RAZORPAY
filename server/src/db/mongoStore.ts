import { MongoClient, type Db, type Collection } from 'mongodb';
import type { Store, TxRow, SimulatorRow, HealthTotals, AlertsFilter } from './store.js';

/**
 * MongoDB backend for the storage abstraction. Documents mirror the SQLite
 * rows (same snake_case field names) so every API response is identical
 * regardless of the active store. Collections: transactions, customers,
 * alerts, disputes, returns.
 */
export class MongoStore implements Store {
  readonly kind = 'mongodb' as const;
  private uri: string;
  private dbName: string;
  private client: MongoClient | null = null;
  private db: Db | null = null;

  constructor(uri: string, dbName: string) {
    this.uri = uri;
    this.dbName = dbName;
  }

  async connect(): Promise<void> {
    const client = new MongoClient(this.uri, {
      serverSelectionTimeoutMS: 15000,
      connectTimeoutMS: 15000,
    });
    await client.connect();
    this.client = client;
    this.db = client.db(this.dbName);
    await this.createIndexes();
  }

  /** Keep query paths indexed so reads stay cheap on the 512MB free tier. */
  private async createIndexes(): Promise<void> {
    const createAll = [
      this.txCol().createIndex({ created_at: -1 }),
      this.txCol().createIndex({ id: 1 }),
      this.txCol().createIndex({ order_id: 1 }),
      this.txCol().createIndex({ customer_id: 1 }),
      this.txCol().createIndex({ risk_score: 1 }),
      this.custCol().createIndex({ id: 1 }),
      this.alertCol().createIndex({ created_at: -1 }),
      this.alertCol().createIndex({ status: 1 }),
      this.alertCol().createIndex({ severity: 1 }),
      this.disputeCol().createIndex({ filed_at: -1 }),
      this.disputeCol().createIndex({ transaction_id: 1 }),
      this.returnCol().createIndex({ initiated_at: -1 }),
      this.returnCol().createIndex({ transaction_id: 1 }),
    ];
    await Promise.all(createAll.map((p) => p.catch(() => undefined)));
  }

  async close(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
      this.db = null;
    }
  }

  private txCol(): Collection {
    return this.requireDb().collection('transactions');
  }
  private custCol(): Collection {
    return this.requireDb().collection('customers');
  }
  private alertCol(): Collection {
    return this.requireDb().collection('alerts');
  }
  private disputeCol(): Collection {
    return this.requireDb().collection('disputes');
  }
  private returnCol(): Collection {
    return this.requireDb().collection('returns');
  }

  private requireDb(): Db {
    if (!this.db) throw new Error('MongoDB not connected. Call connect() first.');
    return this.db;
  }

  // ---- transactions ----

  async listTransactions(limit: number, offset: number): Promise<{ rows: TxRow[]; total: number }> {
    const [total, rows] = await Promise.all([
      this.txCol().countDocuments(),
      this.txCol()
        .find({}, {
          projection: {
            _id: 0, id: 1, order_id: 1, merchant_id: 1, amount: 1, currency: 1,
            payment_method: 1, email: 1, status: 1, risk_score: 1, risk_level: 1,
            action: 1, confidence: 1, explanation: 1, created_at: 1,
            merchant_decision: 1, feedback: 1,
          },
        })
        .sort({ created_at: -1 })
        .skip(offset)
        .limit(limit)
        .toArray(),
    ]);
    return { rows: rows as unknown as TxRow[], total };
  }

  async getTransaction(idOrOrder: string): Promise<TxRow | null> {
    const row = await this.txCol().findOne(
      { $or: [{ id: idOrOrder }, { order_id: idOrOrder }] },
      { projection: { _id: 0 } },
    );
    return row ? (row as unknown as TxRow) : null;
  }

  async insertOrReplaceTransaction(tx: Record<string, unknown>): Promise<void> {
    const id = String(tx.id);
    await this.txCol().updateOne({ id }, { $set: { ...tx, id } }, { upsert: true });
  }

  async updateMerchantDecision(id: string, decision: string, notes: string | null): Promise<boolean> {
    const res = await this.txCol().updateOne(
      { id },
      { $set: { merchant_decision: decision, investigation_notes: notes } },
    );
    return res.matchedCount > 0;
  }

  async updateFeedback(id: string, label: string): Promise<boolean> {
    const res = await this.txCol().updateOne({ id }, { $set: { feedback: label } });
    return res.matchedCount > 0;
  }

  async countTransactions(): Promise<number> {
    return this.txCol().countDocuments();
  }

  async allTransactionsForSimulator(): Promise<SimulatorRow[]> {
    const rows = await this.txCol()
      .find({}, { projection: { _id: 0, amount: 1, risk_score: 1, actual_fraud: 1 } })
      .toArray();
    return rows.map((r) => ({
      amount: Number(r.amount) || 0,
      risk_score: Number(r.risk_score) || 0,
      actual_fraud: Number(r.actual_fraud) || 0,
    }));
  }

  async healthTotals(): Promise<HealthTotals> {
    const agg = await this.txCol()
      .aggregate([
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            flagged: { $sum: { $cond: [{ $gte: ['$risk_score', 75] }, 1, 0] } },
            reviews: { $sum: { $cond: [{ $in: ['$action', ['review', 'manual_review']] }, 1, 0] } },
          },
        },
      ])
      .toArray();
    const row = agg[0];
    return {
      total: row?.total ?? 0,
      flagged: row?.flagged ?? 0,
      reviews: row?.reviews ?? 0,
    };
  }

  // ---- customers ----

  async listCustomers(): Promise<Record<string, unknown>[]> {
    return this.custCol()
      .aggregate([
        {
          $lookup: {
            from: 'transactions',
            localField: 'id',
            foreignField: 'customer_id',
            as: 'txns',
          },
        },
        {
          $project: {
            _id: 0,
            id: 1,
            email: 1,
            phone: 1,
            account_age: { $ifNull: ['$account_age_days', 0] },
            prior_chargebacks: 1,
            prior_refunds: 1,
            total_transactions: { $size: '$txns' },
            total_spent: { $sum: '$txns.amount' },
            avg_risk: { $avg: '$txns.risk_score' },
          },
        },
        { $sort: { avg_risk: -1 } },
      ])
      .toArray();
  }

  async listCustomerTransactions(customerId: string): Promise<Record<string, unknown>[]> {
    return this.txCol()
      .find({ customer_id: customerId }, { projection: { _id: 0 } })
      .sort({ created_at: -1 })
      .limit(100)
      .toArray();
  }

  // ---- alerts ----

  async listAlerts(filter: AlertsFilter): Promise<Record<string, unknown>[]> {
    const query: Record<string, unknown> = {};
    if (filter.status && ['active', 'acknowledged', 'resolved'].includes(filter.status)) query.status = filter.status;
    if (filter.severity && ['info', 'warning', 'critical'].includes(filter.severity)) query.severity = filter.severity;
    return this.alertCol()
      .find(query, { projection: { _id: 0 } })
      .sort({ created_at: -1 })
      .toArray();
  }

  async acknowledgeAlert(id: string): Promise<boolean> {
    const res = await this.alertCol().updateOne(
      { id },
      { $set: { status: 'acknowledged', acknowledged_at: new Date().toISOString() } },
    );
    return res.matchedCount > 0;
  }

  async resolveAlert(id: string): Promise<boolean> {
    const res = await this.alertCol().updateOne(
      { id },
      { $set: { status: 'resolved', resolved_at: new Date().toISOString() } },
    );
    return res.matchedCount > 0;
  }

  // ---- disputes / returns ----

  async listDisputes(): Promise<Record<string, unknown>[]> {
    return this.disputeCol()
      .aggregate([
        {
          $lookup: {
            from: 'transactions',
            localField: 'transaction_id',
            foreignField: 'id',
            as: 'tx',
          },
        },
        {
          $addFields: {
            risk_score: { $arrayElemAt: ['$tx.risk_score', 0] },
            risk_level: { $arrayElemAt: ['$tx.risk_level', 0] },
            txn_amount: { $arrayElemAt: ['$tx.amount', 0] },
          },
        },
        { $project: { tx: 0, _id: 0 } },
        { $sort: { filed_at: -1 } },
      ])
      .toArray();
  }

  async listReturns(): Promise<Record<string, unknown>[]> {
    return this.returnCol()
      .aggregate([
        {
          $lookup: {
            from: 'transactions',
            localField: 'transaction_id',
            foreignField: 'id',
            as: 'tx',
          },
        },
        {
          $addFields: {
            risk_score: { $arrayElemAt: ['$tx.risk_score', 0] },
            risk_level: { $arrayElemAt: ['$tx.risk_level', 0] },
          },
        },
        { $project: { tx: 0, _id: 0 } },
        { $sort: { initiated_at: -1 } },
      ])
      .toArray();
  }

  // ---- seeding (idempotent: replace all documents) ----

  async replaceCorpus(
    transactions: Record<string, unknown>[],
    customers: Record<string, unknown>[],
  ): Promise<number> {
    const txCol = this.txCol();
    const custCol = this.custCol();
    await Promise.all([txCol.deleteMany({}), custCol.deleteMany({})]);
    for (let i = 0; i < transactions.length; i += 1000) {
      await txCol.insertMany(transactions.slice(i, i + 1000));
    }
    for (let i = 0; i < customers.length; i += 1000) {
      await custCol.insertMany(customers.slice(i, i + 1000));
    }
    return transactions.length;
  }
}