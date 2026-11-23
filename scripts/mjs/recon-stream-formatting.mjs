// scripts/mjs/recon-stream-formatting.mjs  (v6)
/**
 * @name recon-stream-formatting
 * @purpose Захват серии снапшотов стримингового ответа DeepSeek (answer vs reasoning) для последующего md-compare / compare-stream-formatting
 * @input CDP_PORT (default 9324), PROMPT (default — структурированный hello world); вкладка chat.deepseek.com (пустой чат предпочтителен)
 * @output ROOT/captures/<ts>/{prompt.txt, answer-NNN-<ms>.html, final.html, page-full.html, index.json}
 * @args null
 * @result null
 * @exit 0 — успех
 * @exit 1 — нет вкладки / textarea пуст после fill / ответ не начался / final.html не снят
 * @tool false
 * @example CDP_PORT=9324 node scripts/mjs/recon-stream-formatting.mjs
 *
 * NOTE: использует import из 'playwright' (не playwright-core). Если пакет не установлен — pre-existing баг.
 */
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../..');

const CDP_PORT = Number(process.env.CDP_PORT ?? 9324);
const PROMPT   = process.env.PROMPT
  ?? 'Напиши hello world на TypeScript. Структура ответа строго такая:\n1. Заголовок ## Hello World\n2. Один абзац с inline `console.log` и упоминанием `tsc`.\n3. Блок ```typescript``` с функцией hello() и одним комментарием.\n4. Маркированный список из 3 пунктов.\nКоротко.';

const POLL_MS          = 100;
const START_TIMEOUT_MS = 60_000;
const STABLE_MS        = 2_000;
const STOP_SEL = '[data-testid="stop-button"], button[aria-label*="Stop" i], button[aria-label*="Остановить" i]';

// Селекторы ответа — от самого точного к самому общему
// Только ANSWER-селекторы. Reasoning (.ds-markdown без этих классов) НЕ ловим.
const ANSWER_SELECTORS = [
  '.ds-assistant-message-main-content',
  '.ds-markdown--block',
  '[class*="assistant-message"] .ds-markdown',
];

const STAMP   = new Date().toISOString().replace(/[:.]/g, '-');
const OUT_DIR = path.join(ROOT, 'captures', STAMP);
await fs.mkdir(OUT_DIR, { recursive: true });
await fs.writeFile(path.join(OUT_DIR, 'prompt.txt'), PROMPT, 'utf8');

const browser = await chromium.connectOverCDP(`http://127.0.0.1:${CDP_PORT}`);
const ctx     = browser.contexts()[0];

const pages = ctx.pages();
console.log(`\nТабы (${pages.length}):`);
pages.forEach((p, i) => console.log(`  ${i}. ${p.url()}`));

const isEmptyUrl = (url) => { try { const u = new URL(url); return u.host === 'chat.deepseek.com' && (u.pathname === '/' || u.pathname === ''); } catch { return false; } };
const emptyTab   = pages.find(p => isEmptyUrl(p.url()));
const anyChatTab = pages.find(p => p.url().includes('chat.deepseek.com'));
const page = emptyTab ?? anyChatTab ?? pages[0];
if (!page) throw new Error('Нет вкладок');
console.log(`\n→ работаю с: ${page.url()}${emptyTab ? ' (пустая ✓)' : ' (⚠ пустой вкладки нет)'}`);
await page.bringToFront();
await page.waitForTimeout(300);

// Диагностика: какие селекторы реально есть на странице
async function diagnoseSelectors() {
  return await page.evaluate((sels) => {
    const out = {};
    for (const s of sels) {
      try { out[s] = document.querySelectorAll(s).length; } catch { out[s] = 'ERR'; }
    }
    return out;
  }, ANSWER_SELECTORS);
}

async function grabAnswer() {
  for (const sel of ANSWER_SELECTORS) {
    const html = await page.evaluate((s) => {
      const nodes = document.querySelectorAll(s);
      return nodes.length ? nodes[nodes.length - 1].outerHTML : null;
    }, sel).catch(() => null);
    if (html && html.length > 50) return { html, selector: sel };
  }
  return null;
}

