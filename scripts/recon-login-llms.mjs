#!/usr/bin/env node
// scripts/recon-login-llms.mjs
// Recon session-провайдеров (GigaChat, Алиса AI) с ручным логином
// и персистентной сессией через профили wetothemoon (как у DeepSeek).
//
// Запуск:
//   node scripts/recon-login-llms.mjs --list
//   node scripts/recon-login-llms.mjs --provider gigachat --profile gigachat-1
//
// Логика:
//   1. Находит профиль в profilesRoot (--profiles-root или автоопределение)
//   2. launchPersistentContext(browserProfileDir) — та же папка, что у UI
//   3. Открывает URL провайдера
//   4. Если не залогинен — просит войти (Enter после логина)
//   5. Собирает selectors + cookiePatterns + признаки детекта
//   6. Пишет scripts/login-providers.json (merge по provider)

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import readline from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_PATH = path.join(__dirname, 'login-providers.json');

const PROVIDERS = {
  gigachat: {
    name: 'GigaChat',
    url: 'https://giga.chat',
    kind: 'web',
    auth: 'session',
    note: 'Сбер, вход по SberID/телефону',
    apiUrl: 'https://api.giga.chat/v1',
    apiAuth: 'key',
  },
  alisa: {
    name: 'Алиса AI',
    url: 'https://alice.yandex.ru',
    kind: 'web',
    auth: 'session',
    note: 'Яндекс, вход по Yandex ID',
    apiUrl: 'https://llm.api.cloud.yandex.net/v1',
    apiAuth: 'key',
  },
};

const PROFILES_ROOT_CANDIDATES = [
  path.join(os.homedir(), '.config/wetothemoon-electron/profiles'),
  path.join(os.homedir(), '.config/wetothemoon/profiles'),
  path.join(os.homedir(), '.config/Electron/profiles'),
  path.join(os.homedir(), '.config/wetothemoon-project/profiles'),
];

const REGISTRY_CANDIDATES = [
  'profiles.json', 'gateway-profiles.json', 'registry.json',
];

function die(msg) { console.error(`❌ ${msg}`); process.exit(1); }

function findProfilesRoot(explicit) {
  if (explicit) {
    if (!fs.existsSync(explicit)) die(`--profiles-root не найден: ${explicit}`);
    return explicit;
  }
  for (const c of PROFILES_ROOT_CANDIDATES) if (fs.existsSync(c)) return c;
  die(`profilesRoot не найден. Проверь: ls ~/.config/, затем передай --profiles-root <path>`);
}

function readRegistry(profilesRoot) {
  const parent = path.dirname(profilesRoot);
  for (const name of REGISTRY_CANDIDATES) {
    const p = path.join(parent, name);
    if (fs.existsSync(p)) {
      return { path: p, data: JSON.parse(fs.readFileSync(p, 'utf8')) };
    }
  }
  die(`registry не найден в ${parent}/. Проверь: ls ${parent}/`);
}

function findProfile(registry, wanted) {
  const ps = registry.data.profiles || [];
  return ps.find(p => p.id === wanted || p.name === wanted || p.dirName === wanted);
}

function browserProfileDir(profile, profilesRoot) {
  const kind = profile.browserKind === 'chrome' ? 'chrome' : 'yandex';
  const sub = kind === 'chrome' ? 'chrome-profile' : 'yandex-profile';
  return path.join(profilesRoot, profile.dirName, sub);
}

async function probeSelectors(page) {
  return await page.evaluate(() => {
    const q = (sel) => [...document.querySelectorAll(sel)];
    const info = (el) => ({
      tag: el.tagName.toLowerCase(),
      id: el.id || null,
      class: (el.className || '').toString().slice(0, 120) || null,
      name: el.getAttribute('name'),
      role: el.getAttribute('role'),
      ariaLabel: el.getAttribute('aria-label'),
      placeholder: el.getAttribute('placeholder'),
      dataTestId: el.getAttribute('data-testid'),
      type: el.getAttribute('type'),
      visible: !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length),
    });
    return {
      url: location.href,
      title: document.title,
      textareas: q('textarea').map(info),
      editables: q('[contenteditable="true"]').map(info),
      inputs: q('input').filter(e => e.offsetWidth).map(info),
      buttons: q('button').filter(e => {
        const t = (e.textContent || '') + (e.getAttribute('aria-label') || '');
        return /send|отправ|submit|↑|➤/i.test(t);
      }).map(info),
      streaming: q('[class*="stream"], [class*="typing"], [class*="loading"], [aria-busy="true"]').slice(0, 10).map(info),
      challenge: q('[class*="captcha"], iframe[src*="captcha"], [id*="captcha"]').map(info),
    };
  });
}

async function probeCookies(context) {
  const cookies = await context.cookies();
  return cookies.map(c => ({
    name: c.name,
    domain: c.domain,
    path: c.path,
    expires: c.expires,
    httpOnly: c.httpOnly,
    secure: c.secure,
    sameSite: c.sameSite,
    // значения НЕ сохраняем — только метаданные
  }));
}

