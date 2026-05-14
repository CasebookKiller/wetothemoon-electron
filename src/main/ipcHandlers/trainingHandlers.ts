import { ipcMain } from 'electron';
import { AITrainer } from '../training';

export const registerTrainingHandlers = () => {
  // регистрируем обработчики API
  ipcMain.handle('start-fine-tuning', async (event, data) => {
    try {
      // Эмуляция прогресса
      for (let i = 0; i <= 100; i += 10) {
        event.sender.send('training-progress', {
          status: `Обработка данных...`,
          progress: i
        });
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // Здесь должен быть реальный код дообучения
      return {
        status: 'completed',
        outputDir: data.outputDir
      };
    } catch (error: any) {
      return {
        status: 'error',
        message: error.message
      };
    }
  });

};

const trainer = new AITrainer();


/*
import { TrainingManager } from './main/trainingManager';

const trainingManager = new TrainingManager();

ipcMain.handle('start-fine-tuning', async (event, data) => {
  try {
    const result = await trainingManager.startFineTuning(
      data.dataPath,
      data.modelName,
      data.outputDir
    );
    return result;
  } catch (error) {
    console.error('Training error:', error);
    return { status: 'error', message: error.message };
  }
});
*/