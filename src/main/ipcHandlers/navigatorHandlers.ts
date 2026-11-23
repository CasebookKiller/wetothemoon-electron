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

        for await (const chunk of tool.send(page, { message })) {
          if (event.sender.isDestroyed()) break;
          event.sender.send('navigator:chunk', { profileId, chunk });
        }
        return { success: true };
      } catch (err: any) {
        return { success: false, error: err?.message ?? String(err) };
      }
    },
  );
}