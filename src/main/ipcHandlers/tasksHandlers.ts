import { ipcMain } from 'electron';
import { taskStore } from '../services/taskStore';
import { Task } from '@/shared/types/task';
import { v4 as uuidv4 } from 'uuid';
import { createTasksWindow, getTasksWindow } from '@/main/windows/tasksWindow';
import { scheduler } from '../services/scheduler';

export function registerTasksHandlers() {
  // Получить все задачи
  ipcMain.handle('tasks:getAll', () => {
    return taskStore.getAll();
  });

  // Добавить задачу
  ipcMain.handle('tasks:add', (_event, taskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => {
    const now = new Date().toISOString();
    const newTask: Task = {
      id: uuidv4(),
      ...taskData,
      createdAt: now,
      updatedAt: now,
    };
    taskStore.add(newTask);
    scheduler.refreshCronJob(newTask);   // <-- добавить
    return newTask;
  });

  // Обновить задачу
  ipcMain.handle('tasks:update', (_event, task: Task) => {
    task.updatedAt = new Date().toISOString();
    taskStore.update(task);
    scheduler.refreshCronJob(task);   // <-- добавить
    return task;
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