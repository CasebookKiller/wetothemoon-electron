#!/usr/bin/env node
// scripts/mjs/recon-gigachat-send.mjs
/**
 * @name recon-gigachat-send
 * @purpose Разведка отправки в GigaChat: ввод в textarea, поиск send-кнопки (по diff до/после fill), Enter, 30-сек серия снапшотов
 * @input argv: --profile <id|name|dirName> (обязателен); env: gateway-profiles.json в ~/.config/wetothemoon-electron/
 * @output recon-output/gigachat-send-<ts>/{buttons-state.json, final.html, snapshots.json, messages.json}
 * @args { "type": "object", "properties": { "profile": { "type": "string" } }, "required": ["profile"] }
 * @result null
 * @exit 0 — успех
 * @exit 1 — нет --profile / профиля / userDataDir / textarea не найден
 * @tool false
 * @example node scripts/mjs/recon-gigachat-send.mjs --profile p_mwnqhvvi_rm0d
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { chromium } from 'patchright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const PROFILES_ROOT = path.join(os.homedir(), '.config/wetothemoon-electron/profiles');
const REGISTRY = path.join(os.homedir(), '.config/wetothemoon-electron/gateway-profiles.json');

function die(m) { console.error('❌ ' + m); process.exit(1); }
function g(flag) { const i = process.argv.indexOf(flag); return i >= 0 ? process.argv[i + 1] : null; }

const SNAP = (els) => els.map(el => ({
  tag: el.tagName,
  id: el.id || null,
  aria: el.getAttribute('aria-label'),
  title: el.getAttribute('title'),
  type: el.getAttribute('type'),
  role: el.getAttribute('role'),
  dataTestId: el.getAttribute('data-testid'),
  class: (el.className || '').toString().slice(0, 100),
  hasSvg: !!el.querySelector('svg'),
  disabled: el.disabled === true,
  visible: !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length),
}));

async function main() {
  const wanted = g('--profile');
  if (!wanted) die('--profile required');
  const reg = JSON.parse(fs.readFileSync(REGISTRY, 'utf8'));
  const p = (reg.profiles || []).find(x => x.id === wanted || x.name === wanted || x.dirName === wanted);
  if (!p) die('profile not found: ' + wanted);
  const kind = p.browserKind === 'chrome' ? 'chrome' : 'yandex';
  const userDataDir = path.join(PROFILES_ROOT, p.dirName, kind === 'chrome' ? 'chrome-profile' : 'yandex-profile');
  if (!fs.existsSync(userDataDir)) die('no userDataDir: ' + userDataDir);
  const port = p.chromeCdpPort || p.cdpPort || 9425;
  const outDir = path.join(ROOT, 'recon-output', `gigachat-send-${new Date().toISOString().replace(/[:.]/g, '-')}`);
  fs.mkdirSync(outDir, { recursive: true });
  console.log('📁', outDir);

  const ctx = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    channel: 'chrome',
    args: [`--remote-debugging-port=${port}`],
  });
  const page = ctx.pages()[0] || await ctx.newPage();
  await page.goto('https://giga.chat', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('#chat-input-textarea', { timeout: 20000 });
  console.log('✓ textarea найден');

  const buttonsBefore = await page.$$eval('button, [role="button"]', SNAP);
  console.log('buttons before:', buttonsBefore.length);

  await page.fill('#chat-input-textarea', 'ping');
  await page.waitForTimeout(500);

  const buttonsAfterFill = await page.$$eval('button, [role="button"]', SNAP);
  console.log('buttons after fill:', buttonsAfterFill.length);

  const key = (b) => `${b.tag}|${b.id || ''}|${b.aria || ''}|${b.role || ''}|${b.class}`;
  const beforeKeys = new Set(buttonsBefore.map(key));
  const newButtons = buttonsAfterFill.filter(b => !beforeKeys.has(key(b)));
  console.log('NEW buttons after fill:', JSON.stringify(newButtons, null, 2));

  // также — search для кнопки внутри/рядом с textarea
  const nearInput = await page.evaluate(() => {
    const ta = document.querySelector('#chat-input-textarea');
    if (!ta) return null;
    let n = ta.parentElement;
    const chain = [];
    for (let i = 0; i < 6 && n; i++) { chain.push({ tag: n.tagName, class: (n.className || '').toString().slice(0, 80) }); n = n.parentElement; }
    const scope = ta.closest('form, [class*="ChatInput"], [class*="chat-input"], [class*="InputArea"]') || ta.parentElement;
    const candidates = scope ? [...scope.querySelectorAll('button, [role="button"]')].map(el => ({
      tag: el.tagName, aria: el.getAttribute('aria-label'), type: el.getAttribute('type'),
      dataTestId: el.getAttribute('data-testid'), class: (el.className || '').toString().slice(0, 100),
      hasSvg: !!el.querySelector('svg'), disabled: el.disabled === true,
    })) : [];
    return { chain, candidates };
  });
  console.log('nearInput:', JSON.stringify(nearInput, null, 2));

  fs.writeFileSync(path.join(outDir, 'buttons-state.json'), JSON.stringify({ before: buttonsBefore, afterFill: buttonsAfterFill, newButtons, nearInput }, null, 2));

  // Enter to send
  await page.focus('#chat-input-textarea');
  await page.press('#chat-input-textarea', 'Enter');
  console.log('↵ Enter pressed at t=0');

  const snapshots = [];
  let lastSig = '';
  const t0 = Date.now();
  while (Date.now() - t0 < 30000) {
    await page.waitForTimeout(500);
    const info = await page.evaluate(() => {
      const ta = document.querySelector('#chat-input-textarea');
      return {
        htmlLen: document.body.innerHTML.length,
        textLen: (document.body.textContent || '').length,
        textareaValue: ta ? ta.value : null,
        nodeCount: document.querySelectorAll('*').length,
      };
    });
    const sig = `${info.htmlLen}|${info.textLen}|${info.textareaValue}|${info.nodeCount}`;
    if (sig !== lastSig) {
      lastSig = sig;
      const t = Date.now() - t0;
      snapshots.push({ t, ...info });
      console.log(`  t+${t}ms`, info);
    }
  }

  const html = await page.content();
  fs.writeFileSync(path.join(outDir, 'final.html'), html);
  fs.writeFileSync(path.join(outDir, 'snapshots.json'), JSON.stringify(snapshots, null, 2));

  // эвристика: есть ли новые "сообщения"
  const messages = await page.evaluate(() => {
    const sels = ['[data-message-author-role]', '[class*="Message"]', '[class*="message"]', '[class*="Bubble"]', '[class*="bubble"]'];
    const found = {};
    for (const s of sels) found[s] = document.querySelectorAll(s).length;
    return found;
  });
  console.log('message-like counts:', JSON.stringify(messages));
  fs.writeFileSync(path.join(outDir, 'messages.json'), JSON.stringify(messages, null, 2));

  console.log('✅ done, snapshots:', snapshots.length);
  await ctx.close();
}

main().catch(e => { console.error(e); process.exit(1); });
