// src/main/services/gateway/pool/BrowserPool.ts
//
// BrowserPool v2 — вариант A для persistent-профилей (DeepSeek, GigaChat).
//
// Модель: Map<profileId, BrowserContext>. Один профиль = один Chrome = один
// --user-data-dir. Параллельные профили живут одновременно, release(profileId)
// закрывает ТОЛЬКО один профиль.
//
// Почему не вариант C (один Chrome + N BrowserContext):
//   launchPersistentContext() возвращает BrowserContext, а не Browser.
//   N persistent-профилей в одном процессе невозможны.
//
// Guard в acquire(): если профиль уже запущен — вернуть существующий контекст,
// не запускать второй. Снимает П7 (single-instance lock).
//
// Для GigaChat (1 профиль + N вкладок):
//   acquirePage(profileId, slotId) / releasePage(profileId, slotId).
//
// Для DeepSeek (N профилей = N браузеров):
//   acquire(profileId) на каждый профиль.
//
// Пример резолвера профиля (для ProfileService):
//
//   const ps = ProfileService.getInstance();
//   const pool = new BrowserPool({
//     resolveProfile: (id) => {
//       const p = ps.get(id);
//       if (!p) throw new Error(`profile ${id} not found`);
//       if (p.browserKind === 'yandex') {
//         throw new Error('Yandex profiles handled outside BrowserPool');
//       }
//       return {
//         userDataDir: ps.browserProfileDir(p),
//         browserKind: p.browserKind,
//         cdpPort: p.cdpPort,
//         chromeCdpPort: p.chromeCdpPort,
//       };
//     },
//   });
//
//   // DeepSeek:
//   const { context, page } = await pool.acquire('p_mwlvf2ym_mmej');
//
//   // GigaChat (несколько вкладок одного профиля):
//   await pool.acquire('p_mwnqhvvi_rm0d'); // основной контекст
//   const tab1 = await pool.acquirePage('p_mwnqhvvi_rm0d', 'coding');
//   const tab2 = await pool.acquirePage('p_mwnqhvvi_rm0d', 'fitness');

import { chromium } from 'patchright';
import type { BrowserContext, Page } from 'patchright';

export interface PoolProfileInfo {
  /** Абсолютный путь к --user-data-dir профиля. */
  userDataDir: string;
  /** chrome — через patchright; yandex — вне пула (внешний процесс). */
  browserKind: 'chrome' | 'yandex';
  /** Внутренний CDP (для attach к уже запущенному, если понадобится). */
  cdpPort?: number;
  /** Внешний CDP-порт (--remote-debugging-port). */
  chromeCdpPort?: number;
}

export interface BrowserPoolOpts {
  /** Как резолвить профиль по id. Обычно — обёртка над ProfileService. */
  resolveProfile: (profileId: string) => PoolProfileInfo | Promise<PoolProfileInfo>;
  /** Канал Chromium. По умолчанию 'chrome' (stealth-канал). */
  channel?: 'chrome' | 'msedge' | 'chromium';
  /** Прокси per-profile. TD13, сейчас не используется. */
  proxy?: (profileId: string) =>
    | { server: string; username?: string; password?: string }
    | undefined;
  /** Логирование. По умолчанию console.log. */
  log?: (msg: string) => void;
}

export interface AcquiredContext {
  profileId: string;
  context: BrowserContext;
  page: Page;
  /** true — вернули существующий контекст, false — только что запустили. */
  reused: boolean;
}

export class BrowserPool {
  private contexts = new Map<string, BrowserContext>();
  private mainPages = new Map<string, Page>();
  private slotPages = new Map<string, Page>(); // "profileId::slotId" → Page
  private launching = new Map<string, Promise<AcquiredContext>>(); // guard от race
  private opts: BrowserPoolOpts;

  constructor(opts: BrowserPoolOpts) {
    this.opts = opts;
  }

  private log(msg: string) {
    (this.opts.log ?? console.log)(`[BrowserPool] ${msg}`);
  }

  // ─── Read-only ─────────────────────────────────────────────────

  has(profileId: string): boolean {
    return this.contexts.has(profileId);
  }

  list(): string[] {
    return [...this.contexts.keys()];
  }

  getContext(profileId: string): BrowserContext | null {
    return this.contexts.get(profileId) ?? null;
  }

  getPage(profileId: string): Page | null {
    return this.mainPages.get(profileId) ?? null;
  }

  // ─── Acquire / Release (профиль) ───────────────────────────────

