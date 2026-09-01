import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface Config {
  port: number;
  nodeEnv: string;
  databasePath: string;
  modelPath: string;
  metricsReportPath: string;
  mongoUri: string;
  mongoDbName: string;
  razorpayWebhookSecret: string;
  razorpayKeyId: string;
  razorpayKeySecret: string;
  cost: {
    falsePositiveCost: number;
    reviewCost: number;
    falseNegativeCost: number;
    avgOrderValue: number;
  };
  demoSecret: string;
}

export function loadConfig(): Config {
  const cost = {
    falsePositiveCost: num(process.env.FALSE_POSITIVE_COST, 250),
    reviewCost: num(process.env.REVIEW_COST, 25),
    falseNegativeCost: num(process.env.FALSE_NEGATIVE_COST, 900),
    avgOrderValue: num(process.env.AVG_ORDER_VALUE, 2000),
  };
  return {
    port: num(process.env.PORT, 8080),
    nodeEnv: process.env.NODE_ENV || 'development',
    databasePath: process.env.DATABASE_PATH
      ? path.resolve(process.env.DATABASE_PATH)
      : path.resolve(__dirname, '../data/merchantshield.db'),
    modelPath: process.env.MODEL_PATH
      ? path.resolve(process.env.MODEL_PATH)
      : path.resolve(__dirname, './model/risk_model_v1.json'),
    metricsReportPath: process.env.METRICS_REPORT_PATH
      ? path.resolve(process.env.METRICS_REPORT_PATH)
      : path.resolve(__dirname, './model/metrics_report.json'),
    mongoUri: process.env.MONGODB_URI || '',
    mongoDbName: process.env.MONGODB_DB_NAME || mongoDbNameFromUri(process.env.MONGODB_URI) || 'merchantshield',
    razorpayWebhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || 'razorpay_demo_secret_change_me',
    razorpayKeyId: process.env.RAZORPAY_KEY_ID || '',
    razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET || '',
    cost,
    demoSecret: process.env.DEMO_SECRET || 'merchantshield-demo',
  };
}

function num(v: string | undefined, dflt: number): number {
  if (!v) return dflt;
  const p = parseFloat(v);
  return Number.isFinite(p) ? p : dflt;
}

/** Extract the database name from a mongodb URI, if present (`.../dbname`). */
function mongoDbNameFromUri(uri: string | undefined): string {
  if (!uri) return '';
  try {
    const match = uri.match(/^mongodb(\+srv)?:\/\/[^/]*\/([^/?]+)/);
    return match ? decodeURIComponent(match[2]) : '';
  } catch {
    return '';
  }
}
