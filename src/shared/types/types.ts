// types.ts
export interface FineTuningData {
  dataPath: string;
  modelName: string;
  outputDir: string;
}

export interface FineTuningResult {
  status: 'started' | 'completed' | 'error';
  message?: string;
  outputDir?: string;
}

export interface TrainingProgress {
  status: string;
  message?: string;
  progress?: number; // 0–100
}

export interface PackageJson {
  name?: string;
  version?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
  [key: string]: unknown;
}
