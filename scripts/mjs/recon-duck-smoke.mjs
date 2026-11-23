#!/usr/bin/env node
/**
 * @name recon-duck-smoke
 * @purpose Smoke-test patchright + duck.ai: запуск Chrome, dump interactive elements, попытка отправки "hello"
 * @input argv: [--headless]
 * @output recon-output/duck-smoke-<ts>.json + скриншоты duck-{initial,after}-<ts>.png
 * @args { "type": "object", "properties": { "headless": { "type": "boolean", "default": false } } }
 * @result null
 * @exit 0 — успех
 * @exit 1 — patchright не найден / FATAL
 * @tool false
 * @example node scripts/mjs/recon-duck-smoke.mjs --headless
 *
 * recon-duck-smoke.mjs — smoke test: patchright + duck.ai.
 *
 * Цель: проверить, что patchright работает с чужим провайдером (не DeepSeek),
 * найти селекторы (input, send, response) для Duck.ai.
 *
 * Запуск:
 *   node scripts/recon-duck-smoke.mjs
 *   node scripts/recon-duck-smoke.mjs --headless
 *
 * Что делает:
 * 1. Запускает Chrome через patchright
 * 2. Открывает https://duck.ai
 * 3. Дамп всех interactive элементов (input, textarea, contenteditable, button)
 * 4. Скриншот
 * 5. Пытается отправить "hello" и получить ответ
 * 6. Пишет результат в scripts/dumps/duck-smoke-<ts>.json
 *
 * ВАЖНО: не логинится. Duck.ai работает без логина (200 в recon).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const DUMPS = path.join(ROOT, 'recon-output');
fs.mkdirSync(DUMPS, { recursive: true });

const ts = new Date().toISOString().replace(/[:.]/g, '-');
const headless = process.argv.includes('--headless');

async function loadPatchright() {
  for (const mod of ['patchright', 'patchright-core', 'playwright']) {
    try {
      const m = await import(mod);
      if (m.chromium) return { chromium: m.chromium, mod };
    } catch { /* try next */ }
  }
  throw new Error('patchright/playwright не найден. Установи: npm i -D patchright');
}

async function main() {
  const { chromium, mod } = await loadPatchright();
  console.log(`[duck-smoke] patchright из: ${mod}`);
  console.log(`[duck-smoke] headless=${headless}`);

  const browser = await chromium.launch({
    headless,
    channel: 'chrome',  // ← системный Chrome, не Chromium
    args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'],
  });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    userAgent:
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  console.log('[duck-smoke] goto https://duck.ai');
  await page.goto('https://duck.ai', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3000);

  const shot1 = path.join(DUMPS, `duck-initial-${ts}.png`);
  await page.screenshot({ path: shot1, fullPage: false });
  console.log(`[duck-smoke] скриншот: ${shot1}`);

  const probes = await page.evaluate(() => {
    const vis = (el) => el.offsetParent !== null || el.getClientRects().length > 0;
    const pick = (el) => ({
      tag: el.tagName,
      type: el.type || null,
      id: el.id || null,
      name: el.name || null,
      placeholder: el.placeholder || null,
      aria: el.getAttribute('aria-label') || null,
      role: el.getAttribute('role') || null,
      classes: el.className ? String(el.className).slice(0, 100) : null,
      text: el.textContent ? el.textContent.trim().slice(0, 40) : null,
      visible: vis(el),
    });
    const out = { inputs: [], textareas: [], contenteditables: [], buttons: [], title: document.title };
    document.querySelectorAll('input').forEach((el) => out.inputs.push(pick(el)));
    document.querySelectorAll('textarea').forEach((el) => out.textareas.push(pick(el)));
    document.querySelectorAll('[contenteditable="true"]').forEach((el) => out.contenteditables.push(pick(el)));
    document.querySelectorAll('button').forEach((el) => out.buttons.push(pick(el)));
    return out;
  });

  console.log('[duck-smoke] title:', probes.title);
  console.log('[duck-smoke] inputs:', probes.inputs.filter((x) => x.visible).length, '/', probes.inputs.length);
  console.log('[duck-smoke] textareas:', probes.textareas.filter((x) => x.visible).length, '/', probes.textareas.length);
  console.log('[duck-smoke] contenteditables:', probes.contenteditables.filter((x) => x.visible).length);
  console.log('[duck-smoke] buttons:', probes.buttons.filter((x) => x.visible).length, '/', probes.buttons.length);

  let sent = false;
  let responseText = null;
  let error = null;

  try {
    let inputEl = null;
    let inputKind = null;

    if (probes.contenteditables.some((x) => x.visible)) {
      inputEl = await page.$('[contenteditable="true"]');
      inputKind = 'contenteditable';
    } else if (probes.textareas.some((x) => x.visible)) {
      inputEl = await page.$('textarea');
      inputKind = 'textarea';
    } else if (probes.inputs.some((x) => x.visible && (x.type === 'text' || x.type === 'search'))) {
      inputEl = await page.$('input[type="text"], input[type="search"]');
      inputKind = 'input';
    }

    if (inputEl) {
      console.log(`[duck-smoke] input найден: ${inputKind}`);
      await inputEl.click();
      await page.keyboard.type('hello', { delay: 50 });
      await page.waitForTimeout(500);
      await page.keyboard.press('Enter');
      console.log('[duck-smoke] отправили "hello" (Enter)');
      sent = true;

      const start = Date.now();
      while (Date.now() - start < 30000) {
        await page.waitForTimeout(2000);
        const text = await page.evaluate(() => {
          const candidates = Array.from(document.querySelectorAll('div, p, article, section'));
          const longs = candidates
            .map((el) => ({
              text: (el.textContent || '').trim(),
              len: (el.textContent || '').trim().length,
              tag: el.tagName,
              cls: String(el.className).slice(0, 60),
            }))
            .filter((x) => x.len > 20 && x.len < 5000);
          if (longs.length === 0) return null;
          longs.sort((a, b) => b.len - a.len);
          return longs[0];
        });
        if (text && text.len > 20) {
          responseText = text;
          console.log(`[duck-smoke] ответ получен (${text.len} символов)`);
          break;
        }
      }
      if (!responseText) console.warn('[duck-smoke] ответ не получен за 30 сек');
    } else {
      console.warn('[duck-smoke] input не найден — дамп в JSON');
    }
  } catch (e) {
    error = e.message;
    console.error('[duck-smoke] ошибка:', error);
  }

  const shot2 = path.join(DUMPS, `duck-after-${ts}.png`);
  await page.screenshot({ path: shot2, fullPage: false });
  console.log(`[duck-smoke] скриншот: ${shot2}`);

  const result = {
    ts,
    url: page.url(),
    title: probes.title,
    headless,
    patchrightModule: mod,
    probes,
    sent,
    responseText,
    error,
    screenshots: { initial: shot1, after: shot2 },
  };

  const outPath = path.join(DUMPS, `duck-smoke-${ts}.json`);
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2), 'utf8');
  console.log(`[duck-smoke] результат: ${outPath}`);

  await context.close();
  await browser.close();
}

main().catch((e) => {
  console.error('[duck-smoke] FATAL:', e);
  process.exit(1);
});
