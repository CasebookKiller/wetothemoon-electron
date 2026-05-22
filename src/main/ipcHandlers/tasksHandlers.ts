import { ipcMain } from 'electron';
import { taskStore } from '../services/taskStore';
import { Task } from '@/shared/types/task';
import { v4 as uuidv4 } from 'uuid';
import { createTasksWindow, getTasksWindow } from '@/main/windows/tasksWindow';
import { scheduler } from '../services/scheduler';

export function registerTasksHandlers() {
  // Получить все задачи
  ipcMain.handle('tasks:getAll', () => {
    const tasks = taskStore.getAll();
    console.log('[IPC] tasks:getAll – вернул', tasks.length, 'задач');
    return tasks;
  });

  // Добавить задачу
  ipcMain.handle('tasks:add', async (_event, taskData) => {
    try {
      console.log('[tasks:add] Получены данные:', taskData);
      const now = new Date().toISOString();
      const newTask: Task = {
        id: uuidv4(),
        ...taskData,
        createdAt: now,
        updatedAt: now,
      };
      console.log('[tasks:add] Создана задача:', newTask.id);
      taskStore.add(newTask);
      console.log('[tasks:add] taskStore.add выполнен');
      scheduler.refreshCronJob(newTask);
      console.log('[tasks:add] Успешно, возвращаю задачу');
      return newTask;
    } catch (e) {
      console.error('[tasks:add] Ошибка:', e);
      return null;
    }
  });

  ipcMain.handle('tasks:update', async (_event, task: Task) => {
    try {
      console.log('[tasks:update] Обновляю задачу:', task.id);
      task.updatedAt = new Date().toISOString();
      taskStore.update(task);
      scheduler.refreshCronJob(task);
      return task;
    } catch (e) {
      console.error('[tasks:update] Ошибка:', e);
      return null;
    }
  });

  // Удалить задачу
  ipcMain.handle('tasks:delete', (_event, id: string) => {
    taskStore.delete(id);
  });

  // Открыть окно задач (вызывается из рендерера)
  ipcMain.handle('tasks:open-window', () => {
    const win = getTasksWindow();
    if (win && !win.isDestroyed()) {
      win.focus();
      return;
    }
    createTasksWindow();
  });

  // Классический вариант вызова
  ipcMain.handle('open-tasks-window', () => {
    const win = getTasksWindow();
    if (win && !win.isDestroyed()) {
      win.focus();
      return;
    }
    createTasksWindow();
  });
}