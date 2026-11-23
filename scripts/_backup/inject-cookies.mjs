// scripts/inject-cookies.mjs
//
// Импортирует cookies (экспорт Cookie-Editor) в Yandex-профиль GW.
// Запускает Yandex через CDP, добавляет cookies, проверяет авторизацию,
// сохраняет storage.json и закрывает (flush в SQLite).
//
// Запуск:
//   node scripts/inject-cookies.mjs ~/acc2-cookies.json
//   PROFILE_ID=p_xxx CDP_PORT=9323 node scripts/inject-cookies.mjs ~/cookies.json

import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';

const COOKIES_JSON = process.argv[2]
  || path.join(os.homedir(), 'acc2-cookies.json');
const PROFILE_ID = process.env.PROFILE_ID || 'p_mwjb97fc_9k40';
const CDP_PORT = Number(process.env.CDP_PORT || 9323);

if (!fs.existsSync(COOKIES_JSON)) {
  console.error(`❌ Не найден JSON: ${COOKIES_JSON}`);
  process.exit(1);
}

const USER_DATA = path.join(os.homedir(), '.config/wetothemoon-electron');
const PROFILE_DIR = path.join(USER_DATA, 'profiles', PROFILE_ID);
const YANDEX_PROFILE = path.join(PROFILE_DIR, 'yandex-profile');
const STORAGE_JSON = path.join(PROFILE_DIR, 'storage.json');

if (!fs.existsSync(YANDEX_PROFILE)) {
  console.error(`❌ Не найден профиль: ${YANDEX_PROFILE}`);
  process.exit(1);
}

// 1. Парсим cookies
const raw = JSON.parse(fs.readFileSync(COOKIES_JSON, 'utf8'));
if (!Array.isArray(raw) || raw.length === 0) {
  console.error('❌ JSON должен быть массивом cookies (формат Cookie-Editor)');
  process.exit(1);
}

const cookies = raw
  .filter((c) => c && c.name && c.value !== undefined && c.domain)
  .map((c) => {
    const out = {
      name: String(c.name),
      value: String(c.value),
      domain: String(c.domain),
      path: String(c.path || '/'),
      httpOnly: !!c.httpOnly,
      secure: !!c.secure,
    };
    if (typeof c.expirationDate === 'number' && c.expirationDate > 0) {
      out.expires = Math.floor(c.expirationDate);
    }
    if (c.sameSite === 'lax') out.sameSite = 'Lax';
    else if (c.sameSite === 'strict') out.sameSite = 'Strict';
    else if (c.sameSite === 'none') out.sameSite = 'None';
    else out.sameSite = 'Lax';
    return out;
  });

console.log(`📋 Cookies для импорта: ${cookies.length}`);
for (const c of cookies) {
  console.log(`   - ${c.name} (${c.domain})`);
}

// 2. Убиваем возможный старый Yandex для этого профиля
console.log('\n🧹 Убиваю старые Yandex для профиля...');
try {
  const { execSync } = await import('node:child_process');
  execSync(`pkill -f "user-data-dir=${YANDEX_PROFILE}"`, { stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 2000));
} catch { /* ignore */ }

// 3. Запускаем Yandex через CDP
const BIN = '/usr/bin/yandex-browser-stable';
if (!fs.existsSync(BIN)) {
  console.error(`❌ Не найден Yandex: ${BIN}`);
  process.exit(1);
}

const args = [
  `--remote-debugging-port=${CDP_PORT}`,
  `--user-data-dir=${YANDEX_PROFILE}`,
  '--no-first-run',
  '--no-default-browser-check',
  '--class=gatewayyandex',
  'about:blank',
];

console.log(`\n🚀 Запуск Yandex: ${BIN} --remote-debugging-port=${CDP_PORT}`);
const child = spawn(BIN, args, { detached: true, stdio: 'ignore' });
child.unref();

