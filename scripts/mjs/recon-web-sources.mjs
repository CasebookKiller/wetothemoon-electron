// scripts/mjs/recon-web-sources.mjs
/**
 * @name recon-web-sources
 * @purpose Анализ IndexedDB deepseek-chat: fragment types, search/citation/source поля на уровне message и chat_session
 * @input CDP :9222 (Yandex), вкладка chat.deepseek.com в диалоге (/a/chat/s/<id>)
 * @output ROOT/recon-output/web-sources-<ts>.json + stdout report
 * @args null
 * @result null
 * @exit 0 — успех
 * @exit 1 — нет вкладки / не в диалоге / IndexedDB пуст
 * @tool false
 * @example node scripts/mjs/recon-web-sources.mjs
 *
 * NOTE: pre-existing баг — `report.searchSearchFields` (typo) всегда undefined, работает через fallback.
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
  console.log('[recon] convId:', convId);

  // 1. Dump IndexedDB: chat_messages + fragments
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

  if (!raw || !raw.data) {
    console.error('IndexedDB: пусто для', convId);
    process.exit(1);
  }

  const data = raw.data;
  const messages = data.chat_messages || [];

  // 2. Анализ структуры fragments
  const fragmentTypes = new Map();
  const extraFields = new Set();
  const candidateMessages = [];

  for (const msg of messages) {
    // Собираем все ключи на уровне message (кроме fragments)
    for (const k of Object.keys(msg)) {
      if (k !== 'fragments') extraFields.add(k);
    }

    const frags = msg.fragments || [];
    for (const f of frags) {
      const t = f?.type || 'UNKNOWN';
      fragmentTypes.set(t, (fragmentTypes.get(t) || 0) + 1);
    }

    // Ищем сообщения, похожие на ассистентские с sources:
    // много fragment'ов или есть нестандартные типы
    const hasExtraFragType = frags.some(f =>
      !['THINK', 'REQUEST', 'RESPONSE', 'FILE', 'ATTACHMENT'].includes(f?.type)
    );
    const hasSearchField = Object.keys(msg).some(k =>
      /search|citation|source|web|reference/i.test(k)
    );

    if (hasExtraFragType || hasSearchField) {
      candidateMessages.push({
        message_id: msg.message_id,
        role: msg.role,
        extraFields: Object.keys(msg).filter(k => k !== 'fragments'),
        fragmentTypes: frags.map(f => ({
          type: f?.type,
          keys: f ? Object.keys(f) : [],
          contentLen: (f?.content || '').length,
        })),
      });
    }
  }

  // 3. Проверка chat_session на search-поля
  const sessionFields = Object.keys(data.chat_session || {});
  const searchSessionFields = sessionFields.filter(k =>
    /search|citation|source|web/i.test(k)
  );

  const report = {
    convId,
    totalMessages: messages.length,
    fragmentTypes: Object.fromEntries(fragmentTypes),
    messageLevelFields: Array.from(extraFields),
    sessionFields,
    searchSessionFields,
    candidateMessages: candidateMessages.slice(0, 10),
  };

  const outDir = path.join(ROOT, 'recon-output');
  await fs.mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, `web-sources-${Date.now()}.json`);
  await fs.writeFile(outPath, JSON.stringify(report, null, 2));

  console.log('\n═══ REPORT ═══');
  console.log('Messages:', report.totalMessages);
  console.log('Fragment types:', report.fragmentTypes);
  console.log('Message fields:', report.messageLevelFields);
  console.log('Session search fields:', report.searchSearchFields || report.searchSessionFields);
  console.log('Candidates (extra types / search fields):', candidateMessages.length);
  candidateMessages.slice(0, 5).forEach(c => {
    console.log('  -', c.message_id, c.role, 'extra:', c.extraFields, 'frags:', c.fragmentTypes.map(f => f.type));
  });
  console.log('JSON:', outPath);

  process.exit(0);
})();