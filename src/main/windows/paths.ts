import path from 'path';
import { app, BrowserWindow } from 'electron';

export const DEV_SERVER_URL =
  process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';

export function getMainWindowProdPath(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'index.html');
  }
  // Путь к index.html главного окна после сборки
  return path.join(__dirname, '../../renderer/index.html');
}

export function loadWindowURL(win: BrowserWindow, hash: string) {
  if (DEV_SERVER_URL) {
    win.loadURL(`${DEV_SERVER_URL}/#/${hash}`);
  } else {
    win.loadFile(getMainWindowProdPath());
  }
}