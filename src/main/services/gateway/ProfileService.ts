// src/main/services/gateway/ProfileService.ts
//
// Реестр профилей. Каждый профиль = отдельный Yandex user-data-dir +
// отдельный CDP-порт + отдельные storage.json/cookies.json. Переключение
// профиля в DeepSeekService = disconnect() + launch() с новым портом.
import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';

export interface GatewayProfile {
  id: string;
  name: string;
  cdpPort: number;
  /** Стратегия запуска браузера. Старые записи без поля = 'yandex'. */
  browserKind?: 'yandex' | 'chrome';
  /** CDP-порт для Chrome-профиля (нужен только recon-скриптам). По умолчанию cdpPort+100. */
  chromeCdpPort?: number;
  /** API-ключ DeepSeek (официальный, для fallback-канала). Если не задан — берётся из env DEEPSEEK_API_KEY. */
  apiKey?: string;
  dirName: string;
  createdAt: string;
  lastActiveAt: string | null;
  notes?: string;
  /** P0.5: до какого момента (epoch ms) профиль в rate-limit. null/undefined — доступен. */
  rateLimitedUntil?: number;
  /** P0.5: если установлено — профиль забанен. Снимается только вручную. */
  bannedAt?: string;
}

interface Registry {
  version: 1;
  activeId: string;
  profiles: GatewayProfile[];
}

// 9320-9419: избегаем 9222 (личный Yandex), 9322-9323 (default/acc2)
const DEFAULT_PORT_BASE = 9320;
const PORT_SPAN = 100;

export class ProfileService {
  private static instance: ProfileService;
  private registry: Registry;
  private registryPath: string;
  private profilesRoot: string;

  static getInstance(): ProfileService {
    if (!ProfileService.instance) ProfileService.instance = new ProfileService();
    return ProfileService.instance;
  }

  private constructor() {
    const userData = app.getPath('userData');
    this.registryPath = path.join(userData, 'gateway-profiles.json');
    this.profilesRoot = path.join(userData, 'profiles');
    fs.mkdirSync(this.profilesRoot, { recursive: true });
    this.registry = this.loadOrInit(userData);
  }

  private loadOrInit(userData: string): Registry {
    if (fs.existsSync(this.registryPath)) {
      try {
        const r = JSON.parse(fs.readFileSync(this.registryPath, 'utf8'));
        if (r?.version === 1 && Array.isArray(r.profiles)) return r;
      } catch { /* rebuild */ }
    }

    // Первый запуск: мигрируем существующий single-profile в default
    const legacyProfileDir = path.join(userData, 'yandex-cdp-profile');
    const legacyStorage    = path.join(userData, 'deepseek_storage.json');
    const legacyCookies    = path.join(userData, 'deepseek_cookies.json');

    const defDir = path.join(this.profilesRoot, 'default');
    fs.mkdirSync(defDir, { recursive: true });

    if (fs.existsSync(legacyProfileDir)) {
      const target = path.join(defDir, 'yandex-profile');
      if (!fs.existsSync(target)) {
        try { fs.renameSync(legacyProfileDir, target); } catch { /* already moved */ }
      }
    }
    if (fs.existsSync(legacyStorage)) {
      const target = path.join(defDir, 'storage.json');
      if (!fs.existsSync(target)) fs.copyFileSync(legacyStorage, target);
    }
    if (fs.existsSync(legacyCookies)) {
      const target = path.join(defDir, 'cookies.json');
      if (!fs.existsSync(target)) fs.copyFileSync(legacyCookies, target);
    }

    const init: Registry = {
      version: 1,
      activeId: 'default',
      profiles: [{
        id: 'default',
        name: 'Основной',
        cdpPort: DEFAULT_PORT_BASE,
        dirName: 'default',
        createdAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString(),
      }],
    };
    this.save(init);
    return init;
  }

  private save(r: Registry = this.registry): void {
    fs.writeFileSync(this.registryPath, JSON.stringify(r, null, 2));
  }

  list(): GatewayProfile[] { return this.registry.profiles.slice(); }
  getActiveId(): string { return this.registry.activeId; }
  getActive(): GatewayProfile {
    return this.registry.profiles.find(p => p.id === this.registry.activeId)
      ?? this.registry.profiles[0];
  }
  get(id: string): GatewayProfile | null {
    return this.registry.profiles.find(p => p.id === id) ?? null;
  }

  dirOf(p: GatewayProfile): string { return path.join(this.profilesRoot, p.dirName); }
  yandexProfileDir(p: GatewayProfile): string { return path.join(this.dirOf(p), 'yandex-profile'); }
  chromeProfileDir(p: GatewayProfile): string { return path.join(this.dirOf(p), 'chrome-profile'); }
  storagePath(p: GatewayProfile): string { return path.join(this.dirOf(p), 'storage.json'); }
  cookiesPath(p: GatewayProfile): string { return path.join(this.dirOf(p), 'cookies.json'); }

