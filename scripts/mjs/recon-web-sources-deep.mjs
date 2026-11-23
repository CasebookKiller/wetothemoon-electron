// scripts/mjs/recon-web-sources-deep.mjs
/**
 * @name recon-web-sources-deep
 * @purpose Глубокий дамп фрагментов TOOL_SEARCH / TOOL_OPEN из IndexedDB deepseek-chat (для разбора источников web-search)
 * @input CDP :9222 (Yandex), вкладка chat.deepseek.com в диалоге
 * @output ROOT/recon-output/web-sources-deep-<ts>.json + samples в stdout
 * @args null
 * @result null
 * @exit 0 — успех
 * @exit 1 — нет вкладки / не в диалоге / IndexedDB пуст
 * @tool false
 * @example node scripts/mjs/recon-web-sources-deep.mjs
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../..');

const YANDEX_CDP = 'http://127.0.0.1:9222';

(async () => {
  const browser = await chromium.connectOverCDP(YANDEX_CDP);
  const ctx = browser.contexts()[0];
  const pages = ctx.pages();
  const page = pages.find(p => p.url().includes('chat.deepseek.com'));
  if (!page) { console.error('Нет вкладки DeepSeek'); process.exit(1); }

  const url = page.url();
  const m = url.match(/\/a\/chat\/s\/([a-f0-9-]+)/i);
  if (!m) { console.error('Не в диалоге:', url); process.exit(1); }
  const convId = m[1];

  const raw = await page.evaluate(async (id) => {
    const db = await new Promise((res, rej) => {
      const req = indexedDB.open('deepseek-chat');
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
    try {
      const tx = db.transaction('history-message', 'readonly');
      const store = tx.objectStore('history-message');
      const value = await new Promise((res, rej) => {
        const req = store.get(id);
        req.onsuccess = () => res(req.result);
        req.onerror = () => rej(req.error);
      });
      return value;
    } finally {
      db.close();
    }
  }, convId);

  if (!raw || !raw.data) { process.exit(1); }
  const messages = raw.data.chat_messages || [];

  const samples = { TOOL_SEARCH: [], TOOL_OPEN: [] };

  for (const msg of messages) {
    for (const f of (msg.fragments || [])) {
      if (f.type === 'TOOL_SEARCH' && samples.TOOL_SEARCH.length < 3) {
        samples.TOOL_SEARCH.push({ message_id: msg.message_id, fragment: f });
      }
      if (f.type === 'TOOL_OPEN' && samples.TOOL_OPEN.length < 3) {
        samples.TOOL_OPEN.push({ message_id: msg.message_id, fragment: f });
      }
    }
  }

  const outDir = path.join(ROOT, 'recon-output');
  await fs.mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, `web-sources-deep-${Date.now()}.json`);
  
  await fs.writeFile(outPath, JSON.stringify(samples, null, 2));

  console.log('Sample TOOL_SEARCH:', JSON.stringify(samples.TOOL_SEARCH[0], null, 2));
  console.log('\nSample TOOL_OPEN:', JSON.stringify(samples.TOOL_OPEN[0], null, 2));
  console.log('\nSaved to:', outPath);

  process.exit(0);
})();