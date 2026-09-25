// src/main/ipcHandlers/osintHandlers.ts

import { BrowserWindow, ipcMain } from 'electron';
import { createOsintWindow, getOsintWindow } from '@/main/windows/osintWindow';
import { launchBrowser, closeBrowser } from '../services/osint/playwrightService'; // будет создан позже
import { scrapeRusprofile } from '../services/osint/scrapers/rusprofile/index';
import {
  scrapeJudgesDirectory,
  ensureKadSession,
  getJudgesDirectoryStats,
  searchCases,
  fetchCard,
  downloadKadDocument,
  extractCaseUuidFromPdfUrl,
} from '../services/osint/scrapers/kadArbitr';
import { scrapeMosGorsud } from '../services/osint/scrapers/mosGorsud';
import { getCredentials, setCredentials } from '../services/osint/credentials';
import { createDatabaseWindow, getDatabaseWindow } from '../windows/databaseWindow';
import { deleteAllRawDumps, loadRawDumpSync } from '../services/rawStorage';
import { mergeCompanyDumps, persistKadArbitrCard, persistKadArbitrData, saveCompanyData, updateCompanyData } from '../services/osintStorage';

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
import { addSource, clearAllTables, createEntity, createObservation, createRelation, createSource, deleteDumpsByEntity, deleteEntity, deleteJudge, deleteObservation, deleteRelation, deleteSource, findLatestRawDump, getAuditLog, getDatabase, getDumpSectionsUpdatedAt, getEntityDetails, getObservationDetails, getRelatedIds, getRelationDetails, getSourceDetails, hasRawDumpForInn, listAuditLogActions, listAuditLogTables, listCourts, listDumps, listEntitiesForDropdown, listJudges, listSaturatedPrefixes, markRecordAsFalse, markRecordsAsFalse, searchAll, searchEntities, updateEntity, updateObservation, updateRelation, updateSource } from '../services/db';
import { getKadDump, upsertKadDump, touchKadDump } from '../services/database';
import {
  saveKadDumpSync,
  loadKadDumpSync,
  isSameLocalDay,
  extractCaseYear,
} from '../services/kaddumpStorage';
import { enrichCardHearing } from '../services/osint/scrapers/kadArbitr/card';

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

  ipcMain.handle('osint:scrape-kad-arbitr', async () => {
    return {
      success: false,
      error: 'Скрапер дел kad.arbitr ещё не реализован. Сначала соберите справочник судей.',
    };
  });

  ipcMain.handle('osint:kad-arbitr-fetch', async (event, inn: string, options?: {
    maxPages?: number;
    maxTotalCases?: number;
    roles?: Array<'plaintiff' | 'defendant' | 'third_party' | 'any'>;
    dateFrom?: string | null;
    dateTo?: string | null;
    forceRefresh?: boolean;
  }) => {
    try {
      if (!inn || !inn.trim()) {
        return { success: false, error: 'ИНН не указан' };
      }
      const trimmedInn = inn.trim();
      const forceRefresh = options?.forceRefresh === true;

      // 1. Кеш
      if (!forceRefresh) {
        const dump = getKadDump('cases_by_inn', trimmedInn);
        if (dump && isSameLocalDay(dump.updated_at)) {
          event.sender.send('osint:kad-arbitr-progress', {
            stage: 'cache',
            message: `Загружено из кеша (${dump.updated_at})`,
          });
          try {
            const data = loadKadDumpSync(dump.dump_file_path);
            touchKadDump(dump.id);
            return {
              success: true,
              data,
              stats: null,
              sourceId: null,
              fromCache: true,
              cachedAt: dump.updated_at,
            };
          } catch (e) {
            console.warn('[kad] Не удалось загрузить кеш, идём в сеть:', e);
          }
        }
      }

      // 2. Сеть
      event.sender.send('osint:kad-arbitr-progress', {
        stage: 'session',
        message: 'Проверка сессии kad.arbitr...',
      });
      const page = await ensureKadSession();

      event.sender.send('osint:kad-arbitr-progress', {
        stage: 'search',
        message: 'Поиск дел...',
      });
      const data = await searchCases(page, trimmedInn, {
        maxPages: options?.maxPages,
        maxTotalCases: options?.maxTotalCases,
        roles: options?.roles,
        dateFrom: options?.dateFrom,
        dateTo: options?.dateTo,
      });

      // 3. Дамп
      try {
        const raw = saveKadDumpSync('cases_by_inn', trimmedInn, data);
        upsertKadDump({
          kind: 'cases_by_inn',
          key: trimmedInn,
          shard: raw.shard,
          dumpFilePath: raw.filePath,
          sizeBytes: raw.sizeBytes,
          payloadMeta: JSON.stringify({
            casesCount: data.cases.length,
            totalFound: data.totals.cases_found,
          }),
        });
      } catch (e) {
        console.warn('[kad] Не удалось сохранить дамп списка:', e);
      }

      if (data.cases.length === 0) {
        return {
          success: true,
          data,
          stats: { savedEntities: 0, savedRelations: 0, savedObservations: 0, targetEntityId: 0 },
          empty: true,
          fromCache: false,
        };
      }

      // 4. Persist
      event.sender.send('osint:kad-arbitr-progress', {
        stage: 'persist',
        message: `Сохранение ${data.cases.length} дел...`,
      });
      const sourceId = addSource({
        url: data.source_url,
        title: `KAD Arbitr — дела по ИНН ${trimmedInn}`,
        source_type: 'court',
        source_kind: 'official_registry',
        provider: 'kad.arbitr.ru',
        collection_method: 'browser',
        reliability: 90,
        access_level: 'public',
        retrieved_at: new Date().toISOString(),
      });
      const stats = persistKadArbitrData(trimmedInn, data, sourceId);

      return { success: true, data, stats, sourceId, fromCache: false };
    } catch (e) {
      return { success: false, error: (e as Error).message };
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
      SELECT id, type, value, normalized_value, label,
             confidence, status, first_seen, last_seen,
             notes, origin, rusprofile_id, raw_file_path
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
      SELECT
        r.id,
        r.subject_id,
        s.label AS subject_label,
        s.type  AS subject_type,
        s.value AS subject_value,
        r.predicate,
        r.object_id,
        o.label AS object_label,
        o.type  AS object_type,
        o.value AS object_value,
        r.confidence,
        r.status,
        r.valid_from,
        r.valid_to,
        r.evidence_text,
        r.notes,
        r.origin,
        r.source_id,
        src.url   AS source_url,
        src.title AS source_title
      FROM relations r
      JOIN entities s ON s.id = r.subject_id
      JOIN entities o ON o.id = r.object_id
      LEFT JOIN sources src ON src.id = r.source_id
      ORDER BY r.id DESC
      LIMIT ? OFFSET ?
    `).all(limit, offset);
    return rows;
  });

  // Получение наблюдений
  ipcMain.handle('osint:get-observations', async (_event, limit = 100, offset = 0) => {
    const db = getDatabase();
    const rows = db.prepare(`
      SELECT
        o.id,
        o.entity_id,
        e.label AS entity_label,
        e.type  AS entity_type,
        o.attribute,
        o.value,
        o.confidence,
        o.status,
        o.observed_at,
        o.notes,
        o.origin,
        o.source_id,
        src.url      AS source_url,
        src.title    AS source_title,
        src.provider AS source_provider
      FROM observations o
      JOIN entities e ON e.id = o.entity_id
      LEFT JOIN sources src ON src.id = o.source_id
      ORDER BY o.id DESC
      LIMIT ? OFFSET ?
    `).all(limit, offset);
    return rows;
  });

  // Получение источников
  ipcMain.handle('osint:get-sources', async (_event, limit = 100, offset = 0) => {
    const db = getDatabase();
    const rows = db.prepare(`
      SELECT id, url, title, source_type, source_kind, provider,
             collection_method, authority_basis, reliability,
             access_level, retrieved_at, local_path, sha256,
             notes, origin
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

  // ==================== KAD.ARBITR: справочник судей ====================

  let judgesAbort: AbortController | null = null;

  ipcMain.handle('osint:judges-start', async (event, options?: {
    ratePerSecond?: number;
    maxRequests?: number;
  }) => {
    if (judgesAbort) {
      return { success: false, error: 'Обход справочника судей уже запущен' };
    }
    judgesAbort = new AbortController();
    try {
      const page = await ensureKadSession();
      const result = await scrapeJudgesDirectory(page, {
        ratePerSecond: options?.ratePerSecond ?? 1,
        maxRequests: options?.maxRequests ?? 10000,
        signal: judgesAbort.signal,
        onProgress: (info) => {
          try {
            event.sender.send('osint:judges-progress', info);
          } catch {
            // окно закрылось — не страшно
          }
        },
      });
      return { success: true, ...result };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    } finally {
      judgesAbort = null;
    }
  });

  ipcMain.handle('osint:judges-stop', async () => {
    if (!judgesAbort) {
      return { success: false, error: 'Обход не запущен' };
    }
    judgesAbort.abort();
    return { success: true };
  });

  ipcMain.handle('osint:judges-stats', async () => {
    try {
      return { success: true, ...getJudgesDirectoryStats() };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  });

    // ==================== KAD.ARBITR: просмотр справочника ====================

  ipcMain.handle('osint:judges-list', async (_event, filters: any) => {
    try {
      const result = listJudges(filters || {});
      return { success: true, ...result };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  });

  ipcMain.handle('osint:courts-list', async () => {
    try {
      return { success: true, items: listCourts() };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  });

  ipcMain.handle('osint:judges-saturated-prefixes', async () => {
    try {
      return { success: true, items: listSaturatedPrefixes('kad_judges') };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  });

  ipcMain.handle('osint:judges-delete', async (_event, judgeId: number) => {
    try {
      return deleteJudge(judgeId);
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  });

  // ВРЕМЕННО — разведка парсера карточки дела. Удалить после проверки.
  ipcMain.handle('osint:kad-arbitr-card-test', async (_event, caseUuid: string) => {
    try {
      const page = await ensureKadSession();
      const card = await fetchCard(page, caseUuid.trim());

      const sourceId = addSource({
        url: card.source_url,
        title: `KAD Arbitr — карточка ${card.case_number}`,
        source_type: 'court',
        source_kind: 'official_registry',
        provider: 'kad.arbitr.ru',
        collection_method: 'browser',
        reliability: 95,
        access_level: 'public',
        retrieved_at: new Date().toISOString(),
      });

      const stats = persistKadArbitrCard(card, sourceId);

      console.log('[card-test] persist:', JSON.stringify(stats, null, 2));
      return { success: true, card, stats };
    } catch (e) {
      console.error('[card-test] ошибка:', e);
      return { success: false, error: (e as Error).message };
    }
  });

  // ==================== KAD.ARBITR: карточка дела ====================
  ipcMain.handle('osint:kad-arbitr-fetch-card', async (
    event,
    caseUuid: string,
    options?: { forceRefresh?: boolean }
  ) => {
    try {
      if (!caseUuid || !caseUuid.trim()) {
        return { success: false, error: 'UUID дела не указан' };
      }
      const uuid = caseUuid.trim();
      const forceRefresh = options?.forceRefresh === true;

      // 1. Кеш
      if (!forceRefresh) {
        const dump = getKadDump('card', uuid);
        if (dump && isSameLocalDay(dump.updated_at)) {
          event.sender.send('osint:kad-arbitr-card-progress', {
            stage: 'cache',
            message: `Загружено из кеша (${dump.updated_at})`,
          });
          try {
            const card = loadKadDumpSync(dump.dump_file_path);
            enrichCardHearing(card);
            touchKadDump(dump.id);
            return {
              success: true,
              card,
              stats: null,
              sourceId: null,
              fromCache: true,
              cachedAt: dump.updated_at,
            };
          } catch (e) {
            console.warn('[kad] Не удалось загрузить кеш карточки:', e);
          }
        }
      }

      // 2. Сеть
      event.sender.send('osint:kad-arbitr-card-progress', {
        stage: 'session',
        message: 'Проверка сессии kad.arbitr...',
      });
      const page = await ensureKadSession();

      event.sender.send('osint:kad-arbitr-card-progress', {
        stage: 'fetch',
        message: 'Загрузка карточки дела...',
      });
      const card = await fetchCard(page, uuid);
      enrichCardHearing(card);

      // 3. Дамп (шард = год из номера дела)
      const year = extractCaseYear(card.case_number);
      try {
        const raw = saveKadDumpSync('card', uuid, card, year);
        const totalEvents = card.instances.reduce(
          (s: number, i: any) => s + (i.events?.length || 0),
          0
        );
        upsertKadDump({
          kind: 'card',
          key: uuid,
          shard: raw.shard,
          dumpFilePath: raw.filePath,
          sizeBytes: raw.sizeBytes,
          payloadMeta: JSON.stringify({
            caseNumber: card.case_number,
            instances: card.instances.length,
            events: totalEvents,
          }),
        });
      } catch (e) {
        console.warn('[kad] Не удалось сохранить дамп карточки:', e);
      }

      // 4. Persist
      event.sender.send('osint:kad-arbitr-card-progress', {
        stage: 'persist',
        message: 'Сохранение карточки...',
      });
      const sourceId = addSource({
        url: card.source_url,
        title: `KAD Arbitr — карточка ${card.case_number}`,
        source_type: 'court',
        source_kind: 'official_registry',
        provider: 'kad.arbitr.ru',
        collection_method: 'browser',
        reliability: 95,
        access_level: 'public',
        retrieved_at: new Date().toISOString(),
      });
      const stats = persistKadArbitrCard(card, sourceId);
      return { success: true, card, stats, sourceId, fromCache: false };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  });

  // Скачивание PDF судебного акта kad.arbitr через Playwright-контекст.
  // Вызывается из renderer после перехвата target=_blank в osintWindow.
  // Дедуп: если тот же URL прилетел < 5 сек назад — игнорируем.
  ipcMain.handle(
    'osint:test-pdf-download',
    async (_event, pdfUrl: string, targetDir: string) => {
      try {
        const { downloadKadDocument } = await import(
          '../services/osint/scrapers/kadArbitr/documents'
        );
        const { getPage } = await import('../services/osint/playwrightService');
        const page = getPage();
        if (!page) return { success: false, error: 'Playwright-страница не найдена' };
        return await downloadKadDocument(page, pdfUrl, targetDir);
      } catch (e) {
        return { success: false, error: (e as Error).message };
      }
    }
  );

  ipcMain.handle('osint:load-dump', async (_event, dumpId: number) => {
    try {
      const db = getDatabase();
      const row = db.prepare(
        'SELECT id, dump_file_path, company_inn, size_bytes, created_at FROM raw_dumps WHERE id = ?'
      ).get(dumpId) as
        | { id: number; dump_file_path: string; company_inn: string; size_bytes: number | null; created_at: string }
        | undefined;

      if (!row) return { success: false, error: `Дамп #${dumpId} не найден` };

      const data = loadRawDumpSync(row.dump_file_path);
      return {
        success: true,
        data,
        meta: {
          id: row.id,
          companyInn: row.company_inn,
          sizeBytes: row.size_bytes,
          createdAt: row.created_at,
          path: row.dump_file_path,
        },
      };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  });

  ipcMain.handle('osint:_debug-reparse', async (_e, dumpId: number) => {
    const { getDatabase } = await import('../services/db/connection');
    const { loadRawDumpSync } = await import('../services/rawStorage');
    const { persistCompanyData } = await import('../services/osintStorage');
    const { addSource } = await import('../services/db/sources');

    const db = getDatabase();
    const row = db.prepare(
      'SELECT id, company_inn, company_id_rusprofile, dump_file_path FROM raw_dumps WHERE id = ?'
    ).get(dumpId) as any;
    if (!row) throw new Error(`Дамп #${dumpId} не найден`);

    const data = loadRawDumpSync(row.dump_file_path) as any;
    const sourceId = addSource({
      url: `rusprofile://debug-reparse/${row.company_inn}`,
      source_type: 'database',
      provider: 'rusprofile',
      collection_method: 'reparse',
      retrieved_at: new Date().toISOString(),
      local_path: row.dump_file_path,
    });
    return persistCompanyData(
      row.company_id_rusprofile ?? row.company_inn,
      row.company_inn,
      data,
      row.dump_file_path,
      sourceId
    );
  });
}