declare module "*.module.css" {
  const classes: { [key: string]: string };
  export default classes;
}

declare global {
  interface Window {
    electronAPI: {
      startFineTuning: (data: {
        dataPath: string;
        modelName: string;
        outputDir: string;
      }) => Promise<{
        status: 'started' | 'progress' | 'completed' | 'error';
        message?: string;
        outputDir?: string;
      }>;
      onTrainingProgress: (callback: (progress: {
        status: string;
        message?: string;
        progress?: number;
      }) => void,
      ) => void;
    };
  }
}
