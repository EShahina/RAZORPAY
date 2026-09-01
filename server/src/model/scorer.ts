import fs from 'node:fs';
import path from 'node:path';
import type { XgbNode, LoadedModel } from './modelTypes.js';

/**
 * MerchantShield model scorer.
 *
 * Loads a versioned, JSON-serialized gradient-boosted tree ensemble (exported from
 * scikit-learn's GradientBoostingClassifier) and scores transactions by walking the
 * trees. Pure, deterministic, offline — no ML runtime needed at predict time.
 * Verified against sklearn predict_proba in server/tests/nodeScorer.test.ts.
 *
/**
 * Math (matches sklearn GBC predict_proba exactly for binary deviance):
 *   raw_predict = init + learning_rate * sum(leaf_value across trees)   [logit scale]
 *   P(fraud)    = 1 / (1 + exp(-raw_predict))
 *   risk_score  = round(P(fraud) * 100)            (0..100, calibrated)
 *
 * Exported trees are nested nodes: a leaf has `leaf`; a split has `split`
 * (feature name), `split_condition` (threshold; value < threshold goes LEFT),
 * and `left` / `right` child nodes.
 */

let cachedModel: LoadedModel | null = null;

export class ModelNotLoadedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ModelNotLoadedError';
  }
}

export function loadModel(modelPath: string): LoadedModel {
  const absPath = path.resolve(modelPath);
  if (!fs.existsSync(absPath)) {
    throw new ModelNotLoadedError(`Model file not found: ${absPath}`);
  }
  const raw = JSON.parse(fs.readFileSync(absPath, 'utf-8')) as LoadedModel;
  if (!Array.isArray(raw.trees) || raw.trees.length === 0) {
    throw new ModelNotLoadedError('Model file has no trees — not a valid ensemble.');
  }
  cachedModel = raw;
  return cachedModel;
}

export function getModel(): LoadedModel {
  if (!cachedModel) {
    throw new ModelNotLoadedError('Model not loaded. Call loadModel() first.');
  }
  return cachedModel;
}

/** Walk a single exported (nested) tree for the given feature vector. */
function walkTree(root: XgbNode, features: Record<string, number>): number {
  let node: XgbNode | undefined = root;
  while (node && node.leaf === undefined && node.split !== undefined && node.split_condition !== undefined) {
    const featVal: number = features[node.split] ?? 0;
    node = featVal <= node.split_condition ? node.left : node.right;
  }
  return node?.leaf ?? 0;
}

export function scoreFeatures(raw: Record<string, number>): {
  probability: number;
  riskScore: number;
} {
  const model = getModel();
  const featureIndex: Record<string, number> = {};
  model.feature_names.forEach((name, i) => {
    featureIndex[name] = raw[name] ?? 0;
  });

  const init = typeof model.init === 'number' ? model.init : 0;
  const lr = typeof model.learning_rate === 'number' ? model.learning_rate : 0.1;

  let treeSum = 0;
  for (const root of model.trees) {
    treeSum += walkTree(root, featureIndex);
  }

  const rawPredict = init + lr * treeSum;
  const probability = sigmoid(rawPredict);
  const riskScore = Math.max(0, Math.min(100, Math.round(probability * 100)));
  return { probability, riskScore };
}

function parseBaseScore(raw: string | number | number[] | undefined): number {
  if (typeof raw === 'number') return raw;
  if (Array.isArray(raw)) return Number(raw[0]) || 0;
  if (typeof raw === 'string') return parseFloat(raw.replace(/[^\d.Ee+-]/g, '')) || 0;
  return 0.5;
}

function sigmoid(x: number): number {
  if (x < 0) {
    const z = Math.exp(x);
    return z / (1 + z);
  }
  const z = Math.exp(-x);
  return 1 / (1 + z);
}

// Keep exported for compatibility; internal use only.
void parseBaseScore;