  /** Какой браузер реально используется (yandex по умолчанию для старых записей). */
  browserKindOf(p: GatewayProfile): 'yandex' | 'chrome' { return p.browserKind === 'chrome' ? 'chrome' : 'yandex'; }
  /** Директория user-data-dir для текущей стратегии. */
  browserProfileDir(p: GatewayProfile): string {
    return this.browserKindOf(p) === 'chrome' ? this.chromeProfileDir(p) : this.yandexProfileDir(p);
  }
  /** CDP-порт для recon-скриптов. Для chrome может отличаться от cdpPort. */
  reconCdpPort(p: GatewayProfile): number {
    return this.browserKindOf(p) === 'chrome' ? (p.chromeCdpPort ?? p.cdpPort + 100) : p.cdpPort;
  }

  /** Ключ API: сначала per-profile, потом из окружения (DEEPSEEK_API_KEY или VITE_DEEPSEEK_API_KEY). */
  apiKeyOf(p: GatewayProfile): string | null {
    if (p.apiKey && p.apiKey.startsWith('sk-')) return p.apiKey;
    const env = process.env.DEEPSEEK_API_KEY || process.env.VITE_DEEPSEEK_API_KEY;
    return env && env.startsWith('sk-') ? env : null;
  }

  hasSession(p: GatewayProfile): boolean {
    // 1. storage.json — проверяем наличие auth-cookie ds_session_id
    const s = this.storagePath(p);
    if (fs.existsSync(s)) {
      try {
        const j = JSON.parse(fs.readFileSync(s, 'utf8'));
        if (
          Array.isArray(j?.cookies) &&
          j.cookies.some((c: any) => c.name === 'ds_session_id')
        ) {
          return true;
        }
      } catch { /* ignore */ }
    }

    // 2. Yandex SQLite — проверяем auth-cookie ds_session_id, а не размер.
    // ВАЖНО: пустой Yandex-профиль тоже создаёт ~50 KB служебных cookies
    // (WAF, аналитика). Раньше sz>4096 → ложное "есть сессия".
    const yandexDir = this.yandexProfileDir(p);
    const candidates = [
      path.join(yandexDir, 'Default', 'Network', 'Cookies'),
      path.join(yandexDir, 'Default', 'Cookies'),
      path.join(yandexDir, 'Profile 1', 'Cookies'),
    ];
    const osMod = require('node:os');
    for (const c of candidates) {
      if (!fs.existsSync(c)) continue;
      const tmp = path.join(osMod.tmpdir(), `gw-hascheck-${Date.now()}.db`);
      try {
        fs.copyFileSync(c, tmp);
        for (const ext of ['-wal', '-shm']) {
          if (fs.existsSync(c + ext)) fs.copyFileSync(c + ext, tmp + ext);
        }
        const { DatabaseSync } = require('node:sqlite');
        const db = new DatabaseSync(tmp);
        try {
          const r = db
            .prepare(
              `SELECT count(*) AS c FROM cookies
               WHERE host_key LIKE '%deepseek%' AND name = 'ds_session_id'`
            )
            .get() as { c: number };
          if (r?.c > 0) return true;
        } finally {
          db.close();
        }
      } catch { /* ignore */ }
      finally {
        try { fs.unlinkSync(tmp); } catch {}
        for (const ext of ['-wal', '-shm']) {
          try { fs.unlinkSync(tmp + ext); } catch {}
        }
      }
    }
    return false;
  }

  private nextPort(): number {
    const used = new Set(this.registry.profiles.map(p => p.cdpPort));
    for (let port = DEFAULT_PORT_BASE; port < DEFAULT_PORT_BASE + PORT_SPAN; port++) {
      if (used.has(port)) continue;
      // Проверим, не занят ли порт системой (личный Yandex на 9222)
      if (this.isPortInUse(port)) {
        console.log(`[ProfileService] порт ${port} занят системой, пропускаю`);
        continue;
      }
      return port;
    }
    throw new Error(`Нет свободных CDP-портов в ${DEFAULT_PORT_BASE}..${DEFAULT_PORT_BASE + PORT_SPAN}`);
  }

  private isPortInUse(port: number): boolean {
    try {
      const { execSync } = require('node:child_process');
      execSync(`lsof -ti :${port}`, { stdio: 'ignore' });
      return true;  // lsof нашёл процесс → порт занят
    } catch {
      return false;  // lsof ничего не нашёл → порт свободен
    }
  }

  create(opts: { name: string; notes?: string; browserKind?: 'yandex' | 'chrome' }): GatewayProfile {
    const id = 'p_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
    const dir = path.join(this.profilesRoot, id);
    fs.mkdirSync(dir, { recursive: true });

    const cdpPort = this.nextPort();
    const browserKind = opts.browserKind ?? 'yandex';
    const profile: GatewayProfile = {
      id,
      name: opts.name,
      cdpPort,
      browserKind,
      ...(browserKind === 'chrome' ? { chromeCdpPort: cdpPort + 100 } : {}),
      dirName: id,
      createdAt: new Date().toISOString(),
      lastActiveAt: null,
      notes: opts.notes,
    };
    this.registry.profiles.push(profile);
    this.save();
    return profile;
  }