async function countAnswers() {
  let max = 0;
  for (const sel of ANSWER_SELECTORS) {
    const n = await page.evaluate((s) => document.querySelectorAll(s).length, sel).catch(() => 0);
    if (n > max) max = n;
  }
  return max;
}

const hasStop = () => page.evaluate(sel => Boolean(document.querySelector(sel)), STOP_SEL);
const getTaValue = () => page.evaluate(() => document.querySelector('textarea[name="search"]')?.value ?? null);

console.log('\nСелекторы до отправки:');
console.log(await diagnoseSelectors());

// --- отправка
const ta = page.locator('textarea[name="search"]').first();
await ta.click();
await ta.fill(PROMPT);
await page.waitForTimeout(300);
const taVal = await getTaValue();
if (!taVal || taVal.length < 10) {
  await fs.writeFile(path.join(OUT_DIR, 'page-full.html'), await page.content(), 'utf8');
  throw new Error(`textarea пуст после fill (len=${taVal?.length})`);
}
console.log(`textarea содержит ${taVal.length} симв. ✓`);

const beforeCount = await countAnswers();
console.log(`beforeCount = ${beforeCount}. Отправляю Enter…`);
await page.keyboard.press('Enter');

// Проверка отправки
await page.waitForTimeout(1500);
const taAfter = await getTaValue();
if (taAfter && taAfter.length > 10) {
  throw new Error(`Сообщение не отправляется (textarea ${taAfter.length} симв.)`);
}
console.log('Сообщение отправлено ✓');

// --- ждём старта
const t0 = Date.now();
let started = false;
while (Date.now() - t0 < START_TIMEOUT_MS) {
  await page.waitForTimeout(200);
  if (await hasStop() || (await countAnswers()) > beforeCount) { started = true; break; }
}
if (!started) {
  await fs.writeFile(path.join(OUT_DIR, 'page-full.html'), await page.content(), 'utf8');
  console.error(`\n❌ Ответ не появился за ${START_TIMEOUT_MS} мс.`);
  console.error('Селекторы ПОСЛЕ отправки:');
  console.error(await diagnoseSelectors());
  console.error(`beforeCount=${beforeCount}, now=${await countAnswers()}`);
  console.error(`См. ${OUT_DIR}/page-full.html`);
  await browser.close();
  process.exit(1);
}
const firstGrab = await grabAnswer();
console.log(`\n✓ Ответ начал генерироваться. Первый селектор: ${firstGrab?.selector}`);

// --- поллинг
const tStart = Date.now();
let n = 0, last = null, lastChange = Date.now();
const index = [];
while (Date.now() - tStart < 120_000) {
  const g = await grabAnswer();
  if (g && g.html !== last) {
    last = g.html; lastChange = Date.now();
    const elapsed = Date.now() - t0;
    const name = `answer-${String(n).padStart(3, '0')}-${elapsed}ms.html`;
    await fs.writeFile(path.join(OUT_DIR, name), g.html, 'utf8');
    index.push({ i: n, elapsed_ms: elapsed, len: g.html.length, file: name, selector: g.selector });
    n++;
  }
  if (!(await hasStop()) && n > 0 && Date.now() - lastChange > STABLE_MS) break;
  await page.waitForTimeout(POLL_MS);
}

// --- финал
await page.waitForTimeout(800);
const finalGrab = await grabAnswer();
if (!finalGrab) {
  await fs.writeFile(path.join(OUT_DIR, 'page-full.html'), await page.content(), 'utf8');
  throw new Error('final.html не удалось снять');
}
await fs.writeFile(path.join(OUT_DIR, 'final.html'), finalGrab.html, 'utf8');
await fs.writeFile(path.join(OUT_DIR, 'page-full.html'), await page.content(), 'utf8');
index.push({ final: true, len: finalGrab.html.length, file: 'final.html', selector: finalGrab.selector });
await fs.writeFile(path.join(OUT_DIR, 'index.json'), JSON.stringify(index, null, 2), 'utf8');

console.log(`\n✓ ${n} answer-снапшотов + final.html`);
console.log(`  Селектор: ${finalGrab.selector}`);
console.log(`  ${OUT_DIR}`);
await browser.close();