declare module "*.module.css" {
  const classes: { [key: string]: string };
  export default classes;
}

// global.d.ts
import type {FineTuningData, FineTuningResult, TrainingProgress } from './shared/types';

declare global {
  interface Window {
    electronAPI: {
      startFineTuning: (data: FineTuningData) => Promise<FineTuningResult>;
      onTrainingProgress: (callback: (progress: TrainingProgress) => void) => void;
      offTrainingProgress: (callback: (progress: TrainingProgress) => void) => void; // Для отписки
    };
  }
}

