// scripts/mjs/inject-cookies-patchright.mjs
/**
 * @name inject-cookies-patchright
 * @purpose Импорт cookies (Cookie-Editor JSON) в Chrome-профиль через patchright + проверка сессии на chat.deepseek.com
 * @input argv[2]=path к JSON cookies (default ~/acc2-cookies.json); env: PROFILE_ID (default p_mwk7xx3i_nb4l), CDP_DEBUG (0|1)
 * @output storage.json профиля; recon-output/inject-chrome-<ts>.png; stdout: PROBE JSON
 * @args { "type": "object", "properties": { "cookiesJson": { "type": "string" } } }
 * @result null
 * @exit 0 — успех
 * @exit 1 — нет JSON / не массив cookies / сессия не принята
 * @tool false
 * @example node scripts/mjs/inject-cookies-patchright.mjs ~/acc2-cookies.json
 */
import { chromium } from 'patchright';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../..');

const COOKIES_JSON = process.argv[2] || path.join(os.homedir(), 'acc2-cookies.json');
const PROFILE_ID   = process.env.PROFILE_ID || 'p_mwk7xx3i_nb4l';
const DEBUG_CDP    = process.env.CDP_DEBUG === '1';

if (!fs.existsSync(COOKIES_JSON)) { console.error('❌ Не найден JSON: ' + COOKIES_JSON); process.exit(1); }

const USER_DATA   = path.join(os.homedir(), '.config/wetothemoon-electron');
const profileDir  = path.join(USER_DATA, 'profiles', PROFILE_ID, 'chrome-profile');
const storageJson = path.join(USER_DATA, 'profiles', PROFILE_ID, 'storage.json');
fs.mkdirSync(profileDir, { recursive: true });

const raw = JSON.parse(fs.readFileSync(COOKIES_JSON, 'utf8'));
if (!Array.isArray(raw) || raw.length === 0) { console.error('❌ JSON должен быть массивом cookies'); process.exit(1); }

const cookies = raw.filter(c => c && c.name && c.value !== undefined && c.domain).map(c => {
  const out = {
    name: String(c.name), value: String(c.value), domain: String(c.domain),
    path: String(c.path || '/'), httpOnly: !!c.httpOnly, secure: !!c.secure,
  };
  if (typeof c.expirationDate === 'number' && c.expirationDate > 0) out.expires = Math.floor(c.expirationDate);
  if (c.sameSite === 'strict') out.sameSite = 'Strict';
  else if (c.sameSite === 'none') out.sameSite = 'None';
  else out.sameSite = 'Lax';
  return out;
});
console.log('📋 cookies: ' + cookies.length);
for (const c of cookies) console.log('   - ' + c.name + ' (' + c.domain + ')');

const args = ['--no-first-run', '--no-default-browser-check', '--disable-gpu'];
if (DEBUG_CDP) args.push('--remote-debugging-port=9333');

console.log('\n🚀 patchright + chrome, profile: ' + profileDir);
const ctx = await chromium.launchPersistentContext(profileDir, {
  channel: 'chrome', headless: false, viewport: null,
  locale: 'ru-RU', timezoneId: 'Europe/Moscow', args,
});

try {
  console.log('\n🍪 addCookies(' + cookies.length + ')...');
  await ctx.addCookies(cookies);
  console.log('✅ cookies добавлены');

  console.log('\n🔍 проверка chat.deepseek.com...');
  const page = ctx.pages()[0] ?? await ctx.newPage();
  await page.goto('https://chat.deepseek.com', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(4000);

  const probe = await page.evaluate(() => ({
    url: location.href,
    webdriver: navigator.webdriver,
    cdcKeys: Object.keys(window).filter(k => /cdc_|__nightmare|_phantom|_selenium|_playwright/i.test(k)),
    textarea: !!document.querySelector('textarea[placeholder*="Сообщение"], textarea[placeholder*="Message"]'),
    profileTrigger: !!document.querySelector('div._7b40dad div._2afd28d'),
    signIn: location.href.includes('/sign_in'),
    bodySnippet: (document.body.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 300),
  }));
  console.log('   PROBE:', JSON.stringify(probe, null, 2));

  const state = await ctx.storageState();
  fs.writeFileSync(storageJson, JSON.stringify(state, null, 2));
  console.log('\n💾 storage.json: ' + storageJson + '  (cookies: ' + (state.cookies?.length || 0) + ')');

  const shot = path.join(ROOT, 'recon-output', 'inject-chrome-' + Date.now() + '.png');
  fs.mkdirSync(path.dirname(shot), { recursive: true });
  await page.screenshot({ path: shot });
  console.log('📸 ' + shot);

  if (probe.textarea || probe.profileTrigger) console.log('\n🎉 ГОТОВО: сессия принята в Chrome-профиле.');
  else if (probe.signIn) console.log('\n❌ Редирект на /sign_in — cookies не приняты.');
  else console.log('\n⚠️  Ни textarea, ни profileTrigger, ни /sign_in — смотри bodySnippet/скриншот.');
} finally {
  await ctx.close();
  console.log('🚪 контекст закрыт');
}
