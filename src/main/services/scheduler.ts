// src/main/services/scheduler.ts
import { getTasksWindow } from '@/main/windows/tasksWindow';
import { taskStore } from './taskStore';
import { Task } from '@/shared/types/task';
import { Notification } from 'electron';
import * as cron from 'node-cron';
import { spawn } from 'child_process';
import { app } from 'electron';
import path from 'path';

class Scheduler {
  private timer?: NodeJS.Timeout;
  private readonly CHECK_INTERVAL = 30_000; // 30 секунд
  private cronJobs: Map<string, cron.ScheduledTask> = new Map();

  start() {
    console.log('[Scheduler] Started');

    // Загружаем обычные задачи (once, interval)
    this.checkTasks();
    this.timer = setInterval(() => this.checkTasks(), this.CHECK_INTERVAL);

    // Регистрируем cron‑задачи
    const tasks = taskStore.getAll().filter(t => t.enabled && t.schedule.type === 'cron');
    for (const task of tasks) {
      this.registerCronJob(task);
    }
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
    for (const [id, job] of this.cronJobs) {
      job.stop();
    }
    this.cronJobs.clear();
    console.log('[Scheduler] Stopped');
  }

  /** Перезагружает cron‑задачу при её изменении */
  refreshCronJob(task: Task) {
    if (task.schedule.type !== 'cron') return;
    this.unregisterCronJob(task.id);
    if (task.enabled) {
      this.registerCronJob(task);
    }
  }

  private registerCronJob(task: Task) {
    if (!cron.validate(task.schedule.value)) {
      console.error(`[Scheduler] Некорректное cron-выражение для задачи ${task.id}: ${task.schedule.value}`);
      return;
    }

    const job = cron.schedule(task.schedule.value, () => {
      console.log(`[Scheduler] Cron-запуск задачи ${task.id} (${task.name})`);
      this.executeTask(task);
      task.lastRun = new Date().toISOString();
      taskStore.update(task);
    }, {
      timezone: 'Europe/Moscow', // можно вынести в настройки позже
    });

    this.cronJobs.set(task.id, job);
    console.log(`[Scheduler] Cron-задача ${task.id} зарегистрирована`);
  }

  private unregisterCronJob(taskId: string) {
    const job = this.cronJobs.get(taskId);
    if (job) {
      job.stop();
      this.cronJobs.delete(taskId);
    }
  }

  private checkTasks() {
    const now = new Date().toISOString();
    const tasks = taskStore.getAll().filter(t => t.enabled && t.schedule.type !== 'cron');
    
    for (const task of tasks) {
      if (!task.nextRun) {
        this.calculateNextRun(task);
        taskStore.update(task);
        continue;
      }
      
      if (task.nextRun <= now) {
        this.executeTask(task);
        this.calculateNextRun(task);
        task.lastRun = now;
        taskStore.update(task);
      }
    }
  }

  private calculateNextRun(task: Task) {
    const now = new Date();
    switch (task.schedule.type) {
      case 'once': {
        if (!task.lastRun) {
          task.nextRun = task.schedule.value; // ожидаем ISO
        } else {
          task.nextRun = undefined; // больше не запустится
        }
        break;
      }
      case 'interval': {
        const ms = parseInt(task.schedule.value, 10);
        const base = task.lastRun ? new Date(task.lastRun) : now;
        task.nextRun = new Date(base.getTime() + ms).toISOString();
        break;
      }
      case 'cron':
        // cron-задачи управляются отдельно, nextRun не используется
        task.nextRun = undefined;
        break;
    }
  }

  private async executeTask(task: Task) {
    console.log(`[Scheduler] Executing task ${task.id} (${task.name})`);
    try {
      switch (task.action.type) {
        case 'reminder':
          new Notification({
            title: task.action.payload.title || 'Напоминание',
            body: task.action.payload.body || task.name,
          }).show();
          break;
        case 'react-command': {
          const tasksWin = getTasksWindow();
          if (tasksWin && !tasksWin.isDestroyed()) {
            tasksWin.webContents.send('task:react-command', task.action.payload.command, task.action.payload.args);
            console.log(`[Scheduler] React-команда отправлена: ${task.action.payload.command}`);
          } else {
            console.warn('[Scheduler] Окно задач не открыто, команда не отправлена');
          }
          break;
        }
        case 'main-function': {
          const { functionName, args } = task.action.payload;
          if (functionName) {
            await this.callRegisteredFunction(functionName, args);
          } else {
            console.warn(`[Scheduler] Не указано имя функции для задачи ${task.id}`);
          }
          break;
        }
        case 'script': {
          const scriptPath = task.action.payload.path;
          if (!scriptPath) {
            console.warn('[Scheduler] Не указан путь к скрипту');
            return;
          }

          // Определяем разрешённую папку для скриптов (можно вынести в конфиг)
          const allowedDir = path.join(app.getPath('userData'), 'scripts');
          
          // Проверяем, что скрипт находится внутри разрешённой папки
          const resolvedPath = path.resolve(scriptPath);
          if (!resolvedPath.startsWith(allowedDir)) {
            console.warn(`[Scheduler] Попытка запуска скрипта вне разрешённой папки: ${resolvedPath}`);
            return;
          }

          const args = Array.isArray(task.action.payload.args) 
            ? task.action.payload.args 
            : [];

          console.log(`[Scheduler] Запуск скрипта: ${resolvedPath} с аргументами:`, args);

          const child = spawn(resolvedPath, args, {
            shell: true,            // для .bat/.cmd на Windows, можно убрать при необходимости
            cwd: path.dirname(resolvedPath),
            env: { ...process.env } // передаём текущее окружение
          });

          child.stdout?.on('data', (data) => {
            console.log(`[Script stdout] ${data}`);
          });

          child.stderr?.on('data', (data) => {
            console.error(`[Script stderr] ${data}`);
          });

          child.on('close', (code) => {
            console.log(`[Scheduler] Скрипт завершился с кодом ${code}`);
          });

          child.on('error', (err) => {
            console.error(`[Scheduler] Ошибка запуска скрипта: ${err.message}`);
          });
          
          break;
        }
        default:
          console.warn(`[Scheduler] Неизвестный тип действия: ${task.action.type}`);
      }
    } catch (e) {
      console.error(`[Scheduler] Ошибка выполнения задачи ${task.id}`, e);
    }
  }

  private async callRegisteredFunction(name: string | undefined, args?: any) {
    if (!name) {
      console.warn('[Scheduler] Имя функции не задано');
      return;
    }
    const allowedFunctions: Record<string, () => Promise<void>> = {
      'refreshBonds': async () => {
        // вызов сервиса облигаций (будет добавлен позже)
      }
    };
    const fn = allowedFunctions[name];
    if (fn) {
      await fn();
    } else {
      console.warn(`[Scheduler] Функция ${name} не найдена`);
    }
  }
}

export const scheduler = new Scheduler();