#!/usr/bin/env node
/**
 * @name db-inspect
 * @purpose Компактный снимок SQLite-БД: user_version, counts по таблицам, archived/position для conversations
 * @input argv: --db gateway|prana|<путь>, --json, --limit N (сколько таблиц печатать, default 20)
 * @output stdout: ≤ 30 строк; при --json — JSON
 * @args { "type": "object", "properties": { "db": { "type": "string", "default": "gateway" }, "json": { "type": "boolean" }, "limit": { "type": "integer", "default": 20 } } }
 * @result { "type": "object", "properties": { "path": {"type":"string"}, "version": {"type":"integer"}, "tables": {"type":"object"} } }
 * @exit 0 — успех
 * @exit 1 — БД не найдена / ошибка чтения
 * @tool true
 * @example node scripts/mjs/db-inspect.mjs
 * @example node scripts/mjs/db-inspect.mjs --db prana --json
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// node:sqlite помечает себя ExperimentalWarning — не засоряем stderr контекстом
const _emitWarning = process.emitWarning;
process.emitWarning = (w, ...rest) => {
  const msg = typeof w === 'string' ? w : (w && w.message) || '';
  if (/SQLite is an experimental feature/.test(msg)) return;
  return _emitWarning.call(process, w, ...rest);
};

const argv = process.argv.slice(2);
const opt = (name, def = null) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : def;
};
const flag = (name) => argv.includes(`--${name}`);

const HOME_DB = path.join(os.homedir(), '.config/wetothemoon-electron');
const DB_MAP = {
  gateway: path.join(HOME_DB, 'gateway.db'),
  prana: path.join(HOME_DB, 'prana_bindu.db'),
};
const dbArg = opt('db', 'gateway');
const dbPath = DB_MAP[dbArg] ?? dbArg;
const json = flag('json');
const limit = Number(opt('limit', '20'));

if (!fs.existsSync(dbPath)) {
  console.error(`✗ БД не найдена: ${dbPath}`);
  process.exit(1);
}

const { DatabaseSync } = await import('node:sqlite');
const db = new DatabaseSync(dbPath, { readOnly: true });

const version = db.prepare('PRAGMA user_version').get()?.user_version ?? null;
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
  .all().map((r) => r.name);

const counts = {};
for (const t of tables.slice(0, limit)) {
  try {
    counts[t] = db.prepare(`SELECT COUNT(*) AS c FROM "${t}"`).get().c;
  } catch (e) {
    counts[t] = `err: ${e.message}`;
  }
}

let conversations = null;
if (tables.includes('conversations')) {
  conversations = db.prepare(
    'SELECT COUNT(*) AS total, SUM(archived = 1) AS archived, SUM(position IS NULL) AS pos_null, SUM(pinned = 1) AS pinned FROM conversations',
  ).get();
}
db.close();

const result = { path: dbPath, version, tableCount: tables.length, tables: counts, conversations };

if (json) {
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log(`db       ${dbPath}`);
  console.log(`version  ${version}`);
  console.log(`tables   ${tables.length}`);
  for (const [t, c] of Object.entries(counts)) console.log(`  ${t.padEnd(24)} ${c}`);
  if (tables.length > limit) console.log(`  … +${tables.length - limit} table(s)`);
  if (conversations) {
    console.log(`conversations  total=${conversations.total} archived=${conversations.archived} posNull=${conversations.pos_null} pinned=${conversations.pinned}`);
  }
}
