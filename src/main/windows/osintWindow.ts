import path from 'path';
import { app, BrowserWindow, Menu } from 'electron';
import { osintWindowMenuTemplate } from '../menus/windowMenus'; // или mainMenuTemplate
import { DEV_SERVER_URL, getMainWindowProdPath } from './paths';

let osintWindow: BrowserWindow | null = null;

const preloadPath = app.isPackaged
  ? path.join(process.resourcesPath, 'preload.js')
  : path.join(__dirname, '../../dist/main/preload.js');

export const createOsintWindow = (): BrowserWindow => {
  // Если окно уже существует, просто фокусируемся
  if (osintWindow && !osintWindow.isDestroyed()) {
    osintWindow.focus();
    return osintWindow;
  }

  osintWindow = new BrowserWindow({
    width: 1100,
    height: 800,
    title: 'Взгляд Фримена',
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
    },
    backgroundColor:'#212121',
  });

  // В dev-режиме загружаем URL dev-сервера с hash-маршрутом
  if (process.env.NODE_ENV === 'development') {
    osintWindow.loadURL(`${DEV_SERVER_URL}/#/osint`);
  } else {
    // В prod обязательно передаём hash, чтобы открылась нужная страница
    osintWindow.loadFile(getMainWindowProdPath(), { hash: '/osint' });
  }

  const menu = Menu.buildFromTemplate(osintWindowMenuTemplate); // или mainMenuTemplate
  osintWindow.setMenu(menu);

  osintWindow.on('closed', () => {
    osintWindow = null;
  });

  return osintWindow;
};

export const getOsintWindow = (): BrowserWindow | null => osintWindow;