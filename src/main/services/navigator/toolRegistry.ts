/**
 * ToolRegistry — единый реестр инструментов Navigator.
 *
 * Назначение: держать в одном месте все ToolAdapter'ы (llm/site/utility),
 * чтобы IPC-слой и SessionManager не знали конкретных реализаций.
 *
 * Паттерн расширения: каждый модуль-инструмент регистрируется сам через
 * `onRegistryInit(...)` при первом вызове `initTools()`. Это позволяет
 * добавлять новые инструменты (deepseek, rusprofile, email-gen) без правки
 * этого файла и без циклических импортов.
 *
 * @module navigator/toolRegistry
 */

import type { Page } from 'patchright';

/** Категория инструмента. Определяет, какой из методов (`send`/`run`/`invoke`) используется. */
export type ToolKind = 'llm' | 'site' | 'utility';

/** Параметры вызова `send` для LLM-инструментов. */
export interface ToolSendParams {
  /** Текст сообщения пользователя. */
  message: string;
  /** Доп. параметры (system prompt, temperature и т.п.) — зарезервировано под расширение. */
  [key: string]: unknown;
}

/** Унифицированный результат `run`/`invoke` для site/utility-инструментов. */
export interface ToolRunResult {
  ok: boolean;
  data?: unknown;
  error?: string;
}

/** Опции стрима — прокидываются из Gateway без изменений (совместимость). */
export type ToolSendOpts = Record<string, unknown>;

/**
 * Единый дескриптор инструмента Navigator.
 *
 * Инварианты:
 *  - `kind === 'llm'`     → должен быть определён `send`
 *  - `kind === 'site'`    → должен быть определён `run`
 *  - `kind === 'utility'` → должен быть определён `invoke`
 *
 * Все поля, кроме `id`/`kind`/`displayName`/`requiresAuth`, опциональны,
 * чтобы один и тот же тип покрывал три категории без ветвлений в UI.
 */
export interface ToolEntry {
  /** Уникальный стабильный идентификатор (совпадает с `provider` где применимо). */
  id: string;
  kind: ToolKind;
  /** Человекочитаемое имя для UI. */
  displayName: string;
  /** Требуется ли авторизованная сессия (для бейджа «нет сессии» в UI). */
  requiresAuth: boolean;

  /**
   * Опциональная инициализация страницы после `pool.acquire`.
   * Используется адаптерами, которым нужно дождаться загрузки SPA
   * (например, GigaChatAdapter.connect).
   */
  connect?: (page: Page) => Promise<void>;

  /** Стриминговый вызов для LLM. Возвращает AsyncIterable чанков. */
  send?: (
    page: Page,
    params: ToolSendParams,
    opts?: ToolSendOpts,
  ) => AsyncIterable<unknown>;

  /** Запрос→ответ для site-инструментов (работает через page). */
  run?: (
    page: Page,
    action: string,
    params: Record<string, unknown>,
  ) => Promise<ToolRunResult>;

  /** Запрос→ответ для utility-инструментов (без браузера). */
  invoke?: (
    action: string,
    params: Record<string, unknown>,
  ) => Promise<ToolRunResult>;
}

/** Внутренний реестр. Ключ — `ToolEntry.id`. */
const registry = new Map<string, ToolEntry>();

/** Хуки инициализации — накапливаются до первого `initTools()`. */
const initHooks: Array<() => void> = [];

/**
 * Зарегистрировать инструмент.
 * @throws если инструмент с таким `id` уже зарегистрирован (защита от опечаток).
 */
export function register(tool: ToolEntry): void {
  if (!tool.id) throw new Error('[ToolRegistry] tool.id обязателен');
  if (registry.has(tool.id)) {
    throw new Error(`[ToolRegistry] инструмент '${tool.id}' уже зарегистрирован`);
  }
  registry.set(tool.id, tool);
}

/** Получить инструмент по id. Возвращает `null`, если не найден. */
export function get(id: string): ToolEntry | null {
  return registry.get(id) ?? null;
}

/** Список всех зарегистрированных инструментов (для UI). */
export function list(): ToolEntry[] {
  return Array.from(registry.values());
}

/**
 * Зарегистрировать хук, который выполнится один раз при `initTools()`.
 * Позволяет модулям-инструментам саморегистрироваться без циклических импортов.
 */
export function onRegistryInit(fn: () => void): void {
  initHooks.push(fn);
}

/**
 * Инициализировать реестр: выполнить все накопленные хуки.
 * Идемпотентно — повторные вызовы безопасны.
 */
export function initTools(): void {
  if (initHooks.length === 0) return;
  const hooks = initHooks.splice(0, initHooks.length);
  for (const fn of hooks) {
    try {
      fn();
    } catch (err) {
      // Не валим весь init из-за одного инструмента — логируем и идём дальше.
      // eslint-disable-next-line no-console
      console.error('[ToolRegistry] init hook failed:', err);
    }
  }
}