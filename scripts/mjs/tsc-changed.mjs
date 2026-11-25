#!/usr/bin/env node
/**
 * @name tsc-changed
 * @purpose Ошибки TypeScript только по изменённым файлам (git diff + untracked), плюс общий счётчик
 * @input argv: --all (показать все ошибки), --max N (default 40)
 * @output stdout: summary + строки ошибок, относящиеся к изменённым файлам
 * @args { "type": "object", "properties": { "all": { "type": "boolean" }, "max": { "type": "integer", "default": 40 } } }
 * @result { "type": "object", "properties": { "changed": {"type":"integer"}, "errorsTotal": {"type":"integer"}, "errorsChanged": {"type":"integer"} } }
 * @exit 0 — ошибок в изменённых файлах нет
 * @exit 1 — есть ошибки в изменённых файлах
 * @tool true
 * @example node scripts/mjs/tsc-changed.mjs
 * @example node scripts/mjs/tsc-changed.mjs --all
 */

import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');

const argv = process.argv.slice(2);
const ALL = argv.includes('--all');
const iMax = argv.indexOf('--max');
const MAX = iMax >= 0 ? Number(argv[iMax + 1]) || 40 : 40;

const run = (cmd) => {
  try {
    return execSync(cmd, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 16 * 1024 * 1024 }).trim();
  } catch (e) {
    return (e.stdout || '').toString();
  }
};

const changed = new Set(
  [
    run('git diff --name-only HEAD'),
    run('git ls-files -o --exclude-standard'),
  ].join('\n').split('\n').filter((f) => /\.(ts|tsx)$/.test(f)),
);

const tscOut = run('npx tsc --noEmit 2>&1');
const errors = tscOut.split('\n').filter((l) => /error TS\d+/.test(l));

const changedErrors = errors.filter((l) => [...changed].some((f) => l.startsWith(f) || l.includes(path.sep + f)));

console.log(`changed ts files: ${changed.size}`);
console.log(`errors total:     ${errors.length}`);
console.log(`errors in changed:${changedErrors.length}`);

const show = ALL ? errors : changedErrors;
for (const line of show.slice(0, MAX)) console.log(line);
if (show.length > MAX) console.log(`… +${show.length - MAX}`);

process.exit(changedErrors.length ? 1 : 0);
