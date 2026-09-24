// src/main/windows/pranaBinduWindow.ts

import path from 'path';
import { app, BrowserWindow, Menu } from 'electron';
import { pranaBinduWindowMenuTemplate } from '../menus/windowMenus';
import { DEV_SERVER_URL, getMainWindowProdPath } from './paths';

let pranaBinduWindow: BrowserWindow | null = null;

const preloadPath = app.isPackaged
  ? path.join(process.resourcesPath, 'preload.js')
  : path.join(__dirname, '../../dist/main/preload.js');

export const createPranaBinduWindow = (): BrowserWindow => {
  // Если окно уже существует — фокусируемся и возвращаем
  if (pranaBinduWindow && !pranaBinduWindow.isDestroyed()) {
    pranaBinduWindow.focus();
    return pranaBinduWindow;
  }

  pranaBinduWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    title: 'Prana-Bindu',
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
    },
    backgroundColor: '#212121',
  });

  // В dev-режиме загружаем URL dev-сервера с hash-маршрутом
  if (process.env.NODE_ENV === 'development') {
    pranaBinduWindow.loadURL(`${DEV_SERVER_URL}/#/prana-bindu`);
  } else {
    pranaBinduWindow.loadFile(getMainWindowProdPath(), { hash: '/prana-bindu' });
  }

  const menu = Menu.buildFromTemplate(pranaBinduWindowMenuTemplate);
  pranaBinduWindow.setMenu(menu);

  pranaBinduWindow.on('closed', () => {
    pranaBinduWindow = null;
  });

  return pranaBinduWindow;
};

export const getPranaBinduWindow = (): BrowserWindow | null => pranaBinduWindow;