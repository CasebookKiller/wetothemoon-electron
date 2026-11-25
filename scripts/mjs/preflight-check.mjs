// scripts/mjs/preflight-check.mjs
// Проверка состояния проекта (Gateway / Navigator / Prana-Bindu). Актуально для schema v11.

/**
 * @name preflight-check
 * @purpose Проверка состояния проекта: git, submodule, schema, БД, manifest, .env, бэкапы
 * @input argv: --fast (пропустить tsc), --json (машинный вывод)
 * @output stdout: 9 секций проверок
 * @args { "type": "object", "properties": { "fast": { "type": "boolean" }, "json": { "type": "boolean" } } }
 * @result { "type": "object", "properties": { "ok": {"type":"boolean"}, "sections": {"type":"array"} } }
 * @exit 0 — всё готово
 * @exit 1 — есть проблемы
 * @tool false
 * @example node scripts/mjs/preflight-check.mjs --fast
 */

import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const require = createRequire(import.meta.url);

// node:sqlite помечает себя ExperimentalWarning — не засоряем вывод
const _emitWarning = process.emitWarning;
process.emitWarning = (w, ...rest) => {
  const msg = typeof w === 'string' ? w : (w && w.message) || '';
  if (/SQLite is an experimental feature/.test(msg)) return;
  return _emitWarning.call(process, w, ...rest);
};

const FAST = process.argv.includes('--fast');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../..');   // из scripts/mjs/ → корень проекта
const DB_PATH = path.join(os.homedir(), '.config/wetothemoon-electron/gateway.db');
const SCHEMA_EXPECTED = 11;
const PARENT = path.resolve(ROOT, '..');

let hasErrors = false;
const err = (msg) => { console.log('  ✗ ' + msg); hasErrors = true; };
const ok  = (msg) => console.log('  ✓ ' + msg);
const warn = (msg) => console.log('  ⚠ ' + msg);

function section(title) { console.log('\n=== ' + title + ' ==='); }

// ─── 1. Git ─────────────────────────────────────────────────────────
section('1. Git (submodule)');
try {
  const head = execSync('git log --oneline -1', { cwd: ROOT, encoding: 'utf8' }).trim();
  console.log('  HEAD: ' + head);
  const status = execSync('git status --short', { cwd: ROOT, encoding: 'utf8' }).trim();
  if (status) warn('Незакоммиченные изменения:\n' + status.split('\n').map(l => '    ' + l).join('\n'));
  else ok('Рабочий каталог чист');
} catch (e) { err('git: ' + e.message); }

// ─── 2. Submodule bump в родителе ────────────────────────────────────
section('2. Submodule в родителе');
try {
  const s = execSync('git submodule status | grep wetothemoon-electron', {
    cwd: PARENT, encoding: 'utf8'
  }).trim();
  if (s.startsWith('+')) err('Submodule впереди родителя: ' + s + ' — нужен bump');
  else if (s.startsWith(' ')) ok('Submodule на актуальном коммите');
  else warn('Submodule: ' + s);
} catch (e) { warn('Не удалось проверить: ' + e.message); }

// ─── 3. SCHEMA_VERSION ──────────────────────────────────────────────
section('3. SCHEMA_VERSION');
try {
  const schema = fs.readFileSync(path.join(ROOT, 'src/main/services/gateway/cache/schema.ts'), 'utf8');
  const m = schema.match(/SCHEMA_VERSION\s*=\s*(\d+)/);
  const v = m ? parseInt(m[1], 10) : 0;
  if (v === SCHEMA_EXPECTED) ok(`SCHEMA_VERSION = ${SCHEMA_EXPECTED}`);
  else err(`SCHEMA_VERSION = ${v}, ожидается ${SCHEMA_EXPECTED}`);
} catch (e) { err('schema.ts: ' + e.message); }

// ─── 4. Миграции ─────────────────────────────────────────────────────
section('4. Миграции');
try {
  const dir = path.join(ROOT, 'src/main/services/gateway/cache/migrations');
  const files = fs.readdirSync(dir).filter(f => f.match(/^v\d+\.ts$/)).sort();
  console.log('  ' + files.join(', '));
  for (const want of ['v9.ts', 'v10.ts', 'v11.ts']) {
    if (files.includes(want)) ok(want);
    else err(want + ' отсутствует');
  }
  // Оркестратор: миграция должна быть в массиве db.ts, иначе пустой UI
  const dbSrc = fs.readFileSync(path.join(ROOT, 'src/main/services/gateway/cache/db.ts'), 'utf8');
  if (/migrateToV11/.test(dbSrc)) ok('migrateToV11 в оркестраторе db.ts');
  else err('migrateToV11 не найден в db.ts (массив миграций)');
} catch (e) { err('migrations: ' + e.message); }