// 4. Ждём CDP
console.log('⏳ Ожидание CDP...');
const waitStart = Date.now();
let cdpReady = false;
while (Date.now() - waitStart < 25000) {
  try {
    const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`, {
      signal: AbortSignal.timeout(1000),
    });
    if (res.ok) { cdpReady = true; break; }
  } catch { /* ignore */ }
  await new Promise((r) => setTimeout(r, 500));
}
if (!cdpReady) {
  console.error('❌ CDP не поднялся за 25с');
  process.exit(1);
}
console.log(`✅ CDP готов за ${Date.now() - waitStart}мс`);

// 5. Подключаемся, добавляем cookies
console.log('\n🔌 Подключение через CDP...');
const browser = await chromium.connectOverCDP(`http://127.0.0.1:${CDP_PORT}`);
const ctx = browser.contexts()[0];
console.log('   существующих contexts:', browser.contexts().length);

console.log(`\n🍪 Добавляю ${cookies.length} cookies...`);
await ctx.addCookies(cookies);
console.log('✅ Cookies добавлены');

// 6. Проверка: заходим на DeepSeek
console.log('\n🔍 Проверка авторизации...');
const page = await ctx.newPage();
try {
  await page.goto('https://chat.deepseek.com', {
    waitUntil: 'domcontentloaded',
    timeout: 20000,
  });
  await page.waitForTimeout(3000);

  const url = page.url();
  console.log(`   URL: ${url}`);

  if (url.includes('/sign_in')) {
    console.error('❌ Редирект на /sign_in — cookies не приняты');
  } else {
    // Ищем textarea ИЛИ профиль
    const authed = await page.evaluate(() => {
      return !!(
        document.querySelector('textarea[placeholder*="Сообщение"]') ||
        document.querySelector('textarea[placeholder*="Message"]') ||
        document.querySelector('div._7b40dad div._2afd28d')
      );
    });
    if (authed) {
      console.log('✅ АВТОРИЗОВАН');
    } else {
      console.error('❌ Не авторизован (textarea не найден)');
    }
  }
} catch (e) {
  console.error('❌ Ошибка проверки:', e.message);
}

// 7. Сохраняем storage.json (на случай fallback)
console.log('\n💾 Сохраняю storage.json...');
try {
  const state = await ctx.storageState();
  fs.writeFileSync(STORAGE_JSON, JSON.stringify(state, null, 2));
  console.log(`✅ storage.json: ${STORAGE_JSON} (${state.cookies?.length || 0} cookies)`);
} catch (e) {
  console.warn('⚠️ storage.json:', e.message);
}

// 8. Даём flush в SQLite и закрываем
console.log('\n⏱  Flush в SQLite (3с)...');
await new Promise((r) => setTimeout(r, 3000));

console.log('🚪 Закрываю Yandex (flush)...');
await browser.close();
await new Promise((r) => setTimeout(r, 2000));

// 9. Проверка SQLite
console.log('\n🧪 Проверка SQLite...');
const cookiePaths = [
  path.join(YANDEX_PROFILE, 'Default', 'Network', 'Cookies'),
  path.join(YANDEX_PROFILE, 'Default', 'Cookies'),
];
const cookiePath = cookiePaths.find((p) => fs.existsSync(p));
if (!cookiePath) {
  console.error('❌ SQLite Cookies не найден');
  process.exit(1);
}
console.log(`   SQLite: ${cookiePath}`);
const { DatabaseSync } = await import('node:sqlite');
const db = new DatabaseSync(cookiePath);
try {
  const r = db
    .prepare("SELECT count(*) AS c FROM cookies WHERE name = 'ds_session_id'")
    .get();
  console.log(`   ds_session_id: ${r?.c > 0 ? `✅ найден (${r.c})` : '❌ НЕТ'}`);
  if (r?.c > 0) {
    console.log('\n🎉 ГОТОВО. Переключись в GW на acc2 — авторизация мгновенная.');
  }
} finally {
  db.close();
}
