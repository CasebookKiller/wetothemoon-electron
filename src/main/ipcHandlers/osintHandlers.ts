// src/main/ipcHandlers/osintHandlers.ts

import { ipcMain } from 'electron';
import { createOsintWindow, getOsintWindow } from '@/main/windows/osintWindow';
import { launchBrowser, closeBrowser } from '../services/osint/playwrightService'; // будет создан позже
import { scrapeRusprofile } from '../services/osint/scrapers/rusprofile/index';
import { scrapeKadArbitr } from '../services/osint/scrapers/kadArbitr';
import { scrapeMosGorsud } from '../services/osint/scrapers/mosGorsud';
import { getCredentials, setCredentials } from '../services/osint/credentials';
import { createDatabaseWindow, getDatabaseWindow } from '../windows/databaseWindow';
import { getDatabase, getDumpSectionsUpdatedAt, hasRawDumpForInn } from '../services/database';
import { findLatestRawDump } from '../services/database';
import { loadRawDumpSync } from '../services/rawStorage';
import { mergeCompanyDumps, saveCompanyData, updateCompanyData } from '../services/osintStorage';

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

  ipcMain.handle('osint:save-company', async (_event, companyId: string, companyInn: string, data: any) => {
    try {
      const result = saveCompanyData(companyId, companyInn, data);
      return { success: true, ...result };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  // Получение всех сущностей
  ipcMain.handle('osint:get-entities', async (_event, limit = 100, offset = 0) => {
    const db = getDatabase();
    const rows = db.prepare(`
      SELECT id, type, value, label, confidence, status, first_seen, last_seen
      FROM entities
      ORDER BY id DESC
      LIMIT ? OFFSET ?
    `).all(limit, offset);
    return rows;
  });

  // Получение связей с именами сущностей
  ipcMain.handle('osint:get-relations', async (_event, limit = 100, offset = 0) => {
    const db = getDatabase();
    const rows = db.prepare(`
      SELECT r.id, s.label AS subject_label, r.predicate, o.label AS object_label,
            r.confidence, r.status, r.valid_from, r.valid_to
      FROM relations r
      JOIN entities s ON s.id = r.subject_id
      JOIN entities o ON o.id = r.object_id
      ORDER BY r.id DESC
      LIMIT ? OFFSET ?
    `).all(limit, offset);
    return rows;
  });

  // Получение наблюдений
  ipcMain.handle('osint:get-observations', async (_event, limit = 100, offset = 0) => {
    const db = getDatabase();
    const rows = db.prepare(`
      SELECT o.id, e.label AS entity_label, o.attribute, o.value, o.observed_at, o.confidence
      FROM observations o
      JOIN entities e ON e.id = o.entity_id
      ORDER BY o.id DESC
      LIMIT ? OFFSET ?
    `).all(limit, offset);
    return rows;
  });

  // Получение источников
  ipcMain.handle('osint:get-sources', async (_event, limit = 100, offset = 0) => {
    const db = getDatabase();
    const rows = db.prepare(`
      SELECT id, url, title, source_type, source_kind, provider, access_level, retrieved_at
      FROM sources
      ORDER BY id DESC
      LIMIT ? OFFSET ?
    `).all(limit, offset);
    return rows;
  });

  ipcMain.handle('osint:supplement-company', async (_event, inn: string, onlySections: string[]) => {
    try {
      // 1. Собираем только указанные разделы
      const newData = await scrapeRusprofile(inn, { onlySections });
      if (!newData) {
        return { success: false, error: 'Не удалось собрать данные с rusprofile' };
      }

      // 2. Находим последний дамп для этой компании
      const latestDump = findLatestRawDump(inn);
      if (!latestDump) {
        return { success: false, error: 'Не найден существующий дамп для этой компании' };
      }

      // 3. Загружаем старый дамп
      const existingData = loadRawDumpSync(latestDump.dump_file_path);

      // 4. Объединяем
      const mergedData = mergeCompanyDumps(existingData, newData);

      // 5. Сохраняем объединённый дамп (создаст новый файл и обновит БД)
      const result = updateCompanyData(
        String(newData.company_id ?? ''),
        inn,
        mergedData,
        latestDump.dump_file_path,
        latestDump.id
      );

      return { success: true, ...result };
    } catch (error) {
      console.error('Ошибка дозагрузки разделов:', error);
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('osint:check-dump-exists', async (_event, inn: string) => {
    try {
      const exists = hasRawDumpForInn(inn);
      if (!exists) return { exists: false, dumpInfo: null };

      const latestDump = findLatestRawDump(inn);
      if (!latestDump) return { exists: false, dumpInfo: null };

      const sectionDates = getDumpSectionsUpdatedAt(latestDump.id);
      return {
        exists: true,
        dumpInfo: {
          id: latestDump.id,
          collectedSections: latestDump.collected_sections,
          sectionUpdatedAt: sectionDates,
          dumpFilePath: latestDump.dump_file_path,
        }
      };
    } catch (error) {
      return { exists: false, error: (error as Error).message };
    }
  });

}