// ─── 5. БД: schema + таблицы ────────────────────────────────────────
section(`5. БД: v${SCHEMA_EXPECTED}`);
if (!fs.existsSync(DB_PATH)) {
  warn('БД ещё не создана (первый запуск): ' + DB_PATH);
} else {
  try {
    const { DatabaseSync } = require('node:sqlite');
    const db = new DatabaseSync(DB_PATH);
    const ver = db.prepare('PRAGMA user_version').get().user_version;
    if (ver === SCHEMA_EXPECTED) ok(`user_version = ${SCHEMA_EXPECTED}`);
    else if (ver === SCHEMA_EXPECTED - 1) warn(`user_version = ${ver} — миграция v${SCHEMA_EXPECTED} применится при следующем запуске`);
    else err('user_version = ' + ver);

    const tables = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
    ).all().map(r => r.name);
    for (const t of ['context_nodes', 'context_versions', 'context_workspaces', 'tasks']) {
      if (tables.includes(t)) ok(t); else err(t + ' отсутствует');
    }

    // v11: conversations.position (порядок GigaChat)
    const cols = db.prepare('PRAGMA table_info(conversations)').all().map(c => c.name);
    if (cols.includes('position')) ok('conversations.position');
    else err('conversations.position отсутствует (миграция v11 не применена)');

    if (tables.includes('context_nodes')) {
      const cnt = db.prepare('SELECT COUNT(*) AS c FROM context_nodes').get().c;
      if (cnt > 0) ok(`context_nodes: ${cnt} узлов`);
      else warn('context_nodes пуст — запусти syncManifestToDb');

      const versions = db.prepare('SELECT COUNT(*) AS c FROM context_versions').get().c;
      console.log(`    context_versions: ${versions} записей`);
    }

    if (tables.includes('conversations')) {
      const c = db.prepare(
        'SELECT COUNT(*) AS total, SUM(archived = 1) AS archived, SUM(position IS NULL) AS pos_null, SUM(pinned = 1) AS pinned FROM conversations'
      ).get();
      console.log(`    conversations: ${c.total} (archived=${c.archived}, position=NULL: ${c.pos_null}, pinned=${c.pinned})`);
    }
    db.close();
  } catch (e) { err('БД: ' + e.message); }
}

// ─── 6. tsc по изменённым файлам ────────────────────────────────────
section('6. tsc (изменённые файлы)');
if (FAST) {
  console.log('  ⏭ пропущено (--fast)');
} else {
  try {
    execSync('node scripts/mjs/tsc-changed.mjs', { cwd: ROOT, stdio: 'inherit', timeout: 180000 });
    ok('ошибок в изменённых файлах нет');
  } catch {
    err('есть ошибки TypeScript в изменённых файлах (см. вывод выше)');
  }
}

// ─── 7. context.manifest.json ────────────────────────────────────────
section('7. context.manifest.json');
try {
  const mp = path.join(ROOT, 'context.manifest.json');
  if (!fs.existsSync(mp)) { err('manifest отсутствует'); }
  else {
    const m = JSON.parse(fs.readFileSync(mp, 'utf8'));
    ok(`manifest: ${m.nodes.length} узлов`);
    const missing = m.nodes.filter(n => n.file && !fs.existsSync(path.join(ROOT, n.file)));
    if (missing.length) err(`битые file-ссылки: ${missing.length} (${missing.slice(0, 3).map(n => n.file).join(', ')}${missing.length > 3 ? ', …' : ''})`);
    else ok('все file-ссылки существуют');
    const globalNode = m.nodes.find(n => n.key === 'global');
    if (globalNode) {
      console.log('  global → ' + (globalNode.file || globalNode.summaryFile || '(пусто)'));
      if (globalNode.file && globalNode.file.includes('01_COMMON_CONTEXT')) {
        warn('⚠ L0 указывает на OSINT (Fremen Eye), а не на общие правила — исправить!');
      }
    }
  }
} catch (e) { err('manifest: ' + e.message); }

// ─── 8. .env.local (без ключей) ─────────────────────────────────────
section('8. .env.local');
try {
  const ep = path.join(ROOT, '.env.local');
  if (!fs.existsSync(ep)) warn('.env.local отсутствует');
  else {
    const txt = fs.readFileSync(ep, 'utf8');
    const hasManifest = /CONTEXT_MANIFEST\s*=/.test(txt);
    const hasKeys = /ACTIVE_WORKSPACE_KEYS\s*=/.test(txt);
    if (hasManifest) ok('CONTEXT_MANIFEST задан'); else warn('CONTEXT_MANIFEST не задан');
    if (hasKeys) ok('ACTIVE_WORKSPACE_KEYS задан'); else warn('ACTIVE_WORKSPACE_KEYS не задан');
  }
} catch (e) { err('.env.local: ' + e.message); }

// ─── 9. Backups ─────────────────────────────────────────────────────
section('9. Бэкапы docs/');
try {
  const bdir = path.join(os.homedir(), 'backups');
  if (fs.existsSync(bdir)) {
    const baks = fs.readdirSync(bdir).filter(f => f.startsWith('wetothemoon-prompts-')).sort();
    if (baks.length > 0) {
      const last = baks[baks.length - 1];
      const age = (Date.now() - fs.statSync(path.join(bdir, last)).mtimeMs) / 3600000;
      console.log(`  последний: ${last} (${age.toFixed(1)} ч назад)`);
      if (age > 24) warn('Бэкап старше 24 ч — сделай wm-backup');
      else ok('бэкап свежий');
    } else warn('Нет бэкапов — сделай wm-backup');
  } else warn('~backups не существует');
} catch (e) { warn('backups: ' + e.message); }

// ─── Итог ──────────────────────────────────────────────────────────
console.log('\n' + '='.repeat(50));
if (hasErrors) {
  console.log('❌ Есть проблемы, требующие внимания.');
  process.exit(1);
} else {
  console.log('✅ Всё готово к работе.');
  process.exit(0);
}