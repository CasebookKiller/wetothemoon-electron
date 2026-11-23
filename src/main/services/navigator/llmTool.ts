/**
 * llmTool — фабрика LLM-инструментов поверх существующего ProviderAdapter
 * из Gateway. Gateway-код не модифицируется: мы только оборачиваем его
 * в контракт `ToolEntry`, чтобы Navigator работал через единый реестр.
 *
 * @module navigator/llmTool
 */

import type { Page } from 'patchright';
import { getProvider } from '../gateway/providers/registry';
import type { ProviderAdapter } from '../gateway/providers/types';

/**
 * Тип первого аргумента `sendMessage` у Gateway-адаптера.
 * TD-NEW: Gateway использует `playwright-core`, Navigator — `patchright-core`.
 * Типы структурно идентичны, но TS считает их разными. Берём тип из контракта
 * адаптера, чтобы приведение не разъехалось при изменении сигнатуры.
 */
type AdapterPage = Parameters<ProviderAdapter['sendMessage']>[0];
import {
  register,
  onRegistryInit,
  type ToolEntry,
  type ToolSendParams,
  type ToolSendOpts,
} from './toolRegistry';

/** Доп. опции фабрики. */
interface MakeLlmToolOptions {
  /** Требуется ли сессия (по умолчанию — да). */
  requiresAuth?: boolean;
  /**
   * Опциональная инициализация страницы после `pool.acquire`.
   * Нужна адаптерам, у которых нет собственного `connect()`:
   * например, GigaChatAdapter ожидает, что страница уже на giga.chat.
   */
  connect?: (page: Page) => Promise<void>;
}

/**
 * Создать LLM-инструмент, делегирующий в зарегистрированный ProviderAdapter.
 *
 * @param id            ID провайдера в `gateway/providers/registry` (например, 'gigachat').
 * @param displayName   Имя для UI.
 * @param options       Доп. опции (требуется ли авторизация, connect-хук).
 */
export function makeLlmTool(
  id: string,
  displayName: string,
  options: MakeLlmToolOptions = {},
): ToolEntry {
  return {
    id,
    kind: 'llm',
    displayName,
    requiresAuth: options.requiresAuth ?? true,
    connect: options.connect,
    send: (
      page: Page,
      params: ToolSendParams,
      opts?: ToolSendOpts,
    ) => {
      const adapter = getProvider(id);
      if (!adapter) {
        throw new Error(
          `[llmTool] провайдер '${id}' не зарегистрирован в gateway/providers/registry`,
        );
      }
      if (typeof adapter.sendMessage !== 'function') {
        throw new Error(`[llmTool] у провайдера '${id}' нет sendMessage()`);
      }
      // TD-NEW: локальное приведение Gateway ↔ Navigator, см. тип AdapterPage.
      return adapter.sendMessage(page as unknown as AdapterPage, params.message, opts);
    },
  };
}

/**
 * GigaChat-специфичный connect: гарантирует, что страница на giga.chat.
 * Если профиль только что запущен через `gateway:launch-by-profile` — URL уже нужный,
 * повторный goto не делаем (сохраняем SPA-state).
 */
async function connectGigaChat(page: Page): Promise<void> {
  if (!page.url().includes('giga.chat')) {
    await page.goto('https://giga.chat', {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
  }
}

/**
 * Зарегистрировать все LLM-инструменты, поддержанные на текущем этапе.
 *
 * Этап 1: только GigaChat.
 * Этап 1.5: `+ makeLlmTool('deepseek', 'DeepSeek')` — после `DeepSeekAdapter.sendMessage`.
 * Этап 3: Alice / Qwen — там же.
 */
export function registerLlmTools(): void {
  register(makeLlmTool('gigachat', 'GigaChat', { connect: connectGigaChat }));
  // register(makeLlmTool('deepseek', 'DeepSeek')); // Этап 1.5
}

// Саморегистрация при первом initTools() — без циклического импорта в toolRegistry.
onRegistryInit(registerLlmTools);