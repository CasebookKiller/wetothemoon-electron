#!/usr/bin/env node
/**
 * @name handoff-digest
 * @purpose Дайджест handoff-документов: только секции «Приоритет / Открытые вопросы / Следующая сессия / Тест»
 * @input argv: --module navigator|gateway|prana-bindu|all (default all), --lines N (default 25), --file <путь>
 * @output stdout: markdown-дайджест ≤ 200 строк
 * @args { "type": "object", "properties": { "module": { "type": "string", "default": "all" }, "lines": { "type": "integer", "default": 25 }, "file": { "type": "string" } } }
 * @result { "type": "object", "properties": { "files": {"type":"array"}, "sections": {"type":"integer"} } }
 * @exit 0 — успех
 * @exit 1 — handoff не найден
 * @tool true
 * @example node scripts/mjs/handoff-digest.mjs --module navigator
 * @example node scripts/mjs/handoff-digest.mjs --lines 15
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const PROMPTS = path.join(ROOT, 'docs/prompts');

const argv = process.argv.slice(2);
const opt = (name, def = null) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : def;
};

const moduleArg = opt('module', 'all');
const maxLines = Number(opt('lines', '25'));
const explicitFile = opt('file', null);

const KEEP = /приоритет|открыт|следующ|с чего начать|не делать|блокер|тест|todo|проблем/i;

function latestHandoffs(moduleName) {
  const dir = path.join(PROMPTS, moduleName, 'handoff');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => ({ f, t: fs.statSync(path.join(dir, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t)
    .slice(0, 2)
    .map((x) => path.join(dir, x.f));
}

function digest(file) {
  const text = fs.readFileSync(file, 'utf8');
  const lines = text.split('\n');
  const sections = [];
  let current = null;
  for (const line of lines) {
    if (/^#{2,4}\s/.test(line)) {
      if (current) sections.push(current);
      current = { title: line, body: [] };
    } else if (current) {
      current.body.push(line);
    }
  }
  if (current) sections.push(current);

  const picked = sections.filter((s) => KEEP.test(s.title));
  const out = [`## ${path.relative(ROOT, file)}`];
  if (!picked.length) {
    out.push('', '_(нет тематических секций — последние строки)_', '');
    out.push(...lines.filter(Boolean).slice(-maxLines));
    return { lines: out, count: 0 };
  }
  let count = 0;
  for (const s of picked) {
    const body = s.body.filter((l) => l.trim()).slice(0, maxLines);
    out.push('', s.title, ...body);
    count++;
  }
  return { lines: out, count };
}

const files = explicitFile
  ? [path.resolve(explicitFile)]
  : (moduleArg === 'all' ? ['navigator', 'gateway', 'prana-bindu'] : [moduleArg]).flatMap(latestHandoffs);

if (!files.length) {
  console.error('✗ handoff-файлы не найдены');
  process.exit(1);
}

let total = 0;
for (const f of files) {
  const d = digest(f);
  total += d.count;
  console.log(d.lines.join('\n'));
  console.log('');
}
console.log(`_файлов: ${files.length}, секций: ${total}_`);
