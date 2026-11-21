#!/usr/bin/env node
// Одноразовый тест GigaChatAdapter: fill → click/Enter → стрим ответа.
// node scripts/recon-gigachat-adapter-test.mjs --profile p_mwnqhvvi_rm0d
/**
 * @name recon-gigachat-adapter-test
 * @purpose Smoke-тест GigaChatAdapter: fill → click/Enter → стрим ответа (с проверкой reset)
 * @input --profile <id> (по умолчанию p_mwnqhvvi_rm0d), --text <string> (по умолчанию 'ping')
 * @output dumps/gigachat-adapter-test-<timestamp>/{final.html,reply.txt}, лог в stdout
 * @args --profile, --text
 * @result reply.txt с финальным ответом, exit 0
 * @exit 0 — успех, 1 — ошибка
 * @tool node, patchright
 * @example node scripts/mjs/recon-gigachat-adapter-test.mjs --profile p_mwnqhvvi_rm0d --text "ping"
 */

import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { chromium } from 'patchright';

const g = (f) => { const i = process.argv.indexOf(f); return i >= 0 ? process.argv[i+1] : null; };
const pid = g('--profile') || 'p_mwnqhvvi_rm0d';
const text = g('--text') || 'ping';

const ROOT = path.join(os.homedir(), '.config/wetothemoon-electron/profiles');
const REG  = path.join(os.homedir(), '.config/wetothemoon-electron/gateway-profiles.json');
const reg = JSON.parse(fs.readFileSync(REG, 'utf8'));
const p = reg.profiles.find(x => x.id === pid || x.name === pid || x.dirName === pid);
if (!p) { console.error('profile not found:', pid); process.exit(1); }
const kind = p.browserKind === 'chrome' ? 'chrome' : 'yandex';
const userDataDir = path.join(ROOT, p.dirName, kind === 'chrome' ? 'chrome-profile' : 'yandex-profile');
const port = p.chromeCdpPort || p.cdpPort || 9425;

const ctx = await chromium.launchPersistentContext(userDataDir, {
  headless: false, channel: 'chrome',
  args: [`--remote-debugging-port=${port}`],
});
const page = ctx.pages()[0] || await ctx.newPage();
await page.goto('https://giga.chat', { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForSelector('#chat-input-textarea', { timeout: 20000 });
console.log('✓ textarea, sending:', JSON.stringify(text));

const SEL = {
  input: '#chat-input-textarea',
  send: 'button[aria-label="Отправить"]',
  response: '[class*="MessageItem-styled__AssistantContent"]',
};

const before = await page.$$eval(SEL.response, els => els.length);
await page.fill(SEL.input, text);

let via = '';
try {
  await page.waitForSelector(SEL.send, { timeout: 3000, state: 'visible' });
  await page.click(SEL.send);
  via = 'click';
} catch {
  await page.focus(SEL.input);
  await page.press(SEL.input, 'Enter');
  via = 'Enter';
}
console.log('sent via', via);

let last = '', stable = 0;
const t0 = Date.now();
let firstChunkAt = 0;
while (Date.now() - t0 < 120000) {
  await page.waitForTimeout(300);
  const s = await page.evaluate(sel => {
    const els = [...document.querySelectorAll(sel)];
    const last = els[els.length - 1];
    return { c: els.length, t: last ? (last.textContent || '') : '' };
  }, SEL.response);

  if (s.c > before && s.t !== last) {
    if (!firstChunkAt) { firstChunkAt = Date.now() - t0; console.log('\n[first chunk at +' + firstChunkAt + 'ms]'); }
    if (s.t.startsWith('Думаю над ответом')) { last = s.t; stable = 0; continue; }
    const isAppend = last && s.t.startsWith(last);
    if (isAppend) {
      const d = s.t.slice(last.length);
      if (d) process.stdout.write(d);
    } else {
      // reset
      if (last) console.log('\n[RESET]');
      process.stdout.write(s.t);
    }
    last = s.t;
    stable = 0;
  } else if (last && !last.startsWith('Думаю над ответом')) {
    stable++;
    if (stable >= 10) { console.log('\n[done at +' + (Date.now() - t0) + 'ms, len=' + last.length + ']'); break; }
  }
}

const html = await page.content();
const outDir = path.join('scripts', 'dumps', `gigachat-adapter-test-${new Date().toISOString().replace(/[:.]/g,'-')}`);
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'final.html'), html);
fs.writeFileSync(path.join(outDir, 'reply.txt'), last);
console.log('reply saved:', outDir);
await ctx.close();