  async acquire(profileId: string): Promise<AcquiredContext> {
    // Guard П7: уже запущен — вернуть существующий
    const existing = this.contexts.get(profileId);
    if (existing) {
      const page = this.mainPages.get(profileId) ?? (await this.pickOrCreatePage(existing));
      this.mainPages.set(profileId, page);
      return { profileId, context: existing, page, reused: true };
    }

    // Guard от race: параллельный acquire ждёт тот же promise
    const pending = this.launching.get(profileId);
    if (pending) return pending;

    const promise = this.launch(profileId);
    this.launching.set(profileId, promise);
    try {
      return await promise;
    } finally {
      this.launching.delete(profileId);
    }
  }

  private async launch(profileId: string): Promise<AcquiredContext> {
    const info = await this.opts.resolveProfile(profileId);
    if (!info?.userDataDir) {
      throw new Error(`[BrowserPool] resolveProfile вернул пустой userDataDir для ${profileId}`);
    }
    if (info.browserKind === 'yandex') {
      throw new Error(
        `[BrowserPool] профиль ${profileId} имеет browserKind=yandex — ` +
          `Yandex обрабатывается вне пула (внешний процесс).`
      );
    }

    const channel = this.opts.channel ?? 'chrome';
    const args: string[] = [];
    if (info.chromeCdpPort) args.push(`--remote-debugging-port=${info.chromeCdpPort}`);

    const proxy = this.opts.proxy?.(profileId);

    this.log(`launch ${profileId} (dir=${info.userDataDir})`);
    const context = await chromium.launchPersistentContext(info.userDataDir, {
      headless: false,
      channel,
      args,
      proxy: proxy
        ? { server: proxy.server, username: proxy.username, password: proxy.password }
        : undefined,
    });

    const page = await this.pickOrCreatePage(context);

    this.contexts.set(profileId, context);
    this.mainPages.set(profileId, page);

    // Пользователь закрыл браузер вручную — чистим реестр
    context.on('close', () => {
      if (this.contexts.get(profileId) === context) {
        this.contexts.delete(profileId);
        this.mainPages.delete(profileId);
        // slot-вкладки этого профиля тоже мертвы
        for (const key of [...this.slotPages.keys()]) {
          if (key.startsWith(`${profileId}::`)) this.slotPages.delete(key);
        }
        this.log(`context closed: ${profileId}`);
      }
    });

    return { profileId, context, page, reused: false };
  }

  private async pickOrCreatePage(context: BrowserContext): Promise<Page> {
    const pages = context.pages();
    return pages.length > 0 ? pages[0] : await context.newPage();
  }

  async release(profileId: string): Promise<void> {
    const context = this.contexts.get(profileId);
    if (!context) return;
    this.contexts.delete(profileId);
    this.mainPages.delete(profileId);
    for (const key of [...this.slotPages.keys()]) {
      if (key.startsWith(`${profileId}::`)) this.slotPages.delete(key);
    }
    this.log(`release ${profileId}`);
    try {
      await context.close();
    } catch (e) {
      this.log(`release error ${profileId}: ${(e as Error).message}`);
    }
  }

  async releaseAll(): Promise<void> {
    const ids = [...this.contexts.keys()];
    await Promise.all(ids.map((id) => this.release(id)));
  }

  // ─── Slot-вкладки (GigaChat: 1 профиль + N вкладок) ────────────

  async acquirePage(profileId: string, slotId: string): Promise<Page> {
    const key = `${profileId}::${slotId}`;
    const existing = this.slotPages.get(key);
    if (existing && !existing.isClosed()) return existing;

    const { context } = await this.acquire(profileId);
    const page = await context.newPage();
    this.slotPages.set(key, page);
    page.on('close', () => {
      if (this.slotPages.get(key) === page) this.slotPages.delete(key);
    });
    return page;
  }

  async releasePage(profileId: string, slotId: string): Promise<void> {
    const key = `${profileId}::${slotId}`;
    const page = this.slotPages.get(key);
    if (!page) return;
    this.slotPages.delete(key);
    try {
      await page.close();
    } catch (e) {
      this.log(`releasePage error ${key}: ${(e as Error).message}`);
    }
  }

  listPages(profileId: string): string[] {
    const prefix = `${profileId}::`;
    return [...this.slotPages.keys()]
      .filter((k) => k.startsWith(prefix))
      .map((k) => k.slice(prefix.length));
  }
}