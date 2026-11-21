#!/usr/bin/env node
/**
 * @name scripts-index
 * @purpose Сканирует scripts/{mjs,bash,python}/, парсит headers, генерирует scripts/manifest.json
 * @input argv: --verbose (опционально), --check (только проверка, без записи)
 * @output stdout: JSON (при --check) или статистика; пишет scripts/manifest.json
 * @args { "type": "object", "properties": { "verbose": { "type": "boolean" }, "check": { "type": "boolean" } } }
 * @result { "type": "object", "properties": { "generatedAt": {"type":"string"}, "scripts": {"type":"array"} } }
 * @exit 0 — успех
 * @exit 1 — ошибка парсинга
 * @tool false
 * @example node scripts/mjs/scripts-index.mjs
 * @example node scripts/mjs/scripts-index.mjs --check
 * @example node scripts/mjs/scripts-index.mjs --verbose
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCRIPTS_ROOT = path.resolve(__dirname, '..');   // scripts/
const OUT_PATH = path.join(SCRIPTS_ROOT, 'manifest.json');

const verbose = process.argv.includes('--verbose');
const checkOnly = process.argv.includes('--check');

// ─── Парсер header ────────────────────────────────────────────────────────
/**
 * Извлекает @-поля из начала файла.
 * Поддерживает .mjs (JSDoc) / .sh (#) / .py (docstring).
 */
function parseHeader(content) {
  const lines = content.split('\n').slice(0, 60);   // первые 60 строк
  const fields = {};
  const KEY_RE = /^[\s/*#]*@(\w+)\s+(.+?)\s*$/;

  for (const line of lines) {
    const m = line.match(KEY_RE);
    if (m) {
      const key = m[1];
      const val = m[2].trim();
      if (!fields[key]) fields[key] = [];
      fields[key].push(val);
    }
  }

  // Односкалярные
  const one = (k) => (fields[k] ? fields[k][0] : null);
  // Множественные (пример, exit — массив)
  const many = (k) => (fields[k] ? fields[k] : []);

  // @args / @result — JSON Schema (может быть в одну строку)
  const parseSchema = (k) => {
    const raw = one(k);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return { _raw: raw }; }
  };

  // @exit — { "0": "успех", "1": "ошибка" }
  const parseExit = () => {
    const raw = many('exit');
    const out = {};
    for (const line of raw) {
      const m = line.match(/^(\d+)\s*[—-]\s*(.+)$/);
      if (m) out[m[1]] = m[2].trim();
    }
    return out;
  };

  return {
    name: one('name'),
    purpose: one('purpose'),
    input: one('input'),
    output: one('output'),
    args: parseSchema('args'),
    result: parseSchema('result'),
    exit: parseExit(),
    tool: one('tool') === 'true',
    example: many('example'),
  };
}

// ─── Сканирование ─────────────────────────────────────────────────────────
function scanDir(dir, ext) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    if (path.extname(entry.name) !== ext) continue;
    const fullPath = path.join(dir, entry.name);
    const relPath = path.relative(SCRIPTS_ROOT, fullPath);
    try {
      const content = fs.readFileSync(fullPath, 'utf8');
      const header = parseHeader(content);
      if (!header.name) {
        console.warn(`⚠ ${relPath}: header без @name (пропущен)`);
        continue;
      }
      out.push({ path: `scripts/${relPath}`, ...header });
    } catch (e) {
      console.error(`✗ ${relPath}: ${e.message}`);
    }
  }
  return out;
}

// ─── Главное ──────────────────────────────────────────────────────────────
function main() {
  const mjs = scanDir(path.join(SCRIPTS_ROOT, 'mjs'), '.mjs');
  const bash = scanDir(path.join(SCRIPTS_ROOT, 'bash'), '.sh');
  const python = scanDir(path.join(SCRIPTS_ROOT, 'python'), '.py');

  const scripts = [...mjs, ...bash, ...python].sort((a, b) =>
    a.path.localeCompare(b.path),
  );

  const manifest = {
    generatedAt: new Date().toISOString(),
    total: scripts.length,
    byRuntime: {
      mjs: mjs.length,
      bash: bash.length,
      python: python.length,
    },
    tools: scripts.filter((s) => s.tool).map((s) => s.name),
    scripts,
  };

  if (checkOnly) {
    console.log(JSON.stringify(manifest, null, 2));
    return;
  }

  fs.writeFileSync(OUT_PATH, JSON.stringify(manifest, null, 2), 'utf8');
  console.log(`✓ ${OUT_PATH}`);
  console.log(`  mjs:    ${mjs.length}`);
  console.log(`  bash:   ${bash.length}`);
  console.log(`  python: ${python.length}`);
  console.log(`  tools:  ${manifest.tools.length ? manifest.tools.join(', ') : '(нет)'}`);

  if (verbose) {
    console.log('\nСкрипты:');
    for (const s of scripts) {
      console.log(`  ${s.tool ? '🔧' : '  '} ${s.path} — ${s.purpose || '(без @purpose)'}`);
    }
  }

  const noPurpose = scripts.filter((s) => !s.purpose);
  if (noPurpose.length) {
    console.warn(`\n⚠ ${noPurpose.length} скрипт(ов) без @purpose:`);
    for (const s of noPurpose) console.warn(`  ${s.path}`);
  }
}

main();