async function detectLoginState(page) {
  return await page.evaluate(() => ({
    url: location.href,
    hasInput: !!document.querySelector('textarea, [contenteditable="true"]'),
    hasLoginForm: !!document.querySelector('input[type="tel"], input[type="password"], [class*="login"]'),
  }));
}

function mergeResult(providerKey, cfg, data) {
  let existing = { version: 1, providers: {} };
  if (fs.existsSync(OUT_PATH)) {
    try { existing = JSON.parse(fs.readFileSync(OUT_PATH, 'utf8')); } catch {}
  }
  existing.providers = existing.providers || {};
  existing.providers[providerKey] = {
    ...cfg,
    reconAt: new Date().toISOString(),
    ...data,
  };
  fs.writeFileSync(OUT_PATH, JSON.stringify(existing, null, 2));
  console.log(`💾 записано: ${OUT_PATH} [${providerKey}]`);
}

async function main() {
  const args = process.argv.slice(2);
  const get = (k) => { const i = args.indexOf(k); return i !== -1 ? args[i + 1] : null; };

  const profilesRoot = findProfilesRoot(get('--profiles-root'));
  const providerKey = get('--provider');
  const profileWanted = get('--profile');

  if (args.includes('--list')) {
    const reg = readRegistry(profilesRoot);
    console.log(`📁 profilesRoot: ${profilesRoot}`);
    console.log(`📄 registry: ${reg.path}`);
    for (const p of (reg.data.profiles || [])) {
      console.log(`  id=${p.id}\tname=${p.name}\tkind=${p.browserKind || 'yandex'}\tdir=${browserProfileDir(p, profilesRoot)}`);
    }
    return;
  }

  if (!providerKey || !PROVIDERS[providerKey]) die(`--provider: ${Object.keys(PROVIDERS).join('|')}`);
  if (!profileWanted) die('--profile обязателен (id/name/dirName)');

  const cfg = PROVIDERS[providerKey];
  const reg = readRegistry(profilesRoot);
  const profile = findProfile(reg, profileWanted);
  if (!profile) die(`Профиль не найден: ${profileWanted}. Запусти --list`);

  const profileDir = browserProfileDir(profile, profilesRoot);
  if (!fs.existsSync(profileDir)) die(`Папка профиля не существует: ${profileDir}. Открой профиль в UI хотя бы раз.`);

  try {
    const pids = execSync(`pgrep -f "user-data-dir=${profileDir}"`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    if (pids) die(`Chrome уже запущен с этим профилем (pid=${pids.split('\n').join(',')}). Закрой UI-браузер и повтори.`);
  } catch { /* pgrep exit 1 = не запущен, ок */ }

  console.log(`🚀 ${cfg.name} → ${cfg.url}`);
  console.log(`   profile: ${profile.id} (${profile.browserKind || 'yandex'})`);
  console.log(`   dir:     ${profileDir}`);

  const pw = await import('patchright');
  const chromium = pw.chromium || pw.default?.chromium;
  if (!chromium) die('patchright: chromium не найден');

  const opts = { headless: false };
  if ((profile.browserKind || 'yandex') === 'chrome') opts.channel = 'chrome';

  const context = await chromium.launchPersistentContext(profileDir, opts);

  try {
    const page = context.pages()[0] || (await context.newPage());
    await page.goto(cfg.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(3000);

    let state = await detectLoginState(page);
    console.log(`   состояние: ${JSON.stringify(state)}`);

    if (!state.hasInput) {
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      await rl.question('👉 Войди в аккаунт, дождись поля ввода в чате, нажми Enter...');
      await rl.close();
      await page.goto(cfg.url, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(3000);
      state = await detectLoginState(page);
      if (!state.hasInput) die('После логина поле ввода не найдено. Проверь URL/селекторы вручную.');
    }

    console.log('\n📋 selectors (до отправки):');
    const selectors = await probeSelectors(page);
    console.log(JSON.stringify(selectors, null, 2));

    const cookiesBefore = await probeCookies(context);
    console.log(`\n🍪 cookies до отправки: ${cookiesBefore.length}`);

    const rl2 = readline.createInterface({ input: process.stdin, output: process.stdout });
    await rl2.question('\n👉 Отправь тестовое сообщение в чат, дождись ответа, нажми Enter для финального снимка...');
    await rl2.close();

    const afterSend = await probeSelectors(page);
    const cookiesAfter = await probeCookies(context);

    mergeResult(providerKey, cfg, {
      selectorsBefore: selectors,
      selectorsAfterSend: afterSend,
      cookiePatterns: cookiesAfter,
      cookieCountBefore: cookiesBefore.length,
      cookieCountAfter: cookiesAfter.length,
      loginStateBefore: state,
    });
  } finally {
    await context.close();
  }
}

main().catch(e => die(e.stack || String(e)));