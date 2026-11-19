// src/main/services/gateway/cookieTracker.ts
//
// Снимок куки профиля для мониторинга идентификаторов провайдера.
// Источники: storage.json, cookies.json, yandex-sqlite, chrome-sqlite.
// CDP сознательно не используется: chrome-профили patchright запускает
// с --remote-debugging-pipe (порт не слушается), а yandex — без CDP.
// Значения куки НЕ храним — только sha256[:16] от `${name}=${value}`.
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export type CookieSource = 'storage-json' | 'cookies-json' | 'yandex-sqlite' | 'chrome-sqlite';

export interface CookieEntry {
  name: string;
  domain: string;
  source: CookieSource;
  valueHash: string;
  httpOnly: boolean;
  secure: boolean;
  expires?: number;
}

export interface CookieSnapshot {
  profileId: string;
  takenAt: number;
  cookies: CookieEntry[];
}

export interface CookieSourcePaths {
  profileId: string;
  storagePath?: string;
  cookiesPath?: string;
  yandexCookiesDb?: string;
  chromeCookiesDb?: string;
}

export interface TrackOpts {
  /** Подстроки доменов (lowercase). По умолчанию ['deepseek']. */
  domains?: string[];
}

export async function trackDeepSeekCookies(
  paths: CookieSourcePaths,
  opts: TrackOpts = {},
): Promise<CookieSnapshot> {
  const domains = (opts.domains ?? ['deepseek']).map(s => s.toLowerCase());
  const matches = (d: string | undefined | null) =>
    !!d && domains.some(needle => d.toLowerCase().includes(needle));

  const out: CookieEntry[] = [];
  const seen = new Set<string>();
  const push = (e: CookieEntry) => {
    const k = `${e.source}|${e.name}|${e.domain}`;
    if (seen.has(k)) return;
    seen.add(k);
    out.push(e);
  };

  // 1) storage.json
  if (paths.storagePath && fs.existsSync(paths.storagePath)) {
    try {
      const j = JSON.parse(fs.readFileSync(paths.storagePath, 'utf8'));
      for (const c of j?.cookies ?? []) {
        if (!c?.name || !matches(c.domain)) continue;
        push(toEntry(c, 'storage-json'));
      }
    } catch { /* ignore */ }
  }

  // 2) cookies.json
  if (paths.cookiesPath && fs.existsSync(paths.cookiesPath)) {
    try {
      const j = JSON.parse(fs.readFileSync(paths.cookiesPath, 'utf8'));
      const list = Array.isArray(j) ? j : (j?.cookies ?? []);
      for (const c of list) {
        if (!c?.name || !matches(c.domain)) continue;
        push(toEntry(c, 'cookies-json'));
      }
    } catch { /* ignore */ }
  }

  // 3) yandex-sqlite
  if (paths.yandexCookiesDb && fs.existsSync(paths.yandexCookiesDb)) {
    try {
      for (const r of readSqliteCookies(paths.yandexCookiesDb)) {
        if (!r?.name || !matches(r.host_key)) continue;
        push({
          name: r.name,
          domain: r.host_key,
          source: 'yandex-sqlite',
          valueHash: hashValue(r.name, r.encrypted_value || r.value || ''),
          httpOnly: !!r.is_httponly,
          secure: !!r.is_secure,
          expires: chromeTimeToMs(r.expires_utc),
        });
      }
    } catch (e) { console.warn('[cookieTracker] yandex-sqlite:', (e as Error).message); }
  }

  // 4) chrome-sqlite
  if (paths.chromeCookiesDb && fs.existsSync(paths.chromeCookiesDb)) {
    try {
      for (const r of readSqliteCookies(paths.chromeCookiesDb)) {
        if (!r?.name || !matches(r.host_key)) continue;
        push({
          name: r.name,
          domain: r.host_key,
          source: 'chrome-sqlite',
          valueHash: hashValue(r.name, r.encrypted_value || r.value || ''),
          httpOnly: !!r.is_httponly,
          secure: !!r.is_secure,
          expires: chromeTimeToMs(r.expires_utc),
        });
      }
    } catch (e) { console.warn('[cookieTracker] chrome-sqlite:', (e as Error).message); }
  }

  return { profileId: paths.profileId, takenAt: Date.now(), cookies: out };
}

export function diffSnapshots(prev: CookieSnapshot, next: CookieSnapshot): string[] {
  const lines: string[] = [];
  const keyOf = (c: CookieEntry) => `${c.source}|${c.name}|${c.domain}`;
  const prevMap = new Map(prev.cookies.map(c => [keyOf(c), c]));
  const nextMap = new Map(next.cookies.map(c => [keyOf(c), c]));

  for (const [k, c] of nextMap) {
    const p = prevMap.get(k);
    if (!p) lines.push(`+ added   ${c.source}  ${c.name} @ ${c.domain}`);
    else if (p.valueHash !== c.valueHash) lines.push(`~ changed ${c.source}  ${c.name} @ ${c.domain}`);
  }
  for (const [k, c] of prevMap) {
    if (!nextMap.has(k)) lines.push(`- removed ${c.source}  ${c.name} @ ${c.domain}`);
  }
  return lines;
}

// ─── helpers ─────────────────────────────────────────

function hashValue(name: string, value: string): string {
  return crypto.createHash('sha256').update(`${name}=${value}`).digest('hex').slice(0, 16);
}

function toEntry(c: any, source: CookieSource): CookieEntry {
  return {
    name: c.name,
    domain: c.domain ?? '',
    source,
    valueHash: hashValue(c.name, c.value ?? ''),
    httpOnly: !!c.httpOnly,
    secure: !!c.secure,
    expires: c.expirationDate ? Math.round(c.expirationDate * 1000) : c.expires,
  };
}

/**
 * Копирует файл БД (вместе с -wal/-shm) во временный и читает.
 * CAST(expires_utc AS TEXT) — обязательно: значение в микросекундах с 1601
 * не влезает в Number.MAX_SAFE_INTEGER, node:sqlite бросает RangeError.
 */
function readSqliteCookies(dbPath: string): any[] {
  const { DatabaseSync } = require('node:sqlite');
  const tmp = path.join(os.tmpdir(), `gw-probe-${process.pid}-${Date.now()}.db`);
  fs.copyFileSync(dbPath, tmp);
  for (const ext of ['-wal', '-shm']) {
    if (fs.existsSync(dbPath + ext)) fs.copyFileSync(dbPath + ext, tmp + ext);
  }
  try {
    const db = new DatabaseSync(tmp);
    try {
      return db.prepare(
        `SELECT host_key, name, value, encrypted_value,
                is_httponly, is_secure,
                CAST(expires_utc AS TEXT) AS expires_utc
         FROM cookies`
      ).all();
    } finally { db.close(); }
  } finally {
    try { fs.unlinkSync(tmp); } catch {}
    for (const ext of ['-wal', '-shm']) { try { fs.unlinkSync(tmp + ext); } catch {} }
  }
}

/**
 * Chrome epoch: микросекунды с 1601-01-01. Приходит как string (CAST).
 * Возвращает ms since Unix epoch. `0`/`null` = session cookie → undefined.
 */
function chromeTimeToMs(t: string | bigint | number | null | undefined): number | undefined {
  if (t == null || t === '' || t === 0 || t === '0') return undefined;
  let big: bigint;
  try { big = typeof t === 'bigint' ? t : BigInt(String(t)); }
  catch { return undefined; }
  if (big <= 0n) return undefined;
  return Number(big / 1000n - 11644473600000n);
}