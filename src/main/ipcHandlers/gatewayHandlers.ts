// src/main/ipcHandlers/gatewayHandlers.ts

import { app, dialog, ipcMain } from 'electron';
import path from 'path';
import { DeepSeekService } from '../services/gateway/deepseekService';
import { getGatewayWindow } from '../windows/gatewayWindow';
import type { GatewayBridgeEvent } from '../services/gateway/bridge/BridgeEvents';
import { GatewayFileService } from '../services/gateway/cache/GatewayFileService';
import { ResourceService } from '../services/gateway/cache/ResourceService';
// (если ниже нет других импортов — просто добавь рядом)
import { GatewayCacheService } from '../services/gateway/cache/GatewayCacheService';
import { FileBatchService } from '../services/gateway/cache/FileBatchService';
import type { IncomingMessage } from '../services/gateway/cache/types';
import { ProfileService } from '../services/gateway/ProfileService';

let activeConvId: string | undefined;
let activeConvTitle: string | undefined;

// 5.6: если scroll был запущен с opts.prune === false, следующий
// history:complete НЕ должен делать prune (сохраняем хеши, чтобы
// fileStatuses-ключи не разъехались). Живёт максимум 60с — защита
// от утечки при ошибке/навигации.
let skipPruneOnNextCompleteTs = 0;

