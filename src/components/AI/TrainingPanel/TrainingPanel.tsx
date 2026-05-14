import { FineTuningData, TrainingProgress } from '@/types/types';
import React, { useState } from 'react';
import { finished } from 'stream/promises';

const TrainingPanel: React.FC = () => {
  const [isTraining, setIsTraining] = useState(false);
  const [progress, setProgress] = useState('');

  const startTraining = async () => {
    const electronAPI = (window as Window & typeof globalThis & { electronAPI?: any })?.electronAPI;

    setIsTraining(true);
    setProgress('Запуск дообучения...');

    const trainingData: FineTuningData = {
      dataPath: '/path/to/training_data.jsonl',
      modelName: 't-tech/T-lite-it-2.1:q4_K_M', //'llama3.2:3b',
      outputDir: '/path/to/output'
    };
    
    /*
    // Запуск дообучения
    electronAPI.startFineTuning(trainingData)
      .then(result => {
        if (result.status === 'completed') {
          console.log('Модель сохранена в:', result.outputDir);
        }
      })
      .catch(error => console.error('Ошибка:', error));

    // Подписка на прогресс
    const progressCallback = (progress: TrainingProgress) => {
      console.log(`Прогресс: ${progress.progress}% — ${progress.status}`);
    };
    electronAPI.onTrainingProgress(progressCallback);

    // Отписка после завершения
    // electronAPI.offTrainingProgress(progressCallback);
    */

    electronAPI.startFineTuning(trainingData)
      .then((result: any) => {
        if (result.success) {
          setProgress('Дообучение завершено!');
        } else {
          setProgress(`Ошибка: ${result.error}`);
        }
        if (result.status === 'completed') {
          console.log('Модель сохранена в:', result.outputDir);
        }
      })
      .catch((error: any) => {
        setProgress('Произошла ошибка');
        console.error('Ошибка:', error);
      }).finally(() => {
        setIsTraining(false);
      });

    // Подписка на прогресс
    const progressCallback = (progress: TrainingProgress) => {
      console.log(`Прогресс: ${progress.progress}% — ${progress.status}`);
    };
    electronAPI.onTrainingProgress(progressCallback);

    // Отписка после завершения
    // electronAPI.offTrainingProgress(progressCallback);

    /*
    try {
      const result = await electronAPI.startFineTuning(trainingData);
      if (result.success) {
        setProgress('Дообучение завершено!');
      } else {
        setProgress(`Ошибка: ${result.error}`);
      }
    } catch (error) {
      setProgress('Произошла ошибка');
    } finally {
      setIsTraining(false);
    }
    */
  };

  return (
    <div>
      <h2>Дообучение AI</h2>
      <button onClick={startTraining} disabled={isTraining}>
        {isTraining ? 'Обучение...' : 'Запустить дообучение'}
      </button>
      {progress && <p>{progress}</p>}
    </div>
  );
};

export default TrainingPanel;

/*

import React, { useState } from 'react';

interface TrainingFormData {
  dataPath: string;
  modelName: string;
  outputDir: string;
}

interface TrainingProgress {
  status: 'started' | 'progress' | 'completed' | 'error';
  message?: string;
  progress?: number;
  outputDir?: string;
}

const TrainingPanel: React.FC = () => {
  const [isTraining, setIsTraining] = useState(false);
  const [progress, setProgress] = useState<string>('');
  const [formData, setFormData] = useState<TrainingFormData>({
    dataPath: './training/data/custom_data.jsonl',
    modelName: 't-tech/T-lite-it-2.1:q4_K_M',//'llama3.2:8b',
    outputDir: './training/models/T-lite-it-2.1-custom' //llama3.2-custom'
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsTraining(true);
    setProgress('Запуск дообучения...');

    try {
      const result = await window.electronAPI.startFineTuning(formData);

      if (result.status === 'completed') {
        setProgress(`Дообучение завершено! Модель сохранена в: ${result.outputDir}`);
      } else if (result.status === 'error') {
        setProgress(`Ошибка: ${result.message || 'Неизвестная ошибка'}`);
      }
    } catch (error) {
      setProgress('Произошла ошибка при дообучении');
      console.error('Training error:', error);
    } finally {
      setIsTraining(false);
    }
  };

  const handleChange = (field: keyof TrainingFormData) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    setFormData({ ...formData, [field]: e.target.value });
  };

  return (
    <div style={{ padding: '20px', maxWidth: '600px' }}>
      <h2>Дообучение AI</h2>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        <div>
          <label htmlFor="dataPath">Путь к данным:</label>
          <input
            id="dataPath"
            type="text"
            value={formData.dataPath}
            onChange={handleChange('dataPath')}
            placeholder="./training/data/custom_data.jsonl"
            style={{ width: '100%', padding: '8px' }}
          />
        </div>

        <div>
          <label htmlFor="modelName">Модель для дообучения:</label>
          <input
            id="modelName"
            type="text"
            value={formData.modelName}
            onChange={handleChange('modelName')}
            placeholder="t-tech/T-lite-it-2.1:q4_K_M"
            style={{ width: '100%', padding: '8px' }}
          />
        </div>

        <div>
          <label htmlFor="outputDir">Папка для сохранения:</label>
          <input
            id="outputDir"
            type="text"
            value={formData.outputDir}
            onChange={handleChange('outputDir')}
            placeholder="./training/models/T-lite-it-2.1-custom"
            style={{ width: '100%', padding: '8px' }}
          />
        </div>

        <button
          type="submit"
          disabled={isTraining}
          style={{
            padding: '12px',
            backgroundColor: isTraining ? '#ccc' : '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: isTraining ? 'not-allowed' : 'pointer'
          }}
        >
          {isTraining ? 'Обучение...' : 'Запустить дообучение'}
        </button>
      </form>

      {progress && (
        <div
          style={{
            marginTop: '20px',
            padding: '10px',
            backgroundColor: progress.includes('Ошибка') ? '#f8d7da' : '#d1ecf1',
            border: `1px solid ${progress.includes('Ошибка') ? '#f5c6cb' : '#bee5eb'}`,
            borderRadius: '4px'
          }}
        >
          {progress}
        </div>
      )}
    </div>
  );
};

export default TrainingPanel;

*/