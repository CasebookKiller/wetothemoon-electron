/**
 * BrowserPool — управление N BrowserContext для параллельной работы.
 *
 * Зачем: в окно бана (20:00–22:00) нужно максимизировать throughput.
 * Один браузер = один провайдер = один аккаунт. Несколько контекстов —
 * параллельные задачи.
 *
 * Принципы:
 * - Импортирует только playwright-core (не electron).
 * - Каждый BrowserContext — изолированная сессия (cookies, storage).
 * - Автоматическая очистка при close().
 * - Никакого глобального стейта — всё через Map.
 *
 * TODO (следующая сессия): IP-изоляция (прокси per-profile), TaskQueue.
 */

import type { BrowserContext, Browser } from 'playwright-core';

export interface BrowserPoolOpts {
  /** Максимум одновременных контекстов (default: 5) */
  maxContexts?: number;
  /** Логировать ли acquire/release (default: true) */
  debug?: boolean;
}

export interface AcquireOpts {
  /** Прокси (SOCKS5/HTTP) — для IP-изоляции (пока не реализовано) */
  proxy?: { server: string; username?: string; password?: string };
  /** User-Agent override */
  userAgent?: string;
  /** Viewport */
  viewport?: { width: number; height: number };
}

interface PoolEntry {
  context: BrowserContext;
  profileId: string;
  createdAt: number;
  lastUsedAt: number;
}

export class BrowserPool {
  private browser: Browser | null = null;
  private entries: Map<string, PoolEntry> = new Map();
  private readonly maxContexts: number;
  private readonly debug: boolean;

  constructor(browser: Browser, opts: BrowserPoolOpts = {}) {
    this.browser = browser;
    this.maxContexts = opts.maxContexts ?? 5;
    this.debug = opts.debug ?? true;
  }

  /**
   * Привязать Browser (из patchright). Вызывается после launch.
   */
  attach(browser: Browser): void {
    if (this.browser && !this.browser.isConnected()) {
      this.log('attach: старый Browser отключён, заменяем');
    }
    this.browser = browser;
  }

  /**
   * Получить или создать BrowserContext для profileId.
   * Если контекст уже есть — обновить lastUsedAt и вернуть.
   */
  async acquire(profileId: string, opts: AcquireOpts = {}): Promise<BrowserContext> {
    if (!this.browser || !this.browser.isConnected()) {
      throw new Error('[BrowserPool] Browser не подключён. Вызови attach() после launch().');
    }

    const existing = this.entries.get(profileId);
    if (existing) {
      existing.lastUsedAt = Date.now();
      this.log(`acquire: reuse profileId=${profileId}`);
      return existing.context;
    }

    if (this.entries.size >= this.maxContexts) {
      throw new Error(
        `[BrowserPool] Достигнут лимит контекстов (${this.maxContexts}). ` +
        `Освободи через release(profileId) перед acquire нового.`
      );
    }

    const context = await this.browser.newContext({
      userAgent: opts.userAgent,
      viewport: opts.viewport ?? { width: 1280, height: 800 },
      // proxy в playwright-core — на уровне launch, не newContext,
      // поэтому IP-изоляция пока не реализована (TODO следующая сессия)
    });

    this.entries.set(profileId, {
      context,
      profileId,
      createdAt: Date.now(),
      lastUsedAt: Date.now(),
    });

    this.log(`acquire: new profileId=${profileId} (total=${this.entries.size})`);
    return context;
  }

  /**
   * Освободить контекст (закрыть).
   */
  async release(profileId: string): Promise<void> {
    const entry = this.entries.get(profileId);
    if (!entry) {
      this.log(`release: profileId=${profileId} не найден (no-op)`);
      return;
    }
    this.entries.delete(profileId);
    try {
      await entry.context.close();
    } catch (e) {
      this.log(`release: ошибка close для profileId=${profileId}: ${(e as Error).message}`);
    }
    this.log(`release: profileId=${profileId} (осталось=${this.entries.size})`);
  }

  /**
   * Закрыть все контексты и отвязать Browser.
   */
  async closeAll(): Promise<void> {
    const ids = Array.from(this.entries.keys());
    this.log(`closeAll: закрываем ${ids.length} контекстов`);
    for (const id of ids) {
      await this.release(id);
    }
    this.browser = null;
  }

  /**
   * Статус пула — для UI / диагностики.
   */
  status(): Array<{ profileId: string; ageMs: number; idleMs: number }> {
    const now = Date.now();
    return Array.from(this.entries.values()).map((e) => ({
      profileId: e.profileId,
      ageMs: now - e.createdAt,
      idleMs: now - e.lastUsedAt,
    }));
  }

  /**
   * Параллельный запуск нескольких задач с ограничением concurrency.
   * Полезно в окно бана: 3 задачи × 1 профиль → 3 параллельных context.
   */
  async parallel<T>(
    tasks: Array<{ profileId: string; run: (ctx: BrowserContext) => Promise<T> }>,
    concurrency = this.maxContexts,
  ): Promise<T[]> {
    const results: T[] = [];
    const queue = [...tasks];

    const workers = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
      while (queue.length > 0) {
        const task = queue.shift();
        if (!task) break;
        const ctx = await this.acquire(task.profileId);
        try {
          const r = await task.run(ctx);
          results.push(r);
        } catch (e) {
          this.log(`parallel: ошибка profileId=${task.profileId}: ${(e as Error).message}`);
          throw e;
        }
      }
    });

    await Promise.all(workers);
    return results;
  }

  private log(msg: string): void {
    if (this.debug) {
      console.log(`[BrowserPool] ${msg}`);
    }
  }
}