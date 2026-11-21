/**
 * @name recon-gigachat-conversations
 * @purpose Разведка боковой панели GigaChat: селекторы тредов, href, title
 * @input --profile <id>
 * @output JSON в stdout (селекторы, href, title, кнопки)
 * @args --profile
 * @result структура списка чатов для getConversations
 * @exit 0
 * @tool node, patchright
 * @example node scripts/mjs/recon-gigachat-conversations.mjs --profile p_mwnqhvvi_rm0d
 */
// Разведка боковой панели GigaChat: селекторы тредов, href, title
// node scripts/recon-gigachat-conversations.mjs --profile p_mwnqhvvi_rm0d

import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { chromium } from 'patchright';

const g = (f) => { const i = process.argv.indexOf(f); return i >= 0 ? process.argv[i+1] : null; };
const pid = g('--profile') || 'p_mwnqhvvi_rm0d';

const ROOT = path.join(os.homedir(), '.config/wetothemoon-electron/profiles');
const REG  = path.join(os.homedir(), '.config/wetothemoon-electron/gateway-profiles.json');
const reg = JSON.parse(fs.readFileSync(REG, 'utf8'));
const p = reg.profiles.find(x => x.id === pid || x.name === pid || x.dirName === pid);
if (!p) { console.error('profile not found:', pid); process.exit(1); }
const userDataDir = path.join(ROOT, p.dirName, 'chrome-profile');
const port = p.chromeCdpPort || 9425;

const ctx = await chromium.launchPersistentContext(userDataDir, {
  headless: false, channel: 'chrome',
  args: [`--remote-debugging-port=${port}`],
});
const page = ctx.pages()[0] || await ctx.newPage();
await page.goto('https://giga.chat', { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForSelector('#chat-input-textarea', { timeout: 20000 });
await page.waitForTimeout(2000); // дать подгрузиться списку

const dump = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('[class*="ChatRow-styled"], [class*="ChatList-styled"] a, aside a, nav a')];
  return rows.slice(0, 20).map((el) => ({
    tag: el.tagName,
    href: el.getAttribute('href'),
    role: el.getAttribute('role'),
    title: (el.textContent || '').trim().slice(0, 80),
    cls: (el.className || '').toString().slice(0, 120),
    html: el.outerHTML.slice(0, 200),
  }));
});
console.log(JSON.stringify(dump, null, 2));

// Также — есть ли кнопка "Новый чат" / переключатель треда
const extra = await page.evaluate(() => {
  const btns = [...document.querySelectorAll('button[aria-label], [role="button"][aria-label]')];
  return btns.map((b) => ({ aria: b.getAttribute('aria-label'), cls: (b.className || '').toString().slice(0, 80) })).slice(0, 20);
});
console.log('--- buttons ---');
console.log(JSON.stringify(extra, null, 2));

await ctx.close();