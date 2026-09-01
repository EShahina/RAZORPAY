import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../src/index.js';
import { computeSignature } from '../src/services/webhookSignature.js';
import { getDb, closeDb } from '../src/db/index.js';
import { seedDatabase } from '../src/services/dataService.js';

describe('HTTP API integration (Part 2.1 / 2.2 / 7.1 / 7.4)', () => {
  let app: Express;

  beforeAll(async () => {
    const built = await createApp({ dbMemory: true });
    app = built.app;
    // Seed an in-memory corpus so list/score/simulator endpoints have data.
    await seedDatabase(built.config.modelPath);
  });

  afterAll(() => {
    closeDb();
  });

  it('GET /api/health reports ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('POST /api/transactions/score returns calibrated 0..100 score + explanation', async () => {
    const res = await request(app)
      .post('/api/transactions/score')
      .send({ amount: 25000, merchantAvgAmount: 2000, accountAgeDays: 1, attemptCount: 5, velocity: 12, priorChargebacks: 0.5, priorRefunds: 0.3 });
    expect(res.status).toBe(200);
    expect(res.body.riskScore).toBeGreaterThanOrEqual(0);
    expect(res.body.riskScore).toBeLessThanOrEqual(100);
    expect(typeof res.body.explanation).toBe('string');
    expect(res.body.contributions).toHaveLength(7);
    expect(res.body.idempotency_key).toBeTruthy();
  });

  it('rejects malformed score payload with 400 (input validation, Part 7.2)', async () => {
    const res = await request(app).post('/api/transactions/score').send({ amount: -5, merchantAvgAmount: 0 });
    expect(res.status).toBe(400);
  });

  it('GET /api/transactions lists seeded rows with total count', async () => {
    const res = await request(app).get('/api/transactions?limit=10');
    expect(res.status).toBe(200);
    expect(res.body.total).toBeGreaterThan(1000);
    expect(res.body.data.length).toBe(10);
  });

  it('GET /api/model/metrics returns MEASURED train vs holdout report (Part 3.2 / 8.4)', async () => {
    const res = await request(app).get('/api/model/metrics');
    expect(res.status).toBe(200);
    const report = res.body.report;
    expect(report.holdout_samples).toBe(4000);
    expect(report.chosen_model.metrics_holdout.pr_auc).toBeGreaterThan(0.5);
    expect(report.chosen_model.metrics_holdout.roc_auc).toBeGreaterThan(0.9);
    expect(report.chosen_model.metrics_train).toBeTruthy();
    expect(res.body.model.modelVersion).toBeTruthy();
    expect(res.body.model.trainedAt).toBeTruthy();
  });

  it('GET /api/simulator/policy returns net protection + curve (Part 5)', async () => {
    const res = await request(app).get('/api/simulator/policy?threshold=60');
    expect(res.status).toBe(200);
    expect(typeof res.body.netProtection).toBe('number');
    expect(typeof res.body.recoverableLoss).toBe('number');
    expect(Array.isArray(res.body.curves)).toBe(true);
  });

  it('POST /webhooks/razorpay with a VALID signature is accepted and processed', async () => {
    const body = JSON.stringify({
      event: 'payment.captured',
      payload: { payment: { entity: { id: 'pay_integ_test', amount: 120000, order_id: 'ord_integ', method: 'card' } } },
    });
    const timestamp = '1588670992';
    const sig = computeSignature(body, timestamp, 'razorpay_demo_secret_change_me');
    const res = await request(app)
      .post('/webhooks/razorpay')
      .set('Content-Type', 'application/json')
      .set('X-Razorpay-Signature', sig)
      .set('X-Razorpay-Webhook-Timestamp', timestamp)
      .send(body);
    expect(res.status).toBe(200);
    expect(res.body.received).toBe(true);
    expect(res.body.txnId).toBe('whk_pay_integ_test');
    // The webhook transaction is actually persisted (Part 2.5) with a risk score.
    const saved = getDb().prepare(`SELECT id, risk_score FROM transactions WHERE id = ?`).get('whk_pay_integ_test') as
      | { id: string; risk_score: number }
      | undefined;
    expect(saved).toBeTruthy();
    expect(saved!.risk_score).toBeGreaterThanOrEqual(0);
  });

  it('POST /webhooks/razorpay with an INVALID signature is REJECTED with 401 (Part 2.2)', async () => {
    const body = JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: { id: 'pay_bad', amount: 120000 } } } });
    const timestamp = '1588670992';
    const badSig = computeSignature(body, timestamp, 'wrong_secret');
    const res = await request(app)
      .post('/webhooks/razorpay')
      .set('Content-Type', 'application/json')
      .set('X-Razorpay-Signature', badSig)
      .set('X-Razorpay-Webhook-Timestamp', timestamp)
      .send(body);
    expect(res.status).toBe(401);
  });

  it('POST /webhooks/razorpay without a signature is REJECTED (Part 2.2)', async () => {
    const body = JSON.stringify({ event: 'payment.captured', payload: {} });
    const res = await request(app).post('/webhooks/razorpay').set('Content-Type', 'application/json').send(body);
    expect(res.status).toBe(401);
  });

  it('GET /api/model/health exposes model_version and trained_at (Part 2.4)', async () => {
    const res = await request(app).get('/api/model/health');
    expect(res.status).toBe(200);
    expect(res.body.modelVersion).toBeTruthy();
    expect(res.body.trainedAt).toBeTruthy();
    expect(res.body.nFeatures).toBe(7);
  });
});
