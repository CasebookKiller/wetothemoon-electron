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

      launch: () => Promise<{ success: boolean; error?: string }>;
      close: () => Promise<{ success: boolean; error?: string }>;
      openWindow: () => Promise<void>;
      // В будущем здесь появятся методы scrape...
      scrapeRusprofile: (inn: string) => Promise<{ success: boolean; data?: CompanyInfo; error?: string }>;
      scrapeKadArbitr: (inn: string) => Promise<{ success: boolean; data?: CourtCase[]; error?: string }>;
    };

  }
}

