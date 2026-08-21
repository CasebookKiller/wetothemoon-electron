// src/main/windows/gatewayWindow.ts
import path from 'path';
import { app, BrowserWindow, Menu } from 'electron';
import { gatewayWindowMenuTemplate } from '../menus/windowMenus'; // создадим позже
import { DEV_SERVER_URL, getMainWindowProdPath } from './paths';

let gatewayWindow: BrowserWindow | null = null;

const preloadPath = app.isPackaged
  ? path.join(process.resourcesPath, 'preload.js')
  : path.join(__dirname, '../../dist/main/preload.js');

export const createGatewayWindow = (): BrowserWindow => {
  if (gatewayWindow && !gatewayWindow.isDestroyed()) {
    gatewayWindow.focus();
    return gatewayWindow;
  }

  gatewayWindow = new BrowserWindow({
    width: 1100,
    height: 800,
    title: 'Шлюз (DeepSeek)',
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.NODE_ENV === 'development') {
    gatewayWindow.loadURL(`${DEV_SERVER_URL}/#/gateway`);
  } else {
    gatewayWindow.loadFile(getMainWindowProdPath(), { hash: '/gateway' });
  }

  const menu = Menu.buildFromTemplate(gatewayWindowMenuTemplate);
  gatewayWindow.setMenu(menu);

  gatewayWindow.on('closed', () => {
    gatewayWindow = null;
  });

  return gatewayWindow;
};

export const getGatewayWindow = (): BrowserWindow | null => gatewayWindow;