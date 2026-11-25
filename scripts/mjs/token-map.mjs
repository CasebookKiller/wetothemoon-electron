#!/usr/bin/env node
/**
 * @name token-map
 * @purpose Карта «стоимости» файлов/каталогов в токенах (bytes/3.2) — что дорого читать
 * @input argv: --top N (default 25), --dir a,b,c (default src,docs,scripts)
 * @output stdout: топ файлов и сводка по каталогам
 * @args { "type": "object", "properties": { "top": { "type": "integer", "default": 25 }, "dir": { "type": "string", "default": "src,docs,scripts" } } }
 * @result { "type": "object", "properties": { "files": {"type":"integer"}, "tokens": {"type":"integer"} } }
 * @exit 0 — успех
 * @exit 1 — нет каталогов
 * @tool true
 * @example node scripts/mjs/token-map.mjs --top 15
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');

const argv = process.argv.slice(2);
const opt = (name, def) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : def;
};

const TOP = Number(opt('top', '25'));
const DIRS = opt('dir', 'src,docs,scripts').split(',').map((s) => s.trim()).filter(Boolean);
const SKIP = new Set(['node_modules', 'dist', '.git', 'captures', '.cache', 'recon-out', 'recon-output']);
const EXT_OK = /\.(ts|tsx|js|mjs|json|md|css|py|sh|sql)$/;

const files = [];
function walk(d) {
  if (!fs.existsSync(d)) return;
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue;
    // сохранённые веб-страницы (…_files/) — артефакты, не код
    if (e.isDirectory() && /_files$/.test(e.name)) continue;
    const full = path.join(d, e.name);
    if (e.isDirectory()) walk(full);
    else if (EXT_OK.test(e.name)) {
      const { size } = fs.statSync(full);
      files.push({ rel: path.relative(ROOT, full), size });
    }
  }
}
for (const d of DIRS) walk(path.join(ROOT, d));

if (!files.length) {
  console.error('✗ не найдено файлов');
  process.exit(1);
}

const totalBytes = files.reduce((s, f) => s + f.size, 0);
files.sort((a, b) => b.size - a.size);

const byDir = new Map();
for (const f of files) {
  const top = f.rel.split(path.sep)[0];
  const acc = byDir.get(top) ?? { bytes: 0, n: 0 };
  acc.bytes += f.size;
  acc.n++;
  byDir.set(top, acc);
}

console.log(`всего: ${files.length} файлов, ~${Math.round(totalBytes / 3.2)} токенов\n`);
console.log('по каталогам:');
for (const [d, v] of [...byDir].sort((a, b) => b[1].bytes - a[1].bytes)) {
  console.log(`  ${d.padEnd(14)} ~${String(Math.round(v.bytes / 3.2)).padStart(7)} tok  (${v.n} files)`);
}

console.log(`\nтоп-${TOP} самых дорогих файлов:`);
for (const f of files.slice(0, TOP)) {
  console.log(`  ~${String(Math.round(f.size / 3.2)).padStart(7)} tok  ${f.rel}`);
}
