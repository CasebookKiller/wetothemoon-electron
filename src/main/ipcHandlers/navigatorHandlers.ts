// src/main/ipcHandlers/navigatorHandlers.ts

/**
 * IPC-хендлеры модуля Navigator (Этап 1 MVP).
 *
 * Контракт (preload — см. `src/types/navigator.d.ts`):
 *  - `navigator:list-tools` → `{ success, data?: ToolInfo[], error? }`
 *  - `navigator:send`       → `{ success, error? }` (стрим идёт через `navigator:chunk`)
 *  - `navigator:chunk`      ← `{ profileId, chunk }` (событие `webContents.send`)
 *
 * Gateway не модифицируется: переиспользуем `getBrowserPool()` (единый инстанс пула),
 * `ProfileService` и `ProviderAdapter` через `sessionManager.resolve()`.
 *
 * @module ipcHandlers/navigatorHandlers
 */

import { ipcMain } from 'electron';
import { getBrowserPool } from './gatewayHandlers';
import { initTools, list } from '../services/navigator/toolRegistry';
import { resolve } from '../services/navigator/sessionManager';
// Side-effect: накапливает onRegistryInit(registerLlmTools) до первого initTools().
import '../services/navigator/llmTool';
import type { IncomingMessage } from '../services/gateway/cache/types';

/**
 * Зарегистрировать все IPC-хендлеры Navigator.
 * Вызывается один раз из `main.ts`.
 */
