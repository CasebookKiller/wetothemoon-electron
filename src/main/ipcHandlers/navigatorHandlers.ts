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

// Mutex: одна sync-messages за раз на профиль. Защита от race, если UI
// случайно (или программно) вызовет параллельно.
const activeSyncs = new Set<string>();

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
              try {
                event.sender.send('navigator:conversation-saved', {
                  profileId,
                  convId,
                  count: incoming.length,
                });
              } catch { /* окно закрыто */ }
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

  // ── navigator:launch-profile (через BrowserPool, параллельно с Gateway) ──
  // Заменяет legacy DeepSeekService.switchProfile, который делает this.browser.close()
  // и убивает все контексты (включая Gateway'шный). См. handoff 2026-11-25 вечер.
  /*ipcMain.handle('navigator:launch-profile', async (_e, profileId: string) => {
    try {
      if (!profileId) throw new Error('profileId обязателен');
      const pool = await getBrowserPool();
      const { page } = await pool.acquire(profileId);

      const { ProfileService } = await import('../services/gateway/ProfileService');
      const profile = ProfileService.getInstance().get(profileId);
      if (!profile) throw new Error(`Профиль не найден: ${profileId}`);

      // GatewayProfile.provider опционален: legacy-профили без поля.
      // Default из комментария к типу: 'deepseek' (gigachat резолвится по id/имени выше в ProfileService).
      const provider = profile.provider ?? 'deepseek';

      const URL_BY_PROVIDER: Record<string, string> = {
        gigachat: 'https://giga.chat',
        deepseek: 'https://chat.deepseek.com',
      };
      const url = URL_BY_PROVIDER[provider];
      if (!url) throw new Error(`Нет URL для провайдера: ${provider}`);

      if (!page.url().includes(new URL(url).hostname)) {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      }

      return { success: true, data: { status: 'launched', provider: profile.provider } };
    } catch (err: any) {
      return { success: false, error: err?.message ?? String(err) };
    }
  });*/
  
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
        // Если диалог уже есть в БД — не перезаписываем его сообщения пустым массивом.
        const existing = cache.getConversation(c.id);
        if (!existing) {
          await cache.syncConversation(c.id, c.title, [], { profileId });
        }
        // Синхронизируем pinned + position (порядок из GigaChat DOM).
        // listConversations сортирует: pinned DESC, position ASC, last_message_at DESC.
        if (typeof c.pinned === 'boolean') {
          cache.setConversationPositionAndPinned(
            c.id,
            c.pinned,
            typeof c.position === 'number' ? c.position : 999999,
          );
        }
      }

      // Mirror: архивируем всё, чего GigaChat больше не отдаёт (phantom — удалены в GigaChat).
      // Безопасно: archived=1 — не показывается в UI, но данные целы (можно вернуть).
      // Порог 50 — защита от бага scroll (не выкосить всё за один глюк).
      // MIRROR отключён: adapter не видит ~70 диалогов (scroll cap GigaChat ~190).
      // Они реальные (открываются в GigaChat), mirror их ошибочно архивировал.
      // TODO: включить после решения scroll. Альтернатива — sync_miss_count.
      // if (convs.length > 50) {
      //   const liveIds = new Set(convs.map((c) => c.id));
      //   cache.archiveConversationsNotIn(profileId, liveIds);
      // }

      return { success: true, data: { synced: convs.length } };
    } catch (err: any) {
      return { success: false, error: err?.message ?? String(err) };
    }
  });

  // ── navigator:sync-messages (парсит открытый диалог) ─────────────────
  ipcMain.handle('navigator:sync-messages', async (_e, profileId: string, convId: string, url: string) => {
    if (activeSyncs.has(profileId)) {
      console.log('[Navigator:sync-messages] BUSY, skip', { profileId, convId });
      return { success: false, error: 'Синхронизация уже идёт' };
    }
    activeSyncs.add(profileId);
    console.log('[Navigator:sync-messages] START', { profileId, convId, url });
    try {
      if (!profileId || !convId) throw new Error('profileId и convId обязательны');
      const pool = await getBrowserPool();
      const { resolvePage } = await import('../services/navigator/sessionManager');
      const page = await resolvePage(profileId, pool);
      console.log('[Navigator:sync-messages] page resolved, current URL:', page.url());

      // URL восстанавливаем из convId, если не передан (URL GigaChat предсказуем).
      let targetUrl = url;
      if (!targetUrl) {
        try {
          targetUrl = new URL(`/sessions/${convId}`, page.url() || 'https://giga.chat').href;
        } catch {
          targetUrl = `https://giga.chat/sessions/${convId}`;
        }
      }

      if (!page.url().includes(convId)) {
        console.log('[Navigator:sync-messages] navigating to', targetUrl);
        // SPA-специфика: page.goto на клиентский роут часто даёт ERR_ABORTED,
        // потому что старый документ ещё не отпустил фрейм. Это не сбой —
        // страница, как правило, всё равно переходит. Используем 'commit'
        // (минимум ожидания) и глушим именно ERR_ABORTED, остальное — пробрасываем.
        try {
          await page.goto(targetUrl, { waitUntil: 'commit', timeout: 30000 });
        } catch (e: any) {
          const msg = String(e?.message || e);
          if (msg.includes('ERR_ABORTED')) {
            console.warn('[Navigator:sync-messages] goto aborted (SPA), continuing');
          } else {
            throw e;
          }
        }
      } else {
        console.log('[Navigator:sync-messages] already on target URL');
      }

      // Ждём отрисовки сообщений — ВСЕГДА (а не только когда был url)
      console.log('[Navigator:sync-messages] waiting for [data-message-id]...');
      try {
        await page.waitForSelector('[data-message-id]', { timeout: 20000 });
        await page.waitForTimeout(1500); // даём SPA дорисовать
      } catch (e) {
        console.warn('[Navigator:sync-messages] timeout waiting for messages');
      }

      // Verify: page должна быть на целевом диалоге. Иначе (race с параллельным sync)
      // парсим чужие сообщения и пишем в этот convId — порча данных.
      const currentUrl = page.url();
      if (!currentUrl.includes(convId)) {
        console.warn(
          '[Navigator:sync-messages] URL mismatch: expected', convId, 'got', currentUrl, '— abort',
        );
        return { success: false, error: `Навигация не удалась (page на ${currentUrl})` };
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
      try { _e.sender.send('navigator:conversation-saved', { profileId, convId, count: msgs.length }); } catch { /* окно закрыто */ }
      console.log('[Navigator:sync-messages] syncConversation OK');

      return { success: true, data: { count: msgs.length } };
    } catch (err: any) {
      return { success: false, error: err?.message ?? String(err) };
    } finally {
      activeSyncs.delete(profileId);
    }
  });

  // ── navigator:launch-profile (через BrowserPool, параллельно с Gateway) ──
  ipcMain.handle('navigator:launch-profile', async (_e, profileId: string) => {
    try {
      if (!profileId) throw new Error('profileId обязателен');
      const pool = await getBrowserPool();
      const { page } = await pool.acquire(profileId);

      const { ProfileService } = await import('../services/gateway/ProfileService');
      const profile = ProfileService.getInstance().get(profileId);
      if (!profile) throw new Error(`Профиль не найден: ${profileId}`);

      const provider = profile.provider ?? 'deepseek';

      const URL_BY_PROVIDER: Record<string, string> = {
        gigachat: 'https://giga.chat',
        deepseek: 'https://chat.deepseek.com',
      };
      const url = URL_BY_PROVIDER[provider];
      if (!url) throw new Error(`Нет URL для провайдера: ${provider}`);

      if (!page.url().includes(new URL(url).hostname)) {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      }

      return { success: true, data: { status: 'launched', provider } };
    } catch (err: any) {
      return { success: false, error: err?.message ?? String(err) };
    }
  });

}
