// src/main/windows/tradingAssistantWindow.ts

import path from 'path';
import { app, BrowserWindow, Menu } from 'electron';
import { tradingAssistantWindowMenuTemplate } from '../menus/windowMenus';
import { DEV_SERVER_URL, getMainWindowProdPath } from './paths';

let tradingAssistantWindow: BrowserWindow | null = null;

const preloadPath = app.isPackaged
  ? path.join(process.resourcesPath, 'preload.js')
  : path.join(__dirname, '../../dist/main/preload.js');

export const createTradingAssistantWindow = () => {
  // Если окно уже существует, просто фокусируемся
  if (tradingAssistantWindow && !tradingAssistantWindow.isDestroyed()) {
    tradingAssistantWindow.focus();
    return tradingAssistantWindow;
  }

  tradingAssistantWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    title: 'Trading Assistant – Volume Profile',
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Загружаем ТОТ ЖЕ рендерер, но с маршрутом trading-assistant
  if (process.env.NODE_ENV === 'development') {
    tradingAssistantWindow.loadURL(`${DEV_SERVER_URL}/#/trading-assistant`);
  } else {
    tradingAssistantWindow.loadFile(getMainWindowProdPath());
  }

  // Индивидуальное меню для окна
  const menu = Menu.buildFromTemplate(tradingAssistantWindowMenuTemplate);
  tradingAssistantWindow.setMenu(menu);

  tradingAssistantWindow.on('closed', () => {
    tradingAssistantWindow = null;
  });

  return tradingAssistantWindow;
};

export const getTradingAssistantWindow = (): BrowserWindow | null =>
  tradingAssistantWindow;