export function registerNavigatorHandlers(): void {
  // ── navigator:list-tools ────────────────────────────────────────────
  ipcMain.handle('navigator:list-tools', () => {
    try {
      initTools();
      return {
        success: true,
        data: list().map((t) => ({
          id: t.id,
          kind: t.kind,
          displayName: t.displayName,
          requiresAuth: t.requiresAuth,
        })),
      };
    } catch (err: any) {
      return { success: false, error: err?.message ?? String(err) };
    }
  });

  // ── navigator:send (стрим через navigator:chunk) ────────────────────
  ipcMain.handle(
    'navigator:send',
    async (event, profileId: string, message: string) => {
      try {
        if (!profileId || typeof message !== 'string') {
          throw new Error('navigator:send: ожидаются (profileId, message)');
        }
        initTools();

        const pool = await getBrowserPool();
        const { tool, page } = await resolve(profileId, pool);

        if (!tool.send) {
          throw new Error(
            `Tool '${tool.id}' не поддерживает send() (kind=${tool.kind})`,
          );
        }

        // Аккумулируем финальный ответ для сохранения в gateway.db
        let finalHtml = '';
        let finalText = '';
        let done = false;

        for await (const chunk of tool.send(page, { message })) {
          if (event.sender.isDestroyed()) break;
          // Захватываем финальные чанки
          if (chunk && typeof chunk === 'object' && (chunk as any).type === 'text') {
            const c = chunk as any;
            if (c.format === 'html') finalHtml = c.text;
            else finalText = c.text;
          }
          if (chunk && (chunk as any).type === 'done') done = true;
          event.sender.send('navigator:chunk', { profileId, chunk });
        }

        // Сохраняем в gateway.db после успешного завершения
        if (done) {
          try {
            const { GatewayCacheService } = await import('../services/gateway/cache/GatewayCacheService');
            const cache = GatewayCacheService.getInstance();
            const urlMatch = page.url().match(/\/sessions\/([a-f0-9-]+)/i);
            if (urlMatch && urlMatch[1]) {
              const convId = urlMatch[1];
              const existing = cache.getMessages(convId);
              const existingConv = cache.getConversation(convId);

              const title = existing.length > 0
                ? (existingConv?.title ?? message.slice(0, 60))
                : message.slice(0, 60);

              const incoming: IncomingMessage[] = existing.map((m) => ({
                id: m.id,
                role: m.role,
                contentPlain: m.contentPlain,
                contentHtml: m.contentHtml,
                thinking: m.thinking,
                blocks: m.blocks,
                sources: m.sources,
                branchTotal: m.branchTotal,
                branchIndex: m.branchIndex,
                isActive: m.isActive,
              }));

              incoming.push({ role: 'user', contentPlain: message });
              incoming.push({
                role: 'assistant',
                contentPlain: finalText || finalHtml,
                contentHtml: finalHtml || undefined,
              });

              await cache.syncConversation(convId, title, incoming, { profileId });
            }
          } catch (e) {
            console.error('[Navigator] sync to gateway.db failed:', e);
          }
        }

        return { success: true };
      } catch (err: any) {
        return { success: false, error: err?.message ?? String(err) };
      }
    },
  );

  // ── navigator:list-conversations (из БД Gateway) ─────────────────────
  ipcMain.handle('navigator:list-conversations', async (_e, profileId: string) => {
    try {
      if (!profileId) throw new Error('profileId обязателен');
      // Lazy import — не тащим GatewayCacheService в основной импорт
      const { GatewayCacheService } = await import('../services/gateway/cache/GatewayCacheService');
      const cache = GatewayCacheService.getInstance();
      return { success: true, data: cache.listConversations(profileId) };
    } catch (err: any) {
      return { success: false, error: err?.message ?? String(err) };
    }
  });

  // ── navigator:get-messages (из БД Gateway) ───────────────────────────
    // ── navigator:get-messages (из БД Gateway) ───────────────────────────
  ipcMain.handle('navigator:get-messages', async (_e, conversationId: string) => {
    // ... существующее (не трогаем)
    try {
      if (!conversationId) throw new Error('conversationId обязателен');
      const { GatewayCacheService } = await import('../services/gateway/cache/GatewayCacheService');
      const cache = GatewayCacheService.getInstance();
      const messages = cache.getMessages(conversationId);
      return {
        success: true,
        data: messages.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.contentHtml ?? m.contentPlain,
          format: m.contentHtml ? 'html' : 'text',
          thinking: m.thinking,
          blocks: m.blocks,
          sources: m.sources,
          sequence: m.sequence,
          savedAt: m.savedAt,
        })),
      };
    } catch (err: any) {
      return { success: false, error: err?.message ?? String(err) };
    }
  });

  // ── navigator:sync-conversations (парсит сайдбар GigaChat) ───────────
  ipcMain.handle('navigator:sync-conversations', async (_e, profileId: string) => {
    try {
      if (!profileId) throw new Error('profileId обязателен');
      const pool = await getBrowserPool();
      const { resolvePage } = await import('../services/navigator/sessionManager');
      const page = await resolvePage(profileId, pool);

      const { GigaChatAdapter } = await import('../services/gateway/providers/gigachat/adapter');
      const adapter = new GigaChatAdapter();
      // TD-NEW: patchright-core vs playwright-core. Каст локализован здесь.
      const convs = await adapter.getConversations(page as any);

      const { GatewayCacheService } = await import('../services/gateway/cache/GatewayCacheService');
      const cache = GatewayCacheService.getInstance();

      // Синкаем только заголовки. Сообщения подгрузим по клику.
      for (const c of convs) {
        // Если диалог уже есть в БД — не перезаписываем его сообщения пустым массивом,
        // просто обновляем заголовок, если он изменился.
        const existing = cache.getConversation(c.id);
        if (!existing) {
          await cache.syncConversation(c.id, c.title, [], { profileId });
        }
      }

      return { success: true, data: { synced: convs.length } };
    } catch (err: any) {
      return { success: false, error: err?.message ?? String(err) };
    }
  });

  // ── navigator:sync-messages (парсит открытый диалог) ─────────────────
  ipcMain.handle('navigator:sync-messages', async (_e, profileId: string, convId: string, url: string) => {
    console.log('[Navigator:sync-messages] START', { profileId, convId, url });
    try {
      if (!profileId || !convId) throw new Error('profileId и convId обязательны');
      const pool = await getBrowserPool();
      const { resolvePage } = await import('../services/navigator/sessionManager');
      const page = await resolvePage(profileId, pool);
      console.log('[Navigator:sync-messages] page resolved, current URL:', page.url());

      if (url) {
        if (!page.url().includes(convId)) {
          console.log('[Navigator:sync-messages] navigating to', url);
          await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        } else {
          console.log('[Navigator:sync-messages] already on target URL');
        }
        console.log('[Navigator:sync-messages] waiting for [data-message-id]...');
        try {
          await page.waitForSelector('[data-message-id]', { timeout: 15000 });
          await page.waitForTimeout(1500); // даём SPA дорисовать
        } catch (e) {
          console.warn('[Navigator:sync-messages] timeout waiting for messages');
        }
      }

      const { GigaChatAdapter } = await import('../services/gateway/providers/gigachat/adapter');
      const adapter = new GigaChatAdapter();
      const msgs = await adapter.getCurrentMessages(page as any);
      console.log('[Navigator:sync-messages] parsed messages:', msgs.length);

      const { GatewayCacheService } = await import('../services/gateway/cache/GatewayCacheService');
      const cache = GatewayCacheService.getInstance();
      const existingConv = cache.getConversation(convId);
      const title = existingConv?.title || 'Без названия';

      // syncConversation ожидает IncomingMessage[]
      const incoming = msgs.map((m, idx) => ({
        id: m.id,
        role: m.role,
        contentPlain: m.contentPlain,
        contentHtml: m.contentHtml,
        sequence: idx + 1, // Явно задаём последовательность на всякий случай
        blocks: [], // Обязательное поле для некоторых версий
      }));

      console.log('[Navigator:sync-messages] calling syncConversation with', incoming.length, 'messages');
      await cache.syncConversation(convId, title, incoming, { profileId });
      console.log('[Navigator:sync-messages] syncConversation OK');

      return { success: true, data: { count: msgs.length } };
    } catch (err: any) {
      console.error('[Navigator:sync-messages] ERROR', err);
      return { success: false, error: err?.message ?? String(err) };
    }
  });
  
}
