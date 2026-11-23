// scripts/mjs/md-dump-gw-db.mjs
/**
 * @name md-dump-gw-db
 * @purpose Дамп content_html ассистентского сообщения из gateway.db + metrics
 * @input env: OUT (default md-recon/gw-db-dump.json), MSG_KEY (опц.), GW_USER_DATA (опц.)
 * @output <OUT>.json + <OUT>.html; stdout: путь, колонки, metrics
 * @args null
 * @result null
 * @exit 0 — успех
 * @exit 1 — БД не найдена / сообщение не найдено
 * @tool false
 * @example MSG_KEY=abc123 node scripts/mjs/md-dump-gw-db.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { DatabaseSync } from 'node:sqlite';

const OUT = process.env.OUT || 'md-recon/gw-db-dump.json';
const MSG_KEY = process.env.MSG_KEY || null; // опционально: конкретный pw_key / id

const HOMES = [process.env.GW_USER_DATA, path.join(os.homedir(), '.config')].filter(Boolean);
const APP_DIRS = ['wetothemoon-electron', 'wetothemoon', 'Electron'];
const DB_NAMES = ['gateway.db', 'gateway.sqlite', 'deepseek-gateway.db', 'cache.db'];

function findDb() {
  for (const home of HOMES)
    for (const app of APP_DIRS)
      for (const name of DB_NAMES) {
        const p = path.join(home, app, name);
        if (fs.existsSync(p)) return p;
      }
  throw new Error('gateway.db не найден; задай GW_USER_DATA=/путь/к/userData');
}

const metric = (html) => {
  const c = (re) => (html.match(re) || []).length;
  return {
    length: html.length,
    dsParagraphs: c(/ds-markdown-paragraph/g),
    mdCodeBlocks: c(/md-code-block/g),
    tokens: c(/class="token/g),
    katex: c(/katex/g),
    pre: c(/<pre/gi), code: c(/<code/gi), table: c(/<table/gi),
    ol: c(/<ol/gi), ul: c(/<ul/gi), li: c(/<li/gi),
    h1: c(/<h1/gi), h2: c(/<h2/gi), h3: c(/<h3/gi),
    strong: c(/<strong/gi), em: c(/<em/gi), a: c(/<a /gi), img: c(/<img/gi),
  };
};

const dbPath = findDb();
console.log('📂 DB:', dbPath);
const db = new DatabaseSync(dbPath);

// Узнаём актуальные колонки (в схеме v7 могут быть разные имена)
const cols = db.prepare(`PRAGMA table_info(messages)`).all().map((r) => r.name);
console.log('📋 messages columns:', cols.join(', '));

const htmlCol = ['content_html', 'html', 'full_html', 'content'].find((c) => cols.includes(c));
const keyCol  = ['pw_key', 'message_key', 'id'].find((c) => cols.includes(c));
if (!htmlCol) throw new Error('колонка с html не найдена: ' + cols.join(','));

const sql = MSG_KEY
  ? `SELECT * FROM messages WHERE ${keyCol} = ? AND role='assistant' LIMIT 1`
  : `SELECT * FROM messages WHERE role='assistant' ORDER BY id DESC LIMIT 1`;
const row = MSG_KEY ? db.prepare(sql).get(MSG_KEY) : db.prepare(sql).get();
if (!row) { console.error('❌ сообщение не найдено'); process.exit(1); }

const html = String(row[htmlCol] || '');
const data = {
  source: 'gw-db',
  dbPath,
  messageId: row.id,
  messageKey: keyCol !== 'id' ? row[keyCol] : null,
  role: row.role,
  contentHtml: html,
  metrics: metric(html),
  capturedAt: new Date().toISOString(),
};

fs.mkdirSync('md-recon', { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(data, null, 2));
fs.writeFileSync(OUT.replace(/\.json$/, '.html'), html);
console.log('✅ GW-DB dump:', OUT);
console.log('   metrics:', data.metrics);