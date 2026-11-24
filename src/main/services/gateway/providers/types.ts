/**
 * ProviderAdapter — единый интерфейс для всех browser-провайдеров LLM.
 *
 * Зачем: вместо хардкода DeepSeek в deepseekService.ts — абстракция.
 * Каждый провайдер (DeepSeek, GigaChat, Алиса, Duck.ai, HuggingChat) реализует
 * этот интерфейс и регистрируется в registry.ts.
 *
 * Принципы:
 * - Никаких импортов electron в адаптерах (только types).
 * - BrowserContext — из playwright-core, не electron.
 * - Стриминг через AsyncIterable.
 */

import type { BrowserContext, Page } from 'playwright-core';

// ─── Селекторы провайдера ────────────────────────────────────────────────

export interface ProviderSelectors {
  /** CSS-селектор поля ввода сообщения */
  input: string;
  /** CSS-селектор кнопки отправки */
  send: string;
  /** CSS-селектор контейнера ответа (для polling / наблюдения) */
  response: string;
  /** CSS-селектор индикатора стрима (когда ответ ещё идёт) */
  streaming?: string;
  /** CSS-селектор кнопки нового чата (опционально) */
  newChat?: string;
  /** CSS-селектор списка conversation (опционально) */
  conversationsList?: string;
}

// ─── Паттерны куки ───────────────────────────────────────────────────────

export interface CookiePattern {
  /** Имя куки или regex */
  name: string | RegExp;
  /** Зачем трекаем */
  purpose: 'session' | 'auth' | 'tracking' | 'analytics' | 'fingerprint' | 'unknown';
  /** Важность */
  severity: 'critical' | 'warning' | 'info';
  /** Комментарий для человека */
  note?: string;
}

// ─── Сообщения / чанки / conversation ───────────────────────────────────

/**
 * Формат содержимого чанка. Адаптер объявляет, что отдаёт:
 *  - 'text'     — plain text (default, обратная совместимость)
 *  - 'markdown' — markdown-строка (DeepSeek API, будущие HTTP-адаптеры)
 *  - 'html'     — готовый HTML из DOM (GigaChat, DOM-scrape-адаптеры)
 * UI рендерит по этому полю; адаптер его не «угадывает».
 */
export type ChunkFormat = 'text' | 'markdown' | 'html';

export interface MessageChunk {
  type: 'text' | 'reasoning' | 'usage' | 'done' | 'error';
  text?: string;
  /** Для type='text': сигнал «очистить предыдущий буфер» (DOM-замена, не append) */
  reset?: boolean;
  /** Формат содержимого `text`. По умолчанию 'text' (обратная совместимость). */
  format?: ChunkFormat;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  meta?: Record<string, unknown>;
}

export interface Conversation {
  id: string;
  title: string;
  createdAt?: number;
  updatedAt?: number;
  messageCount?: number;
  url?: string;
  /** Избранное (pin). В GigaChat — data-da_favorite="true". */
  pinned?: boolean;
  /** Порядок в сайдбаре GigaChat (0..N). Используется для сортировки в Navigator. */
  position?: number;
}

// ─── Опции sendMessage ───────────────────────────────────────────────────

export interface SendMessageOpts {
  model?: string;
  signal?: AbortSignal;
  timeoutMs?: number;
  conversationId?: string;
  extras?: Record<string, unknown>;
}

// ─── Основной интерфейс ──────────────────────────────────────────────────

export interface ProviderAdapter {
  readonly name: string;
  readonly displayName: string;
  readonly baseUrl: string;
  readonly requiresAuth: boolean;
  readonly selectors: ProviderSelectors;
  readonly cookiePatterns: CookiePattern[];

  connect(context: BrowserContext): Promise<Page>;
  sendMessage(page: Page, message: string, opts?: SendMessageOpts): AsyncIterable<MessageChunk>;
  getConversations?(page: Page): Promise<Conversation[]>;
  isLoggedIn?(page: Page): Promise<boolean>;
}

// ─── Результат проверки доступности ─────────────────────────────────────

export interface ProviderAvailability {
  available: boolean;
  reason?: string;
  requiresLogin?: boolean;
}
