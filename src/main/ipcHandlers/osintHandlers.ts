// src/main/ipcHandlers/osintHandlers.ts

import { BrowserWindow, ipcMain } from 'electron';
import { createOsintWindow, getOsintWindow } from '@/main/windows/osintWindow';
import { launchBrowser, closeBrowser } from '../services/osint/playwrightService'; // будет создан позже
import { scrapeRusprofile } from '../services/osint/scrapers/rusprofile/index';
import { scrapeKadArbitr } from '../services/osint/scrapers/kadArbitr';
import { scrapeMosGorsud } from '../services/osint/scrapers/mosGorsud';
import { getCredentials, setCredentials } from '../services/osint/credentials';
import { createDatabaseWindow, getDatabaseWindow } from '../windows/databaseWindow';
import { deleteDumpsByEntity, findLatestRawDump, getRelatedIds, searchEntities, searchAll } from '../services/database';
import { deleteAllRawDumps, loadRawDumpSync } from '../services/rawStorage';
import { mergeCompanyDumps, saveCompanyData, updateCompanyData } from '../services/osintStorage';
import { 
  getDatabase,
  getDumpSectionsUpdatedAt,
  hasRawDumpForInn,
  listDumps,
  getRelationDetails,
  markRecordAsFalse,
  getEntityDetails,
  getObservationDetails,
  getSourceDetails,
  createEntity,
  updateEntity,
  createRelation,
  updateRelation,
  createObservation,
  updateObservation,
  createSource,
  updateSource,
  listEntitiesForDropdown,
  deleteEntity,
  deleteRelation,
  deleteObservation,
  deleteSource,
  clearAllTables,
  getAuditLog,
  listAuditLogTables,
  listAuditLogActions,
  markRecordsAsFalse,
} from '../services/database';

import {
  getSensitiveStatus,
  initializeSensitiveVault,
  tryAutoUnlock,
  unlockWithPassphraseInput,
  lockSensitiveVault,
  forgetAutoUnlock,
  addSensitiveRecord,
  listSensitiveForEntity,
  revealSensitiveRecord,
  deleteSensitiveRecord,
  listSensitiveFieldNames,
  resetSensitiveVault,
  updateSensitiveRecord,
} from '../services/osint/sensitive/sensitiveDatabase';

import {
  generatePhrase,
  validatePhrase,
  isWordlistReady,
  type WordlistLang,
} from '../../shared/sensitive/wordlists';

import {
  exportEntitiesCsv,
  exportRelationsCsv,
  exportObservationsCsv,
  exportSourcesCsv,
} from '../services/osint/exportService';

