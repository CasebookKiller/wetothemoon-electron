/**
 * SessionManager — сопоставляет профиль Gateway ↔ инструмент Navigator ↔ страницу.
 *
 * Единственное место, где Navigator «знает» о существовании Gateway-профилей
 * и BrowserPool. Всё остальное работает с абстракцией `ResolvedSession`.
 *
 * @module navigator/sessionManager
 */

import type { Page } from 'patchright';
import { ProfileService } from '../gateway/ProfileService';
import type { BrowserPool } from '../gateway/pool/BrowserPool';
import { get, type ToolEntry } from './toolRegistry';

/** Резолвнутая сессия: инструмент + готовая страница. */
export interface ResolvedSession {
  tool: ToolEntry;
  page: Page;
}

/**
 * Карта «провайдер Gateway → toolId Navigator».
 * Расширяется по мере добавления инструментов — единственное место правки.
 *
 * Этап 1: gigachat.
 * Этап 1.5: `deepseek: 'deepseek'`.
 */
const PROVIDER_TO_TOOL: Record<string, string> = {
  gigachat: 'gigachat',
};

/**
 * Разрешить сессию для профиля.
 *
 * @param profileId  ID профиля из `gateway.db`.
 * @param pool       Инстанс BrowserPool (обязательно **тот же**, что в Gateway —
 *                   см. `getBrowserPool()` в `gatewayHandlers.ts`).
 * @throws если профиль не найден, провайдер не поддержан или tool не зарегистрирован.
 */
export async function resolve(
  profileId: string,
  pool: BrowserPool,
): Promise<ResolvedSession> {
  const profile = ProfileService.getInstance().get(profileId);
  if (!profile) {
    throw new Error(`[SessionManager] профиль '${profileId}' не найден`);
  }

  const providerId = (profile as { provider?: string }).provider ?? 'deepseek';
  const toolId = PROVIDER_TO_TOOL[providerId];
  if (!toolId) {
    throw new Error(
      `[SessionManager] провайдер '${providerId}' пока не поддержан в Navigator ` +
      `(Этап 1: только GigaChat)`,
    );
  }

  const tool = get(toolId);
  if (!tool) {
    throw new Error(`[SessionManager] tool '${toolId}' не зарегистрирован`);
  }

  const acquired = await pool.acquire(profileId);

  // TD-NEW: BrowserPool (Gateway) использует playwright-core, а адаптеры Navigator —
  // patchright-core. Типы структурно идентичны, но TS считает их разными.
  // Приведение локализовано здесь — единственной границе Gateway ↔ Navigator,
  // чтобы не менять Gateway и не размазывать `as any` по коду.
  const page = (acquired as { page: unknown }).page as Page;
  if (!page) {
    throw new Error(
      `[SessionManager] pool.acquire не вернул page для '${profileId}'`,
    );
  }

  if (tool.connect) await tool.connect(page);

  return { tool, page };
}