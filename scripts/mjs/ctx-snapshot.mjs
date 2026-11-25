#!/usr/bin/env node
/**
 * @name ctx-snapshot
 * @purpose Компактный снимок состояния проекта для LLM: git, «чужие» файлы, schema, ключевые counts БД, последний handoff
 * @input argv: --json (машинный вывод), --tsc (добавить число ошибок tsc, медленно)
 * @output stdout: ≤ 40 строк; при --json — один JSON-объект
 * @args { "type": "object", "properties": { "json": { "type": "boolean" }, "tsc": { "type": "boolean" } } }
 * @result { "type": "object", "properties": { "branch": {"type":"string"}, "head": {"type":"string"}, "dirty": {"type":"array"}, "schema": {"type":"integer"} } }
 * @exit 0 — успех
 * @exit 1 — не удалось собрать снимок
 * @tool true
 * @example node scripts/mjs/ctx-snapshot.mjs
 * @example node scripts/mjs/ctx-snapshot.mjs --json
 */

import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

// node:sqlite помечает себя ExperimentalWarning — не засоряем stderr контекстом
const _emitWarning = process.emitWarning;
process.emitWarning = (w, ...rest) => {
  const msg = typeof w === 'string' ? w : (w && w.message) || '';
  if (/SQLite is an experimental feature/.test(msg)) return;
  return _emitWarning.call(process, w, ...rest);
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const DB_PATH = path.join(os.homedir(), '.config/wetothemoon-electron/gateway.db');
const JSON_OUT = process.argv.includes('--json');
const WITH_TSC = process.argv.includes('--tsc');

const run = (cmd, fallback = '') => {
  try {
    return execSync(cmd, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return fallback;
  }
};

const FOREIGN_RE = /manifest\.json|test-intervals-abort\.mjs|intervalsIcuProvider\.ts/;

const out = {
  branch: run('git branch --show-current') || '(detached)',
  head: run('git log --oneline -1'),
  dirty: run('git status --short').split('\n').filter(Boolean),
  diffstat: run('git diff --shortstat') || 'clean',
  lastHandoff: run('ls -t docs/prompts/*/handoff/*.md 2>/dev/null | head -1'),
  schemaTs: null,
  db: null,
  tscErrors: null,
};

try {
  const schemaSrc = run('git show HEAD:src/main/services/gateway/cache/schema.ts');
  const m = schemaSrc.match(/SCHEMA_VERSION\s*=\s*(\d+)/);
  if (m) out.schemaTs = Number(m[1]);
} catch { /* ignore */ }

if (existsSync(DB_PATH)) {
  try {
    const { DatabaseSync } = await import('node:sqlite');
    const db = new DatabaseSync(DB_PATH, { readOnly: true });
    const q = (sql) => { try { return db.prepare(sql).get(); } catch { return null; } };
    const ver = q('PRAGMA user_version');
    const conv = q('SELECT COUNT(*) AS total, SUM(archived = 1) AS archived, SUM(position IS NULL) AS pos_null, SUM(pinned = 1) AS pinned FROM conversations');
    const msgs = q('SELECT COUNT(*) AS total FROM messages');
    out.db = {
      version: ver?.user_version ?? null,
      conversations: conv?.total ?? null,
      archived: conv?.archived ?? null,
      positionNull: conv?.pos_null ?? null,
      pinned: conv?.pinned ?? null,
      messages: msgs?.total ?? null,
    };
    db.close();
  } catch (e) {
    out.db = { error: e.message };
  }
}

if (WITH_TSC) {
  const tsc = run('npx tsc --noEmit 2>&1', '');
  out.tscErrors = tsc.split('\n').filter((l) => /error TS\d+/.test(l)).length;
}

out.foreign = out.dirty.filter((l) => FOREIGN_RE.test(l));

if (JSON_OUT) {
  console.log(JSON.stringify(out, null, 2));
} else {
  console.log(`branch  ${out.branch}`);
  console.log(`head    ${out.head}`);
  console.log(`diff    ${out.diffstat}`);
  console.log(`dirty   ${out.dirty.length} files`);
  for (const f of out.dirty.slice(0, 20)) console.log(`  ${f}`);
  if (out.dirty.length > 20) console.log(`  … +${out.dirty.length - 20}`);
  if (out.db) {
    console.log(`db      v${out.db.version} | conversations=${out.db.conversations} archived=${out.db.archived} posNull=${out.db.positionNull} pinned=${out.db.pinned} messages=${out.db.messages}`);
  } else {
    console.log('db      нет файла gateway.db');
  }
  console.log(`schema  code=${out.schemaTs ?? '?'} db=${out.db?.version ?? '?'}${out.schemaTs && out.db?.version && out.schemaTs !== out.db.version ? ' ⚠ MISMATCH' : ''}`);
  if (out.tscErrors !== null) console.log(`tsc     ${out.tscErrors} error(s)`);
  if (out.foreign.length) console.log(`!! не коммитить: ${out.foreign.map((l) => l.slice(3)).join(', ')}`);
  console.log(`handoff ${out.lastHandoff || '(нет)'}`);
}
