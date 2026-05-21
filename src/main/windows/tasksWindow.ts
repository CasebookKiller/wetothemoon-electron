import path from 'path';
import { app, BrowserWindow } from 'electron';
import { DEV_SERVER_URL, getMainWindowProdPath } from './paths';

let tasksWindow: BrowserWindow | null = null;

// Preload используется тот же, что и для остальных окон
const preloadPath = app.isPackaged
  ? path.join(process.resourcesPath, 'preload.js')
  : path.join(__dirname, '../../dist/main/preload.js');

export const createTasksWindow = () => {
  // Если окно уже существует, просто фокусируем его
  if (tasksWindow && !tasksWindow.isDestroyed()) {
    tasksWindow.focus();
    return tasksWindow;
  }

  tasksWindow = new BrowserWindow({
    width: 900,
    height: 700,
    title: 'Планировщик задач',
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Загружаем тот же index.html, но с нужным хешем
  if (process.env.NODE_ENV === 'development') {
    tasksWindow.loadURL(`${DEV_SERVER_URL}/#/tasks`);
  } else {
    // Важно: передаём hash, чтобы React Router знал, какую страницу показать
    tasksWindow.loadFile(getMainWindowProdPath(), { hash: '/tasks' });
  }

  tasksWindow.on('closed', () => {
    tasksWindow = null;
  });

  return tasksWindow;
};

export const getTasksWindow = (): BrowserWindow | null => tasksWindow;