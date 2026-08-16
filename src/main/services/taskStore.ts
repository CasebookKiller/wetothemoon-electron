// src/main/services/taskStore.ts

const DEBUG_TASK_STORE = false; // поменяй на true, чтобы включить логи

import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import { Task } from '../../shared/types/task';

const DATA_DIR = app.getPath('userData');
const TASKS_FILE = path.join(DATA_DIR, 'tasks.json');

function readTasks(): Task[] {
  if (DEBUG_TASK_STORE) {
    console.log('[TaskStore] Читаю файл:', TASKS_FILE);
  }
  try {
    if (!fs.existsSync(TASKS_FILE)) return [];
    const raw = fs.readFileSync(TASKS_FILE, 'utf-8');
    return JSON.parse(raw) as Task[];
  } catch (err) {
    console.error('Ошибка чтения tasks.json:', err);
    return [];
  }
}

function writeTasks(tasks: Task[]): void {
  try {
    fs.writeFileSync(TASKS_FILE, JSON.stringify(tasks, null, 2), 'utf-8');
  } catch (err) {
    console.error('Ошибка записи tasks.json:', err);
  }
}

export class TaskStore {
  getAll(): Task[] {
    return readTasks();
  }

  add(task: Task): void {
    const tasks = readTasks();
    console.log('[TaskStore] add – до записи:', tasks.length);
    tasks.push(task);
    writeTasks(tasks);
    console.log('[TaskStore] add – после записи, всего:', tasks.length);
  }

  update(updated: Task): void {
    const tasks = readTasks().map(t => t.id === updated.id ? updated : t);
    writeTasks(tasks);
    if (DEBUG_TASK_STORE) {
      console.log('[TaskStore] update – обновлена задача', updated.id);
    } 
  }

  delete(id: string): void {
    const tasks = readTasks().filter(t => t.id !== id);
    writeTasks(tasks);
  }
}

export const taskStore = new TaskStore();