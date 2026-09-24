import path from 'path';
import { app, BrowserWindow, Menu } from 'electron';
import { osintWindowMenuTemplate } from '../menus/windowMenus';
import { DEV_SERVER_URL, getMainWindowProdPath } from './paths';

let osintWindow: BrowserWindow | null = null;

const preloadPath = app.isPackaged
  ? path.join(process.resourcesPath, 'preload.js')
  : path.join(__dirname, '../../dist/main/preload.js');

/**
 * Проверяет, что URL — прямая ссылка на PDF судебного акта kad.arbitr.
 * Локальная копия, чтобы не тянуть kad-модули в UI-окно.
 */
const isKadPdfUrl = (url: string): boolean =>
  /kad\.arbitr\.ru\/(?:Kad\/PdfDocument|Document\/Pdf)\//i.test(url);

export const createOsintWindow = (): BrowserWindow => {
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
    backgroundColor: '#212121',
  });

  // Перехват target="_blank":
  //  - PDF kad.arbitr — не открываем новое окно, а отправляем URL
  //    в renderer; renderer вызовет IPC download (там будет Playwright);
  //  - прочие http(s) — открываем системным браузером.
  //
  // Ставим ДО loadURL/loadFile, чтобы перехватывалось с самого начала.
  osintWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isKadPdfUrl(url)) {
      if (osintWindow && !osintWindow.isDestroyed()) {
        osintWindow.webContents.send('osint:kad-pdf-clicked', { url });
      }
      return { action: 'deny' };
    }

    if (/^https?:\/\//i.test(url)) {
      const { shell } = require('electron') as typeof import('electron');
      shell.openExternal(url).catch(() => null);
      return { action: 'deny' };
    }

    return { action: 'deny' };
  });

  if (process.env.NODE_ENV === 'development') {
    osintWindow.loadURL(`${DEV_SERVER_URL}/#/osint`);
  } else {
    osintWindow.loadFile(getMainWindowProdPath(), { hash: '/osint' });
  }

  const menu = Menu.buildFromTemplate(osintWindowMenuTemplate);
  osintWindow.setMenu(menu);

  osintWindow.on('closed', () => {
    osintWindow = null;
  });

  return osintWindow;
};

export const getOsintWindow = (): BrowserWindow | null => osintWindow;