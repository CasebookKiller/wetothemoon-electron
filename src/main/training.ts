import { exec } from 'child_process';
import * as path from 'path';
import type { FineTuningData, FineTuningResult, TrainingProgress } from '@/types/types';
import { ipcMain } from 'electron';

enum Platform {
  AIX = 'aix',
  Android = 'android',
  Darwin = 'darwin',
  FreeBSD = 'freebsd',
  Haiku = 'haiku',
  Linux = 'linux',
  OpenBSD = 'openbsd',
  SunOS = 'sunos',
  Cygwin = 'cygwin',
  NetBSD = 'netbsd',
  Win32 = 'win32',
}

export class AITrainer {
  private pythonPath: string;

  constructor() {
    // Гибкий поиск Python: пробуем разные варианты
    this.pythonPath = this.detectPython();
  }

  private detectPython(): string {
    if (process.platform === Platform.Win32) {
      return 'python';
    }
    return 'python3';
  }

  async startFineTuning(data: FineTuningData): Promise<FineTuningResult> {
    return new Promise((resolve) => {
      // Валидация входных данных
      if (!data.dataPath || !data.modelName || !data.outputDir) {
        resolve({
          status: 'error',
          message: 'Недостаточно данных для дообучения'
        });
        return;
      }

      const scriptPath = path.join(__dirname, '../../training/scripts/fine_tune_llama.py');
      const args = [
        scriptPath,
        '--data-path', data.dataPath,
        '--model-name', data.modelName,
        '--output-dir', data.outputDir
      ];

      const child = exec(`${this.pythonPath} ${args.join(' ')}`);

      // Обработка stdout — парсинг прогресса
      child.stdout?.on('data', (data) => {
        const progress = this.parseProgress(data.toString());
        if (progress) {
          // Отправка прогресса в UI
          ipcMain.emit('training-progress', progress);
        }
      });

      // Обработка ошибок
      child.stderr?.on('data', (data) => {
        console.error(`[Training Error] ${data}`);
        ipcMain.emit('training-progress', {
          status: 'error',
          message: data.toString(),
          progress: 0
        });
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve({
            status: 'completed',
            outputDir: data.outputDir,
            message: 'Дообучение завершено успешно'
          });
        } else {
          resolve({
            status: 'error',
            message: `Процесс завершился с кодом ${code}`
          });
        }
      });

      child.on('error', (error) => {
        resolve({
          status: 'error',
          message: error.message
        });
      });
    });
  }

  private parseProgress(output: string): TrainingProgress | null {
    // Пример парсинга: ищем строки вида "Progress: 50%"
    const match = output.match(/Progress:\s*(\d+)%/);
    if (match) {
      const progress = parseInt(match[1], 10);
      return {
        status: 'processing',
        progress,
        message: `Прогресс: ${progress}%`
      };
    }
    return null;
  }
}
