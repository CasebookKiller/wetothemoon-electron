// src/main/windows/navigatorWindow.ts
import path from 'path';
import { app, BrowserWindow, Menu } from 'electron';
import { navigatorWindowMenuTemplate } from '../menus/windowMenus';
import { DEV_SERVER_URL, getMainWindowProdPath } from './paths';

let navigatorWindow: BrowserWindow | null = null;

const preloadPath = app.isPackaged
  ? path.join(process.resourcesPath, 'preload.js')
  : path.join(__dirname, '../../dist/main/preload.js');

export const createNavigatorWindow = (): BrowserWindow => {
  if (navigatorWindow && !navigatorWindow.isDestroyed()) {
    navigatorWindow.focus();
    return navigatorWindow;
  }

  navigatorWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    title: 'Навигатор (Гильдия)',
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
    },
    backgroundColor: '#212121',
  });

  if (process.env.NODE_ENV === 'development') {
    navigatorWindow.loadURL(`${DEV_SERVER_URL}/#/navigator`);
  } else {
    navigatorWindow.loadFile(getMainWindowProdPath(), { hash: '/navigator' });
  }

  const menu = Menu.buildFromTemplate(navigatorWindowMenuTemplate);
  navigatorWindow.setMenu(menu);

  navigatorWindow.on('closed', () => {
    navigatorWindow = null;
  });

  return navigatorWindow;
};

export const getNavigatorWindow = (): BrowserWindow | null => navigatorWindow;