import {
  createBackup,
  restoreFromBackup,
} from '../services/osint/backupService';

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
  ipcMain.handle('osint:scrape-rusprofile', async (_event, inn: string, options?: {
    preferredType?: 'company' | 'entrepreneur' | 'person';
    [key: string]: any;
  }) => {
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

  ipcMain.handle('osint:supplement-company', async (
    _event,
    inn: string,
    onlySections: string[],
    preferredType?: 'company' | 'entrepreneur' | 'person'
  ) => {
    try {
      const newData = await scrapeRusprofile(inn, { onlySections, preferredType });

      if (!newData) {
        return { success: false, error: 'Не удалось собрать данные с rusprofile' };
      }

      const latestDump = findLatestRawDump(inn);
      if (!latestDump) {
        return { success: false, error: 'Не найден существующий дамп' };
      }

      const existingData = loadRawDumpSync(latestDump.dump_file_path);
      const mergedData = mergeCompanyDumps(existingData, newData);

      const result = updateCompanyData(
        String(newData.company_id ?? ''),
        inn,
        mergedData,
        latestDump.dump_file_path,
        latestDump.id
      );

      return { success: true, ...result, data: mergedData };
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

      // Загружаем summary из дампа, чтобы получить available_tabs
      let availableTabs: any[] = [];
      try {
        const dumpData = loadRawDumpSync(latestDump.dump_file_path);
        availableTabs = dumpData?.summary?.available_tabs || [];
      } catch {
        // ignore
      }

      return {
        exists: true,
        dumpInfo: {
          id: latestDump.id,
          collectedSections: latestDump.collected_sections,
          sectionUpdatedAt: sectionDates,
          dumpFilePath: latestDump.dump_file_path,
          availableTabs,
        }
      };
    } catch (error) {
      return { exists: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('osint:list-dumps', async () => {
    try {
      const items = listDumps();
      return { success: true, items };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('osint:delete-dump', async (_event, companyInn: string, companyIdRusprofile: string | null) => {
    try {
      const result = deleteDumpsByEntity(companyInn, companyIdRusprofile || null);
      return { success: true, ...result };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('osint:search-entities', async (_event, query: string, type?: string, limit = 100, offset = 0) => {
    try {
      const rows = searchEntities(query, type, limit, offset);
      return { success: true, items: rows };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('osint:search-all', async (
    _event,
    query: string,
    kinds?: string[],
    limit = 100,
    offset = 0
  ) => {
    try {
      const result = searchAll(query, kinds as any, limit, offset);
      return { success: true, ...result };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('osint:get-relation-details', async (_event, relationId: number) => {
    try {
      const details = getRelationDetails(relationId);
      return { success: true, data: details };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle(
    'osint:mark-false',
    async (_event, table: 'entities' | 'relations' | 'observations', recordId: number, reason: string) => {
      try {
        const result = markRecordAsFalse(table, recordId, reason);
        return result;
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    }
  );

  ipcMain.handle(
    'osint:mark-false-batch',
    async (
      _event,
      table: 'entities' | 'relations' | 'observations',
      recordIds: number[],
      reason: string
    ) => {
      try {
        return markRecordsAsFalse(table, recordIds, reason);
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    }
  );

  ipcMain.handle('osint:get-entity-details', async (_event, entityId: number) => {
    try {
      const details = getEntityDetails(entityId);
      return { success: true, data: details };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('osint:get-observation-details', async (_event, observationId: number) => {
    try {
      const details = getObservationDetails(observationId);
      return { success: true, data: details };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('osint:get-source-details', async (_event, sourceId: number) => {
    try {
      const details = getSourceDetails(sourceId);
      return { success: true, data: details };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('osint:get-related-ids', async (_event, filterType: string, filterId: number) => {
    try {
      const data = getRelatedIds(filterType as any, filterId);
      return { success: true, data };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('osint:create-entity', async (_event, patch: any) => {
    try {
      return createEntity(patch);
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('osint:update-entity', async (_event, entityId: number, patch: any) => {
    try {
      const result = updateEntity(entityId, patch);
      return result;
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('osint:update-relation', async (_event, relationId: number, patch: any) => {
    try {
      return updateRelation(relationId, patch);
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('osint:update-observation', async (_event, observationId: number, patch: any) => {
    try {
      return updateObservation(observationId, patch);
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('osint:update-source', async (_event, sourceId: number, patch: any) => {
    try {
      return updateSource(sourceId, patch);
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('osint:create-relation', async (_event, patch: any) => {
    try {
      return createRelation(patch);
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('osint:list-entities-dropdown', async () => {
    try {
      const items = listEntitiesForDropdown();
      return { success: true, items };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('osint:create-observation', async (_event, patch: any) => {
    try {
      return createObservation(patch);
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('osint:create-source', async (_event, patch: any) => {
    try {
      return createSource(patch);
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('osint:delete-entity', async (_event, entityId: number, force = false) => {
    try {
      return deleteEntity(entityId, force);
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('osint:delete-relation', async (_event, relationId: number) => {
    try {
      return deleteRelation(relationId);
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('osint:delete-observation', async (_event, observationId: number) => {
    try {
      return deleteObservation(observationId);
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('osint:delete-source', async (_event, sourceId: number, force = false) => {
    try {
      return deleteSource(sourceId, force);
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('osint:clear-all-tables', async () => {
    try {
      return clearAllTables();
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('osint:delete-all-dumps', async () => {
    try {
      const result = deleteAllRawDumps();
      return { success: true, ...result };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  // ==================== SENSITIVE VAULT ====================
  ipcMain.handle('osint:sensitive-status', async () => {
    try {
      return { success: true, data: getSensitiveStatus() };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('osint:sensitive-init', async (_event, input: any) => {
    try {
      return initializeSensitiveVault(input);
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('osint:sensitive-try-auto-unlock', async () => {
    try {
      return tryAutoUnlock();
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('osint:sensitive-unlock', async (_event, passphrase: string, saveAutoUnlock = false) => {
    try {
      return unlockWithPassphraseInput(passphrase, saveAutoUnlock);
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('osint:sensitive-lock', async () => {
    try {
      lockSensitiveVault();
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('osint:sensitive-forget-auto', async () => {
    try {
      forgetAutoUnlock();
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('osint:sensitive-add', async (_event, input: any) => {
    try {
      return addSensitiveRecord(input);
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('osint:sensitive-list', async (_event, entityId: number) => {
    try {
      const items = listSensitiveForEntity(entityId);
      return { success: true, items };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('osint:sensitive-reveal', async (_event, id: number) => {
    try {
      return revealSensitiveRecord(id);
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('osint:sensitive-delete', async (_event, id: number) => {
    try {
      return deleteSensitiveRecord(id);
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('osint:sensitive-field-names', async () => {
    try {
      return { success: true, items: listSensitiveFieldNames() };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  // ==================== SENSITIVE WORDLISTS ====================

  ipcMain.handle('osint:sensitive-wordlist-ready', async (_event, lang: WordlistLang) => {
    try {
      return { success: true, ready: isWordlistReady(lang) };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('osint:sensitive-generate-phrase', async (_event, lang: WordlistLang, wordCount = 12) => {
    try {
      return { success: true, phrase: generatePhrase(lang, wordCount) };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('osint:sensitive-validate-phrase', async (_event, phrase: string, lang: WordlistLang) => {
    try {
      return { success: true, ...validatePhrase(phrase, lang) };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('osint:get-audit-log', async (
    _event,
    filters: any = {},
    limit = 200,
    offset = 0
  ) => {
    try {
      const result = getAuditLog(filters, limit, offset);
      return { success: true, ...result };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('osint:get-audit-log-tables', async () => {
    try {
      return { success: true, items: listAuditLogTables() };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('osint:get-audit-log-actions', async () => {
    try {
      return { success: true, items: listAuditLogActions() };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('osint:sensitive-reset', async () => {
    try {
      return resetSensitiveVault();
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('osint:export-entities-csv', async (event) => {
    try {
      const win = BrowserWindow.fromWebContents(event.sender);
      const res = await exportEntitiesCsv(win);
      return res;
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('osint:export-relations-csv', async (event) => {
    try {
      const win = BrowserWindow.fromWebContents(event.sender);
      const res = await exportRelationsCsv(win);
      return res;
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('osint:export-observations-csv', async (event) => {
    try {
      const win = BrowserWindow.fromWebContents(event.sender);
      const res = await exportObservationsCsv(win);
      return res;
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('osint:export-sources-csv', async (event) => {
    try {
      const win = BrowserWindow.fromWebContents(event.sender);
      const res = await exportSourcesCsv(win);
      return res;
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('osint:backup-create', async (event, options: any) => {
    try {
      const win = BrowserWindow.fromWebContents(event.sender);
      const res = await createBackup(win, options || {});
      return res;
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('osint:backup-restore', async (event) => {
    try {
      const win = BrowserWindow.fromWebContents(event.sender);
      const res = await restoreFromBackup(win);
      return res;
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('osint:sensitive-update', async (_event, input: any) => {
    try {
      return updateSensitiveRecord(input);
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

}