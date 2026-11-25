#!/usr/bin/env node
/**
 * @name code-index
 * @purpose Индекс экспортов src/: file:line + имя + kind, без чтения файлов целиком
 * @input argv: --filter <подстрока пути/имени>, --limit N (default 300), --dir <каталог>
 * @output stdout: строки вида `src/path/file.ts:12  function  foo`
 * @args { "type": "object", "properties": { "filter": { "type": "string" }, "limit": { "type": "integer", "default": 300 }, "dir": { "type": "string", "default": "src" } } }
 * @result { "type": "object", "properties": { "files": {"type":"integer"}, "symbols": {"type":"integer"} } }
 * @exit 0 — успех
 * @exit 1 — каталог не найден
 * @tool true
 * @example node scripts/mjs/code-index.mjs --filter navigator
 * @example node scripts/mjs/code-index.mjs --dir src/main/services/gateway --limit 100
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');

const argv = process.argv.slice(2);
const opt = (name, def = null) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : def;
};

const filter = opt('filter', '');
const dir = path.resolve(ROOT, opt('dir', 'src'));
const limit = Number(opt('limit', '300'));
const SKIP = new Set(['node_modules', 'dist', '.git', 'captures', 'recon-out', 'recon-output', '.cache']);

if (!fs.existsSync(dir)) {
  console.error(`✗ каталог не найден: ${dir}`);
  process.exit(1);
}

const RE = [
  [/export\s+(?:default\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/g, 'function'],
  [/export\s+(?:default\s+)?class\s+([A-Za-z_$][\w$]*)/g, 'class'],
  [/export\s+(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g, 'const'],
  [/export\s+(?:interface|type|enum)\s+([A-Za-z_$][\w$]*)/g, 'type'],
  [/export\s+default\s+(?!class|function)([A-Za-z_$][\w$]*)/g, 'default'],
];

function walk(d, acc) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue;
    const full = path.join(d, e.name);
    if (e.isDirectory()) walk(full, acc);
    else if (/\.(ts|tsx|js|mjs)$/.test(e.name) && !e.name.endsWith('.d.ts')) acc.push(full);
  }
  return acc;
}

const files = walk(dir, []);
const rows = [];
for (const file of files) {
  const rel = path.relative(ROOT, file);
  if (filter && !rel.includes(filter)) continue;
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.includes('export')) continue;
    for (const [re, kind] of RE) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(line))) {
        const name = m[1];
        if (filter && !rel.includes(filter) && !name.includes(filter)) continue;
        rows.push(`${rel}:${i + 1}  ${kind.padEnd(8)} ${name}`);
        if (rows.length >= limit) break;
      }
      if (rows.length >= limit) break;
    }
    if (rows.length >= limit) break;
  }
  if (rows.length >= limit) break;
}

console.log(rows.join('\n'));
console.log(`\n_files=${files.length} symbols=${rows.length}${rows.length >= limit ? ` (limit ${limit})` : ''}`);
