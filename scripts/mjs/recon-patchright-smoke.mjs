// scripts/mjs/recon-patchright-smoke.mjs
/**
 * @name recon-patchright-smoke
 * @purpose Smoke patchright + Chrome: запуск профиля, заход на chat.deepseek.com, PROBE stealth (webdriver, cdc keys, textarea, profileTrigger, /sign_in)
 * @input env: PROFILE_ID (default "default")
 * @output recon-output/patchright-smoke-<ts>.png; stdout: PROBE JSON
 * @args null
 * @result null
 * @exit 0 — успех
 * @exit 1 — patchright / профиль не запущен
 * @tool false
 * @example PROFILE_ID=p_mwnqhvvi_rm0d node scripts/mjs/recon-patchright-smoke.mjs
 */
import { chromium } from 'patchright';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../..');

const PROFILE_ID = process.env.PROFILE_ID || 'default';
const USER_DATA  = path.join(os.homedir(), '.config/wetothemoon-electron');
const profileDir = path.join(USER_DATA, 'profiles', PROFILE_ID, 'chrome-profile');
fs.mkdirSync(profileDir, { recursive: true });

console.log('📂 profile: ' + profileDir);

const ctx = await chromium.launchPersistentContext(profileDir, {
  channel: 'chrome', headless: false, viewport: null,
  locale: 'ru-RU', timezoneId: 'Europe/Moscow',
  args: ['--no-first-run', '--no-default-browser-check', '--disable-gpu'],
});

const page = ctx.pages()[0] ?? await ctx.newPage();
await page.goto('https://chat.deepseek.com', { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForTimeout(4000);

const probe = await page.evaluate(() => ({
  url: location.href,
  ua: navigator.userAgent,
  webdriver: navigator.webdriver,
  languages: navigator.languages,
  plugins: navigator.plugins.length,
  hasChromeRuntime: typeof window.chrome !== 'undefined',
  cdcKeys: Object.keys(window).filter(k => /cdc_|__nightmare|_phantom|_selenium|_playwright/i.test(k)),
  textarea: !!document.querySelector('textarea[placeholder*="Сообщение"], textarea[placeholder*="Message"]'),
  profileTrigger: !!document.querySelector('div._7b40dad div._2afd28d'),
  signIn: location.href.includes('/sign_in'),
  bodySnippet: (document.body.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 300),
}));

console.log('\n=== PROBE ===');
console.log(JSON.stringify(probe, null, 2));

const shotsDir = path.join(ROOT, 'recon-output');
fs.mkdirSync(shotsDir, { recursive: true });
const shot = path.join(shotsDir, 'patchright-smoke-' + Date.now() + '.png');
await page.screenshot({ path: shot });
console.log('\n📸 ' + shot);

await ctx.close();
console.log('✅ done');