  update(id: string, patch: Partial<Pick<GatewayProfile, 'name' | 'notes' | 'browserKind'>>): GatewayProfile {
    const p = this.get(id);
    if (!p) throw new Error('Профиль не найден: ' + id);
    Object.assign(p, patch);
    // Авто-настройка chromeCdpPort при смене browserKind
    if (patch.browserKind === 'chrome' && !p.chromeCdpPort) {
      p.chromeCdpPort = p.cdpPort + 100;
    }
    if (patch.browserKind === 'yandex') {
      delete p.chromeCdpPort;
    }
    this.save();
    return p;
  }

  activate(id: string): GatewayProfile {
    const p = this.get(id);
    if (!p) throw new Error('Профиль не найден: ' + id);
    p.lastActiveAt = new Date().toISOString();
    this.registry.activeId = id;
    this.save();
    return p;
  }

  // ─── P0.5: rate-limit / ban ─────────────────────────────
  markRateLimited(id: string, untilMs: number | null): GatewayProfile {
    const p = this.get(id);
    if (!p) throw new Error('Профиль не найден: ' + id);
    // если until не распарсился — ставим +24ч, чтобы не циклиться
    p.rateLimitedUntil = untilMs ?? (Date.now() + 24 * 60 * 60 * 1000);
    delete p.bannedAt;
    this.save();
    console.log(`[ProfileService] markRateLimited ${id} until=${new Date(p.rateLimitedUntil).toISOString()}`);
    return p;
  }

  markBanned(id: string): GatewayProfile {
    const p = this.get(id);
    if (!p) throw new Error('Профиль не найден: ' + id);
    p.bannedAt = new Date().toISOString();
    this.save();
    console.log(`[ProfileService] markBanned ${id} at=${p.bannedAt}`);
    return p;
  }

  clearRateLimit(id: string): GatewayProfile {
    const p = this.get(id);
    if (!p) throw new Error('Профиль не найден: ' + id);
    delete p.rateLimitedUntil;
    delete p.bannedAt;
    this.save();
    return p;
  }

  isAvailable(id: string): boolean {
    const p = this.get(id);
    if (!p) return false;
    if (p.bannedAt) return false;
    if (p.rateLimitedUntil && p.rateLimitedUntil > Date.now()) return false;
    return true;
  }

  /**
   * Возвращает следующий доступный профиль (кроме excludeId и не активный).
   * null — если все в лимите/бане. НЕ циклится сам — решение за вызывающим.
   */
  getNextAvailableProfile(excludeId?: string): GatewayProfile | null {
    const now = Date.now();
    return this.registry.profiles.find(p =>
      p.id !== excludeId &&
      !p.bannedAt &&
      (!p.rateLimitedUntil || p.rateLimitedUntil <= now)
    ) ?? null;
  }

  delete(id: string, opts: { deleteFiles?: boolean } = {}): void {
    if (id === 'default') throw new Error('Профиль default удалить нельзя');
    if (id === this.registry.activeId) throw new Error('Нельзя удалить активный профиль — переключись сначала');
    const p = this.get(id);
    if (!p) return;
    this.registry.profiles = this.registry.profiles.filter(x => x.id !== id);
    this.save();
    if (opts.deleteFiles) {
      try { fs.rmSync(this.dirOf(p), { recursive: true, force: true }); } catch { /* best effort */ }
    }
  }

    // ─── Session backups ─────────────────────────────────────
  listBackups(p: GatewayProfile): Array<{
    path: string;
    filename: string;
    createdAt: string;
    sizeBytes: number;
  }> {
    const dir = this.dirOf(p);
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir)
      .filter((f) => f.startsWith('storage.json.bak-'))
      .map((f) => {
        const full = path.join(dir, f);
        const stat = fs.statSync(full);
        return {
          path: full,
          filename: f,
          createdAt: stat.mtime.toISOString(),
          sizeBytes: stat.size,
        };
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  createSessionBackup(p: GatewayProfile): { path: string; filename: string } | null {
    const storage = this.storagePath(p);
    if (!fs.existsSync(storage)) return null;
    const dir = this.dirOf(p);
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `storage.json.bak-${ts}`;
    const target = path.join(dir, filename);
    fs.copyFileSync(storage, target);
    // Оставляем не больше 10 архивов
    this.listBackups(p).slice(10).forEach((b) => {
      try { fs.unlinkSync(b.path); } catch { /* ignore */ }
    });
    return { path: target, filename };
  }

  restoreSessionBackup(p: GatewayProfile, backupPath: string): void {
    if (!fs.existsSync(backupPath)) throw new Error('Архив не найден: ' + backupPath);
    const storage = this.storagePath(p);
    fs.copyFileSync(backupPath, storage);
    console.log(`[ProfileService] восстановлен ${path.basename(backupPath)} → storage.json`);
  }

  deleteSessionBackup(backupPath: string): void {
    if (fs.existsSync(backupPath)) fs.unlinkSync(backupPath);
  }

}