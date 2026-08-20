// src/main/ipcHandlers/osintHandlers.ts

import { ipcMain } from 'electron';
import { createOsintWindow, getOsintWindow } from '@/main/windows/osintWindow';
import { launchBrowser, closeBrowser } from '../services/osint/playwrightService'; // будет создан позже
import { scrapeRusprofile } from '../services/osint/scrapers/rusprofile';
import { scrapeKadArbitr } from '../services/osint/scrapers/kadArbitr';
import { scrapeMosGorsud } from '../services/osint/scrapers/mosGorsud';
import { getCredentials, setCredentials } from '../services/osint/credentials';

export function registerOsintHandlers() {
  // Открыть окно OSINT
  ipcMain.handle('osint:open-window', () => {
    const win = getOsintWindow();
    if (win && !win.isDestroyed()) {
      win.focus();
      return;
    }
    createOsintWindow();
  });

  // Запуск браузера
  ipcMain.handle('osint:launch', async () => {
    try {
      await launchBrowser();
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  // Остановка браузера
  ipcMain.handle('osint:close', async () => {
    try {
      await closeBrowser();
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  // Здесь позже добавятся scrape-обработчики
  ipcMain.handle('osint:scrape-rusprofile', async (_event, inn: string, options?: any) => {
    try {
      const data = await scrapeRusprofile(inn, options);
      return { success: true, data };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('osint:scrape-kad-arbitr', async (_event, inn: string) => {
    try {
      const data = await scrapeKadArbitr(inn);
      return { success: true, data };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('osint:scrape-mos-gorsud', async (_event, inn: string) => {
    try {
      const data = await scrapeMosGorsud(inn);
      return { success: true, data };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('osint:save-credentials', async (_event, site: string, login: string, password: string) => {
    try {
      setCredentials(site, login, password);
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('osint:check-credentials', async (_event, site: string) => {
    const creds = getCredentials(site);
    return { exists: !!creds };
  });
}