export function registerGatewayHandlers(): void {
  const service = DeepSeekService.getInstance();

  ipcMain.handle('gateway:launch', async () => {
    try {
      const result = await service.launch();
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('gateway:close', async () => {
    try {
      await service.close();
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('gateway:get-status', () => {
    return service.getStatus();
  });

  ipcMain.handle('gateway:send-message', async (_event, message: string) => {
    try {
      const response = await service.sendMessage(message);
      return { success: true, data: response };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('gateway:send-message-with-files', async (_e, { text, files }: { text: string; files: any[] }) => {
    try {
      const deepseek = DeepSeekService.getInstance();
      const resourceSvc = ResourceService.getInstance();

      // 1. Получаем accepted extensions из PW (кэшируем на время вызова)
      const acceptedExts = await deepseek.getAcceptedFileExtensions();

      // 2. Резолвим Buffer для каждого файла
      const resolved = await Promise.all(files.map(async (f) => {
        if (f.kind === 'disk') {
          const ext = ('.' + f.name.split('.').pop() || '').toLowerCase();
          if (acceptedExts.length > 0 && !acceptedExts.includes(ext)) {
            throw new Error(
              `Файл "${f.name}" имеет расширение "${ext}", которое DeepSeek не принимает.`
            );
          }
          // Сохраняем в ресурсы (upsert), затем читаем
          const saved = await resourceSvc.saveDiskFile(f.path);
          const got = await resourceSvc.getContentByKey(saved.resourceKey);
          return { name: got.name, mimeType: got.mime || 'application/octet-stream', buffer: got.buffer };
        }
        if (f.kind === 'archive') {
          // f.resourceKey — ключ вида 'file:/abs'
          const got = await resourceSvc.getContentByKey(f.resourceKey);
          return { name: got.name, mimeType: got.mime || 'application/octet-stream', buffer: got.buffer };
        }
        throw new Error(`Неизвестный тип файла: ${JSON.stringify(f)}`);
      }));

      const result = await deepseek.sendMessageWithFiles(resolved, text);
      console.log('[gateway:send-message-with-files] OK, chars=', result?.fullHtml?.length || 0);

      // 3. Явный sync в БД через SNAPSHOT с retry.
      //    PW пишет в IndexedDB с задержкой 1-3с после DOM-stabilize.
      //    Первый snapshot может вернуть устаревшее дерево (без новой пары).
      //    Ретраим до появления новых сообщений.
      try {
        const page = deepseek.getPage();
        const url = page?.url() || '';
        const m = url.match(/\/a\/chat\/s\/([a-f0-9-]+)/i);
        if (m) {
          const convId = m[1];
          const cache = GatewayCacheService.getInstance();

          // Считаем СКОЛЬКО БЫЛО до snapshot
          const prevCount = cache.getMessages(convId).length;
          console.log(
            `[gateway:send-message-with-files] snapshot sync for ${convId.slice(0, 8)} (before=${prevCount})…`
          );

          // Один вызов snapshot — быстрый, без retry. Если IndexedDB
          // отстаёт — UI использует result.data (мгновенный ответ).
          try {
            await deepseek.snapshotHistory({ fallbackOnError: true });
            const nowCount = cache.getMessages(convId).length;
            console.log(
              `[gateway:send-message-with-files] snapshot: ${prevCount}→${nowCount} ` +
              `(${nowCount > prevCount ? 'CAUGHT' : 'stale, UI использует result.data'})`
            );
          } catch (snapErr) {
            console.warn(
              '[gateway:send-message-with-files] snapshot failed:',
              (snapErr as Error).message
            );
          }
        }
      } catch (syncErr) {
        console.warn(
          '[gateway:send-message-with-files] snapshot sync failed:',
          (syncErr as Error).message
        );
      }

      return { success: true, data: result };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  });

  ipcMain.handle('gateway:resources:list', async (_e, { query, kind, limit } = {}) => {
    try {
      const svc = ResourceService.getInstance();
      const items = svc.listResources({
        kind: kind || 'file',
        query: query || '',
        limit: limit || 200,
        checkExists: true,
      });
      return { success: true, data: items };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  });

  ipcMain.handle('gateway:resources:pick-from-disk', async () => {
    try {
      const result = await dialog.showOpenDialog({
        title: 'Выберите файлы',
        properties: ['openFile', 'multiSelections'],
      });
      if (result.canceled || !result.filePaths.length) {
        return { success: true, data: [] };
      }

      // Проверяем accept-лист PW один раз на все файлы
      const deepseek = DeepSeekService.getInstance();
      const acceptedExts = await deepseek.getAcceptedFileExtensions();

      const pathMod = await import('path');
      const svc = ResourceService.getInstance();
      const saved: Array<{ resourceKey: string; name: string; size: number; existsOnDisk: true }> = [];

      for (const p of result.filePaths) {
        const name = pathMod.basename(p);
        const ext = ('.' + name.split('.').pop()).toLowerCase();
        if (acceptedExts.length > 0 && !acceptedExts.includes(ext)) {
          throw new Error(
            `Файл "${name}" имеет расширение "${ext}", которое DeepSeek не принимает.`
          );
        }
        const s = await svc.saveDiskFile(p);
        saved.push({
          resourceKey: s.resourceKey,
          name,
          size: s.sizeBytes,
          existsOnDisk: true,
        });
      }
      return { success: true, data: saved };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  });

  ipcMain.handle('gateway:resources:toggle-memory', async (_e, { resourceKey, state }) => {
    try {
      const svc = ResourceService.getInstance();
      svc.setMemoryState(resourceKey, state);
      return { success: true };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  });

  ipcMain.handle('gateway:resources:delete', async (_e, { resourceKey }) => {
    try {
      const svc = ResourceService.getInstance();
      svc.deleteResource(resourceKey);
      return { success: true };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  });

  ipcMain.handle('gateway:get-conversations', async () => {
    try {
      const data = await service.getConversations();
      return { success: true, data };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('gateway:open-conversation', async (_event, id: string) => {
    try {
      await service.openConversation(id);
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('gateway:set-deep-thinking', async (_event, enabled: boolean) => {
    try {
      await service.setDeepThinking(enabled);
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('gateway:set-search', async (_event, enabled: boolean) => {
    try {
      await service.setSearch(enabled);
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('gateway:get-deep-thinking', async () => {
    try {
      const data = await service.getDeepThinking();
      return { success: true, data };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('gateway:get-search', async () => {
    try {
      const data = await service.getSearch();
      return { success: true, data };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle(
    'gateway:get-conversation-messages',
    async (
      _e,
      convId?: string,
      title?: string,
      opts?: { skipBackgroundScroll?: boolean; prune?: boolean }
    ) => {
      try {
        if (convId) activeConvId = convId;
        if (title) activeConvTitle = title;
        const data = await service.getConversationMessages(opts);

        // Шаг 11: Автосохранение в БД
        if (convId && title && data.length > 0) {
          try {
            const incoming: IncomingMessage[] = data.map((m: any) => ({
              id: m.id,
              role: m.role,
              contentPlain:
                m.blocks?.map((b: any) => b.content).join('\n\n') || '',
              contentHtml: m.fullHtml,
              thinking: m.thinking,
              blocks: m.blocks,
              // 5.7.19: без этих полей терялись ветки при sync
              branchTotal: m.branchTotal,
              branchIndex: m.branchIndex,
              // 5.7.21: 1 = активная, 0 = неактивная версия
              isActive: m.isActive ?? 1,
            }));
            await cache.syncConversation(convId, title, incoming, {
              prune: opts?.prune === true,
            });
            console.log(
              `[GatewayCache] Синхронизировано ${data.length} сообщений для ${convId}` +
                (opts?.skipBackgroundScroll ? ' (visible)' : '') +
                (opts?.prune ? ' (prune)' : '')
            );
          } catch (cacheErr) {
            console.error('[GatewayCache] Ошибка автосохранения:', cacheErr);
          }
        }

        return { success: true, data };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    }
  );

  // 5.6: запуск полного scroll+sync для уже открытого диалога.
  // Резолвится после history:complete. Используется в handleOpenConversation
  // когда fingerprint не совпал или есть pending-файлы.
  ipcMain.handle(
    'gateway:scroll-history',
    async (
      _e,
      convId?: string,
      opts?: { prune?: boolean; collectInactive?: boolean; speed?: 'fast' | 'normal' | 'slow' }
    ) => {
      try {
        if (convId) activeConvId = convId;
        if (opts?.prune === false) {
          skipPruneOnNextCompleteTs = Date.now();
        }
        // 5.7.24: пробрасываем флаг сбора веток в сервис
        await service.scrollHistory({
          collectInactive: opts?.collectInactive === true,
          speed: opts?.speed ?? 'normal',
        });
        return { success: true };
      } catch (error) {
        skipPruneOnNextCompleteTs = 0;
        return { success: false, error: (error as Error).message };
      }
    }
  );

  // 5.8.3-snapshot: чтение всех веток из IndexedDB (fallback на traverse)
  ipcMain.handle(
    'gateway:snapshot-history',
    async (_e, convId?: string) => {
      try {
        if (convId) activeConvId = convId;
        const source = await service.snapshotHistory();
        return { success: true, data: { source } };
      } catch (e) {
        return { success: false, error: (e as Error).message };
      }
    }
  );

  ipcMain.handle(
    'gateway:deactivate-by-hashes',
    async (_e, convId: string, hashes: string[]) => {
      try {
        if (!Array.isArray(hashes) || hashes.length === 0) {
          return { success: true, data: { deactivated: 0 } };
        }
        const { getGatewayCache } = await import('../services/gateway/cache/db');
        const db = getGatewayCache();
        const placeholders = hashes.map(() => '?').join(',');
        const r = db
          .prepare(
            `UPDATE messages SET is_active = 0
             WHERE conversation_id = ? AND message_hash IN (${placeholders})`
          )
          .run(convId, ...hashes);
        console.log(
          `[gateway:deactivate-by-hashes] ${convId}: deactivated=${r.changes}`
        );
        return { success: true, data: { deactivated: Number(r.changes) } };
      } catch (e) {
        return { success: false, error: (e as Error).message };
      }
    }
  );

  // 5.8.2: отмена текущего doBackgroundScroll
  ipcMain.handle('gateway:cancel-traverse', () => {
    try {
      service.cancelTraverse();
      return { success: true };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  });

  ipcMain.handle(
    'gateway:switch-branch',
    async (
      _e,
      messageKey: string,
      direction: 'prev' | 'next',
      opts?: {
        branchTotal?: number;
        branchIndex?: number;
        role?: 'user' | 'assistant';
      }
    ) => {
      try {
        await service.switchBranch(messageKey, direction, opts);
        return { success: true };
      } catch (e) {
        return { success: false, error: (e as Error).message };
      }
    }
  );

  ipcMain.handle('gateway:start-selection-mode', async () => {
    try {
      await service.startSelectionMode();
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('gateway:select-messages', async (_event, indices: number[]) => {
    try {
      await service.selectMessages(indices);
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('gateway:cancel-selection-mode', async () => {
    try {
      await service.cancelSelectionMode();
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('gateway:create-public-link', async () => {
    try {
      const url = await service.createPublicLink();
      return { success: true, data: url };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('gateway:regenerate-message', async (_event, conversationId: string, messageIndex: number) => {
    try {
      await service.regenerateMessage(conversationId, messageIndex);
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('gateway:send-feedback', async (_event, conversationId: string, messageIndex: number, type: string) => {
    try {
      await service.sendFeedback(conversationId, messageIndex, type as 'like' | 'dislike');
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('gateway:debug-dump', async (_event, name: string) => {
    try {
      const filePath = await service.dumpCurrentPage(name || 'manual');
      return { success: true, data: filePath };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('gateway:recon-user-messages', async (_e, convId?: string) => {
    try {
      const data = await service.reconUserMessages(convId);
      return { success: true, data };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('gateway:recon-file-chip', async (_e, convId?: string, chipIndex?: number) => {
    try {
      const data = await service.reconFileChip(convId, chipIndex ?? 0);
      return { success: true, data };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('gateway:debug-dump-pw-state', async () => {
    try {
      const data = await service.dumpFullPWState();
      return { success: true, data };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('gateway:debug-delete-phantoms', async (_e, convId: string) => {
    try {
      const { getGatewayCache } = await import('../services/gateway/cache/db');
      const db = getGatewayCache();
      // Удаляем сообщения с ключами < 34 и НЕ входящими в реальные
      // Или проще — удаляем всё, что не пришло в последнем full-sync
      // В нашем случае: удалим 14-33 (фантомы от edit)
      const realKeys = [
        '1','2','3','4','5','6','7','8','9','10','11','12','13',
        '34','35','36','37','38','39','40','43','44','47','48','49','50'
      ];
      const placeholders = realKeys.map(() => '?').join(',');
      const stmt = db.prepare(
        `DELETE FROM messages WHERE conversation_id = ? AND pw_key NOT IN (${placeholders})`
      );
      const result = stmt.run(convId, ...realKeys);
      return { success: true, deleted: result.changes };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  });

  ipcMain.handle(
    'gateway:file-fetch',
    async (
      _e,
      convId: string,
      pwKeyOrNull: string | null,
      chipName: string,
      chipIndex: number
    ) => {
      try {
        const data = await service.fetchFileContent(
          convId,
          pwKeyOrNull,
          chipName,
          chipIndex
        );
        return { success: true, data };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    }
  );

  // ───────── File store (message_files + file_blobs) ─────────
  const fileService = GatewayFileService.getInstance();
  const fileBatchService = FileBatchService.getInstance();

  // ───────── File batch: загрузка N файлов из диалога ─────────

  // Проброс событий batch → GW через bridge
  fileBatchService.getEmitter().on('batch-started', (payload) => {
    const gw = getGatewayWindow();
    if (gw && !gw.isDestroyed()) {
      gw.webContents.send('gateway:bridge-event', {
        type: 'file:batch-started',
        payload,
        ts: Date.now(),
      });
    }
  });

  fileBatchService.getEmitter().on('batch-progress', (payload) => {
    const gw = getGatewayWindow();
    if (gw && !gw.isDestroyed()) {
      gw.webContents.send('gateway:bridge-event', {
        type: 'file:batch-progress',
        payload,
        ts: Date.now(),
      });
    }
  });

  fileBatchService.getEmitter().on('batch-complete', (payload) => {
    const gw = getGatewayWindow();
    if (gw && !gw.isDestroyed()) {
      gw.webContents.send('gateway:bridge-event', {
        type: 'file:batch-complete',
        payload,
        ts: Date.now(),
      });
    }
  });

  // PW закрылся руками → все активные batch прерываются
  service.getBridgeEmitter().on('disconnected', () => {
    console.log('[gatewayHandlers] PW disconnected → onPwDisconnected');
    fileBatchService.onPwDisconnected();
  });

  ipcMain.handle(
    'gateway:file-fetch-batch',
    async (_e, convId: string, count: number) => {
      try {
        const result = await fileBatchService.startBatch(convId, count);
        return { success: true, data: result };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    }
  );

  ipcMain.handle('gateway:file-fetch-cancel', async (_e, convId: string) => {
    try {
      const cancelled = fileBatchService.cancelBatch(convId);
      return { success: true, data: { cancelled } };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('gateway:file-batch-state', async (_e, convId: string) => {
    try {
      const state = fileBatchService.getBatchState(convId);
      return { success: true, data: state };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle(
    'gateway:file-save',
    async (
      _e,
      input: {
        conversationId: string;
        messageHash: string;
        chipIndex: number;
        name: string;
        mime?: string;
        sizeDisplay?: string;
        fileKind: 'text' | 'image' | 'binary';
        fileId: string;
        content: string;
        originUrl?: string;
      }
    ) => {
      try {
        const data = await fileService.saveFile(input);
        return { success: true, data };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    }
  );

  ipcMain.handle(
    'gateway:file-content',
    async (_e, convId: string, messageHash: string, chipIndex: number) => {
      try {
        const data = await fileService.getContent(
          convId,
          messageHash,
          chipIndex
        );
        return { success: true, data };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    }
  );

  ipcMain.handle(
    'gateway:file-statuses',
    async (
      _e,
      convId: string,
      items: Array<{ messageHash: string; chipIndex: number }>
    ) => {
      try {
        const map = fileService.getStatusesBulk(convId, items);
        // Map → объект для IPC
        const obj: Record<string, 'ok' | 'failed'> = {};
        map.forEach((v, k) => {
          obj[k] = v;
        });
        return { success: true, data: obj };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    }
  );

  ipcMain.handle('gateway:file-stats-bulk', async () => {
    try {
      const data = fileService.getStatsBulk();
      return { success: true, data };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle(
    'gateway:file-mark-failed',
    async (
      _e,
      convId: string,
      messageHash: string,
      chipIndex: number,
      errorMessage: string,
      fileId?: string
    ) => {
      try {
        fileService.markFailed(
          convId,
          messageHash,
          chipIndex,
          errorMessage,
          fileId
        );
        return { success: true };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    }
  );

  ipcMain.handle('gateway:file-cleanup-orphans', async () => {
    try {
      const data = fileService.cleanupOrphans();
      return { success: true, data };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('gateway:file-gc', async (_e, olderThanHours?: number) => {
    try {
      const data = await fileService.gc(olderThanHours ?? 24);
      return { success: true, data };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('gateway:recon-branches', async (_e, convId?: string) => {
    try {
      const data = await service.reconBranches(convId);
      return { success: true, data };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  // 5.8: диагностика веток/рассинхрона (read-only)
  ipcMain.handle(
    'gateway:diagnose-branches',
    async (_e, convId: string, convTitle?: string) => {
      try {
        const { GatewayDiagnosticService } = await import(
          '../services/gateway/diagnostics'
        );
        const data = await GatewayDiagnosticService.run(convId, convTitle);
        return { success: true, data };
      } catch (e) {
        return { success: false, error: (e as Error).message };
      }
    }
  );

  ipcMain.handle('gateway:recon-file-chip-styles', async (_e, convId?: string) => {
    try {
      const data = await service.reconFileChipStyles(convId);
      return { success: true, data };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('gateway:recon-file-panel', async (_e, convId?: string, chipIndex?: number) => {
    try {
      const data = await service.reconFilePanel(convId, chipIndex ?? 0);
      return { success: true, data };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('gateway:recon-file-panel-v2', async (_e, convId?: string, chipIndex?: number) => {
    try {
      const data = await service.reconFilePanelV2(convId, chipIndex ?? 0);
      return { success: true, data };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle(
    'gateway:recon-file-panel-content-styles',
    async (_e, convId?: string, chipIndex?: number) => {
      try {
        const data = await service.reconFilePanelContentStyles(
          convId,
          chipIndex ?? 0
        );
        return { success: true, data };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    }
  );
  
  // ============================================================
  // Проброс событий из Playwright в окно Gateway
  // ============================================================
  let activeConvId: string | undefined;
  let activeConvTitle: string | undefined;

  // P0.5 Phase 2: авто-failover по rate-limit
  let autoSwitchCount = 0;
  let autoSwitching = false;
  const MAX_AUTO_SWITCH = 3;

  service.getBridgeEmitter().on('event', (event: GatewayBridgeEvent) => {
    if (event.type !== 'assistant:content-update' && event.type !== 'reasoning:update') {
      console.log('[bridge-handler]', event.type);
    }

    // Автосохранение в БД
    if (event.type === 'history:progress' || event.type === 'history:complete') {
      const raw = event.payload?.rawMessages || [];
      if (activeConvId && activeConvTitle && raw.length > 0) {
        const incoming: IncomingMessage[] = raw.map((m: any) => ({
          id: m.id,
          role: m.role,
          contentPlain: m.blocks?.map((b: any) => b.content).join('\n\n') || '',
          contentHtml: m.fullHtml,
          thinking: m.thinking,
          blocks: m.blocks,
          // 5.7.19: без этих полей терялись ветки при sync
          branchTotal: m.branchTotal,
          branchIndex: m.branchIndex,
          // 5.7.21: 1 = активная, 0 = неактивная версия
          isActive: m.isActive ?? 1,
        }));
        const cache = GatewayCacheService.getInstance();
        const isFinal = event.type === 'history:complete';
        const wasCancelled = event.payload?.cancelled === true;

        // 5.6: если scroll был запущен с prune: false — сохраняем хеши
        let usePrune = isFinal;
        // 5.8.2: при отмене не деактивируем то, что не успели собрать
        if (isFinal && wasCancelled) {
          usePrune = false;
          console.log(
            `[gatewayHandlers] history:complete cancelled → skip prune (${activeConvId})`
          );
        }
        if (isFinal && skipPruneOnNextCompleteTs > 0) {
          if (Date.now() - skipPruneOnNextCompleteTs < 60000) {
            usePrune = false;
          }
          skipPruneOnNextCompleteTs = 0;
        }

        const label = isFinal ? (usePrune ? 'FULL' : 'FULL-no-prune') : 'progress';
        cache
          .syncConversation(activeConvId, activeConvTitle, incoming, {
            prune: usePrune,
          })
          .then((r) =>
            console.log(
              `[GatewayCache] sync ${label}: ins=${r.inserted} upd=${r.updated} hash=${r.hashedLegacy} total=${r.total} (${activeConvId})`
            )
          )
          .catch((e) => console.error('[GatewayCache] sync error:', e));
      }
    }

    // P0.5: rate-limit / ban — пометить профиль и форвардить в renderer
    let rateLimitInfo: { kind: string; untilMs: number | null; nextId: string | null; activeId: string } | null = null;
    if (event.type === 'profile:rate-limited' || event.type === 'profile:banned') {
      try {
        const ps = ProfileService.getInstance();
        const activeId = ps.getActiveId();
        const kind = event.payload?.kind ?? 'RATE_LIMIT';
        const untilMs: number | null = event.payload?.untilMs ?? null;
        if (kind === 'ACCOUNT_BANNED' || event.type === 'profile:banned') {
          ps.markBanned(activeId);
        } else {
          ps.markRateLimited(activeId, untilMs);
        }
        const next = ps.getNextAvailableProfile(activeId);
        rateLimitInfo = { kind, untilMs, nextId: next?.id ?? null, activeId };
        console.log('[gatewayHandlers] profile-limit', rateLimitInfo);

        // Phase 2: auto-failover — только для RATE_LIMIT (бан = стоп)
        if (kind === 'RATE_LIMIT' && !autoSwitching) {
          const gwNow = getGatewayWindow();
          if (autoSwitchCount >= MAX_AUTO_SWITCH) {
            if (gwNow && !gwNow.isDestroyed()) {
              gwNow.webContents.send('gateway:bridge-event', {
                type: 'all-profiles-limited',
                payload: { reason: 'max-attempts', activeId, untilMs },
                ts: Date.now(),
              });
            }
            autoSwitchCount = 0;
          } else if (next) {
            autoSwitching = true;
            autoSwitchCount++;
            (async () => {
              try {
                console.log(`[gatewayHandlers] auto-switch ${activeId} → ${next.id}`);
                const r = await service.switchProfile(next.id);
                const gw1 = getGatewayWindow();
                if (!gw1 || gw1.isDestroyed()) return;
                if (r.ok) {
                  gw1.webContents.send('gateway:bridge-event', {
                    type: 'profile:switched',
                    payload: {
                      reason: 'rate-limited',
                      from: activeId,
                      to: next.id,
                      needLogin: r.status === 'login_required',
                    },
                    ts: Date.now(),
                  });
                } else {
                  gw1.webContents.send('gateway:bridge-event', {
                    type: 'all-profiles-limited',
                    payload: { reason: r.reason || 'switch-failed', activeId, untilMs },
                    ts: Date.now(),
                  });
                }
              } catch (e) {
                console.error('[gatewayHandlers] auto-switch error:', e);
              } finally {
                autoSwitching = false;
              }
            })();
          } else {
            if (gwNow && !gwNow.isDestroyed()) {
              gwNow.webContents.send('gateway:bridge-event', {
                type: 'all-profiles-limited',
                payload: { reason: 'no-next', activeId, untilMs },
                ts: Date.now(),
              });
            }
          }
        }
      } catch (e) {
        console.error('[gatewayHandlers] profile-limit error:', e);
      }
    }

    const gw = getGatewayWindow();
    if (gw && !gw.isDestroyed()) {
      gw.webContents.send('gateway:bridge-event', event);
    } else {
      console.warn('[bridge-handler] gateway window not found');
    }
  });

  ipcMain.handle('gateway:rename-conversation', async (_e, id: string, newTitle: string) => {
    try {
      await service.renameConversation(id, newTitle);
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('gateway:pin-conversation', async (_e, id: string, pin: boolean) => {
    try {
      await service.pinConversation(id, pin);
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('gateway:delete-conversation', async (_event, id: string) => {
    const result = {
      success: false as boolean,
      deletedFromOriginal: false,
      deletedFromCache: false,
      error: undefined as string | undefined,
    };

    // 1. Удаление из оригинала (Playwright)
    try {
      await service.deleteConversation(id);
      result.deletedFromOriginal = true;
    } catch (e) {
      result.error = `Playwright: ${(e as Error).message}`;
      // Если не удалось в оригинале — БД не трогаем (диалог ещё существует на сервере)
      return result;
    }

    // 2. Удаление из кэша (SQLite)
    try {
      const { getGatewayCache } = await import('../services/gateway/cache/db');
      const db = getGatewayCache();
      const stmt = db.prepare('DELETE FROM conversations WHERE id = ?');
      stmt.run(id);
      result.deletedFromCache = true;
    } catch (e) {
      result.error = `Cache: ${(e as Error).message}`;
      // Не критично: оригинал удалён, кэш отстал
    }

    result.success = true;
    return result;
  });

  // ============================================================
  // Cache: SQLite-кэш диалогов (gateway.db)
  // ============================================================
  const cache = GatewayCacheService.getInstance();
  const dbPath = path.join(app.getPath('userData'), 'gateway.db');
  const exportDir = path.join(
    app.getPath('documents'),
    'wetothemoon',
    'gateway-exports'
  );

    // 5.7.19: отладочный дамп всех сообщений (включая is_active=0),
  // чтобы понять, куда девается 43 после sync.
  ipcMain.handle(
    'gateway:debug-messages-all',
    async (_e, convId: string) => {
      try {
        const { getGatewayCache } = await import(
          '../services/gateway/cache/db'
        );
        const db = getGatewayCache();
        const rows = db
          .prepare(
            `SELECT id, pw_key, sequence, role, branch_total, branch_index,
                    is_active, message_hash,
                    substr(content_plain, 1, 60) AS preview
             FROM messages
             WHERE conversation_id = ?
             ORDER BY sequence ASC, is_active DESC`
          )
          .all(convId);
        return { success: true, data: rows };
      } catch (e) {
        return { success: false, error: (e as Error).message };
      }
    }
  );

  ipcMain.handle('gateway:cache-list', async () => {
    try {
      const data = cache.listConversations();
      return { success: true, data };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  });

  ipcMain.handle('gateway:cache-messages', async (_e, convId: string) => {
    try {
      const data = cache.getMessages(convId);
      return { success: true, data };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  });

  ipcMain.handle('gateway:cache-search', async (_e, query: string, limit?: number) => {
    try {
      const data = cache.searchMessages(query, limit ?? 50);
      return { success: true, data };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  });

  ipcMain.handle(
    'gateway:cache-save',
    async (_e, convId: string, title: string, messages: IncomingMessage[]) => {
      try {
        const data = await cache.syncConversation(convId, title, messages);
        return { success: true, data };
      } catch (e) {
        return { success: false, error: (e as Error).message };
      }
    }
  );

  ipcMain.handle('gateway:cache-export-md', async (_e, convId: string) => {
    try {
      const filePath = await cache.exportMarkdown(convId, exportDir);
      return { success: true, data: filePath };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  });

  ipcMain.handle('gateway:cache-stats', async () => {
    try {
      const data = await cache.getStats(dbPath);
      return { success: true, data };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  });

  ipcMain.handle('gateway:cache-delete-conversation', async (_e, convId: string) => {
    try {
      cache.deleteConversation(convId);
      return { success: true };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  });

  ipcMain.handle('gateway:cache-clear', async () => {
    try {
      cache.clearAll();
      return { success: true };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  });

  ipcMain.handle(
    'gateway:cleanup-ghosts',
    async (_e, convId?: string) => {
      try {
        const deleted = cache.cleanupGhosts(convId);
        return { success: true, data: { deleted } };
      } catch (e) {
        return { success: false, error: (e as Error).message };
      }
    }
  );

  ipcMain.handle('gateway:resources:gc', async (_e, { ttlDays }) => {
    try {
      const svc = ResourceService.getInstance();
      const result = await svc.gc(ttlDays || 7, 90);
      return { success: true, data: result };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  });

  // ───────── Profiles (multi-account, см. ProfileService.ts) ─────────
  ipcMain.handle('gateway:profiles-list', () => {
    try {
      const ps = ProfileService.getInstance();
      return {
        success: true,
        data: {
          activeId: ps.getActiveId(),
          profiles: ps.list().map((p) => ({ ...p, hasSession: ps.hasSession(p) })),
        },
      };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  });

  ipcMain.handle('gateway:profiles-create', (_e, opts: { name: string; notes?: string; browserKind?: 'yandex' | 'chrome' }) => {
    try {
      return { success: true, data: ProfileService.getInstance().create(opts) };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  });

  ipcMain.handle('gateway:profiles-activate', async (_e, id: string) => {
    try {
      // Ручной switch = сброс авто-счётчика (новый цикл failover)
      autoSwitchCount = 0;
      const r = await service.switchProfile(id);
      return r.ok ? { success: true } : { success: false, error: r.reason };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  });

  ipcMain.handle('gateway:profiles-update', (_e, id: string, patch: { name?: string; notes?: string; browserKind?: 'yandex' | 'chrome' }) => {
    try {
      return { success: true, data: ProfileService.getInstance().update(id, patch) };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  });

  ipcMain.handle('gateway:profiles-delete', (_e, id: string, opts: { deleteFiles?: boolean }) => {
    try {
      ProfileService.getInstance().delete(id, opts);
      return { success: true };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  });

    ipcMain.handle('gateway:user-info', async () => {
    try {
      const data = await service.getUserInfo();
      return { success: true, data };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  });

  ipcMain.handle('gateway:logout', async () => {
    try {
      await service.logout();
      return { success: true };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  });

  ipcMain.handle('gateway:hard-logout', async () => {
    try {
      await service.hardLogout();
      return { success: true };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  });

    ipcMain.handle('gateway:profiles-backups', (_e, profileId: string) => {
    try {
      const ps = ProfileService.getInstance();
      const p = ps.get(profileId);
      if (!p) return { success: false, error: 'Профиль не найден' };
      return { success: true, data: ps.listBackups(p) };
    } catch (e) { return { success: false, error: (e as Error).message }; }
  });

  ipcMain.handle('gateway:profiles-backup-create', (_e, profileId: string) => {
    try {
      const ps = ProfileService.getInstance();
      const p = ps.get(profileId);
      if (!p) return { success: false, error: 'Профиль не найден' };
      return { success: true, data: ps.createSessionBackup(p) };
    } catch (e) { return { success: false, error: (e as Error).message }; }
  });

  ipcMain.handle('gateway:profiles-backup-restore', async (_e, backupPath: string) => {
    try {
      return await service.restoreSession(backupPath);
    } catch (e) { return { ok: false, reason: (e as Error).message }; }
  });

  ipcMain.handle('gateway:profiles-backup-delete', (_e, backupPath: string) => {
    try {
      ProfileService.getInstance().deleteSessionBackup(backupPath);
      return { success: true };
    } catch (e) { return { success: false, error: (e as Error).message }; }
  });

  ipcMain.handle('gateway:login', async () => {
    try {
      const ok = await service.requestLogin();
      return { success: ok };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  });

  ipcMain.handle('gateway:open-external', async (_e, url: string) => {
    try {
      const { shell } = await import('electron');
      await shell.openExternal(url);
      return { success: true };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  });

  ipcMain.handle(
    'gateway:profiles-import-cookies',
    async (_e, profileId: string, cookiesJson: string) => {
      try {
        const r = await service.importCookiesForProfile(profileId, cookiesJson);
        return r.ok ? { success: true } : { success: false, error: r.reason };
      } catch (e) {
        return { success: false, error: (e as Error).message };
      }
    }
  );

    ipcMain.handle('gateway:kill-all-zombies', async () => {
    try {
      const r = await service.killAllYandexZombies();
      return { success: true, data: { killed: r.killed } };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  });

  ipcMain.handle('gateway:kill-yandex-profile', async (_e, profileId: string) => {
    try {
      const r = await service.killYandexForProfile(profileId);
      return r.ok
        ? { success: true, data: { killed: r.killed } }
        : { success: false, error: r.reason };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  });

  ipcMain.handle('gateway:export-continuation', async (_e, payload: {
    workspaceKeys: string[];
    taskTitle?: string;
  }) => {
    try {
      const fsMod = await import('node:fs');
      const pathMod = await import('node:path');
      const { app } = await import('electron');
      const { buildContinuationSystemPrompt } = await import('../services/gateway/contextBuilder');

      const manifestPath = process.env.CONTEXT_MANIFEST;
      if (!manifestPath) return { success: false, error: 'CONTEXT_MANIFEST не задан в .env.local' };
      if (!payload?.workspaceKeys?.length) return { success: false, error: 'workspaceKeys обязательны' };

      const r = await buildContinuationSystemPrompt({
        manifestPath,
        activeKeys: payload.workspaceKeys,
        taskTitle: payload.taskTitle ?? 'Продолжение разработки',
      });

      const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const slug = payload.workspaceKeys[payload.workspaceKeys.length - 1].split('/').pop() || 'workspace';
      const outDir = pathMod.join(app.getPath('userData'), 'continuation');
      fsMod.mkdirSync(outDir, { recursive: true });
      const outPath = pathMod.join(outDir, `continuation-${slug}-${ts}.md`);
      fsMod.writeFileSync(outPath, r.systemPrompt, 'utf8');

      return { success: true, data: { path: outPath, bytes: r.bytes, nodes: r.includedNodes } };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  });

  // ── DeepSeek API: учёт расхода ──
  ipcMain.handle('gateway:api-usage-summary', async (_e, opts?: { sinceMs?: number; profileId?: string }) => {
    try {
      const { summary, budget } = await import('../services/gateway/apiUsageDb');
      return { success: true, data: { summary: summary(opts ?? {}), budget: budget() } };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  });

  // ── DeepSeek API: прямой вызов API-канала (ручная проверка / fallback) ──
  ipcMain.handle('gateway:send-message-api', async (_e, payload: {
    message: string;
    model?: string;
    effort?: 'low' | 'high' | 'max';
    max_tokens?: number;
    useFallback?: boolean;
    continuationMode?: boolean;
    taskTitle?: string;
  }) => {
    try {
      if (!payload?.message) return { success: false, error: 'message обязателен' };
      const result = payload.useFallback
        ? await service.sendMessageWithFallback(payload.message)
        : await service.sendMessageViaApi(payload.message, {
            model: payload.model,
            effort: payload.effort,
            max_tokens: payload.max_tokens,
            continuationMode: payload.continuationMode,
            taskTitle: payload.taskTitle,
          });
      return { success: true, data: result };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  });

}
