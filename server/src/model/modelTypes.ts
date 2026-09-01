export interface XgbNode {
  nodeid: number;
  split?: string;
  split_condition?: number;
  leaf?: number;
  left?: XgbNode;
  right?: XgbNode;
  children?: XgbNode[];
}

export interface LoadedModel {
  model_name: string;
  model_version: string;
  trained_at: string;
  library: string;
  framework: string;
  objective: string;
  feature_names: string[];
  n_features: number;
  n_trees: number;
  learning_rate: number;
  init: number;
  max_depth: number;
  trees: XgbNode[];
  scoring?: Record<string, unknown>;
}
