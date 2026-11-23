// scripts/mjs/compare-stream-formatting.mjs
/**
 * @name compare-stream-formatting
 * @purpose Сравнение snapshots живого стрима с финальным HTML: префикс-проверка + монотонный рост (детект регрессий форматирования)
 * @input argv[2]=capture-dir (обязателен, содержит index.json + *.html)
 * @output stdout: отчёт по каждому snapshot + итог; exit code = статус
 * @args { "type": "object", "properties": { "captureDir": { "type": "string" } }, "required": ["captureDir"] }
 * @result null
 * @exit 0 — все snapshots ok
 * @exit 1 — регрессии
 * @exit 2 — нет final.html в index.json
 * @tool false
 * @example node scripts/mjs/compare-stream-formatting.mjs /tmp/capture-2026-11-17
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { JSDOM } from 'jsdom';

const DIR = process.argv[2];
if (!DIR) { console.error('usage: compare-stream-formatting.mjs <capture-dir>'); process.exit(1); }

const VOID = new Set(['br','hr','img','input','meta','link','area','base','col','embed','param','source','track','wbr']);

function balanceTags(html) {
  const stack = [];
  const re = /<\/?([a-zA-Z][\w-]*)(?:\s[^>]*)?\/?>/g;
  let m;
  while ((m = re.exec(html))) {
    const tag = m[1].toLowerCase();
    if (m[0].endsWith('/>') || VOID.has(tag)) continue;
    if (m[0].startsWith('</')) {
      const idx = stack.lastIndexOf(tag);
      if (idx >= 0) stack.length = idx;
    } else {
      stack.push(tag);
    }
  }
  return html + stack.reverse().map(t => `</${t}>`).join('');
}

function normalizeText(html) {
  if (!html) return '';
  const dom = new JSDOM(`<body>${html}</body>`);
  return (dom.window.document.body.textContent ?? '').replace(/\s+/g, ' ').trim();
}

const indexRaw = JSON.parse(await fs.readFile(path.join(DIR, 'index.json'), 'utf8'));
const answerEntries = indexRaw.filter(e => !e.final).sort((a, b) => a.elapsed_ms - b.elapsed_ms);
const finalEntry  = indexRaw.find(e => e.final);
if (!finalEntry) { console.error('❌ Нет final.html в index.json'); process.exit(2); }

const finalHtml = await fs.readFile(path.join(DIR, finalEntry.file), 'utf8');
const finalText = normalizeText(finalHtml);

console.log(`\nAnswer-снапшотов: ${answerEntries.length}`);
console.log(`Финальный текст: ${finalText.length} симв.`);
console.log(`Первые 120 симв. финала: "${finalText.slice(0, 120)}…"\n`);

let fail = 0;
let prevLen = 0;

for (const e of answerEntries) {
  const raw  = await fs.readFile(path.join(DIR, e.file), 'utf8');
  const text = normalizeText(balanceTags(raw));
  const problems = [];

  if (!finalText.startsWith(text)) {
    let i = 0;
    while (i < text.length && i < finalText.length && text[i] === finalText[i]) i++;
    problems.push(`НЕ префикс финала. Расхождение @${i}: live="${text.slice(i, i + 40)}" vs final="${finalText.slice(i, i + 40)}"`);
  }
  if (text.length < prevLen) {
    problems.push(`Длина уменьшилась ${prevLen} → ${text.length} (мерцание / stale-перезапись)`);
  }

  if (problems.length) {
    fail++;
    console.log(`❌ ${e.file}  (+${e.elapsed_ms}ms, ${e.len}b)`);
    for (const p of problems) console.log(`     • ${p}`);
  } else {
    console.log(`✓  ${e.file}  (+${e.elapsed_ms}ms, ${e.len}b → ${text.length} симв.)`);
  }
  prevLen = text.length;
}

console.log(`\n─── Итог ───`);
if (fail === 0) {
  console.log(`✅ Все ${answerEntries.length} answer-снапшотов: префикс финала + монотонный рост.`);
  console.log(`   Регрессия live-стрима по форматированию НЕ обнаружена.`);
  process.exit(0);
} else {
  console.log(`❌ ${fail}/${answerEntries.length} снапшотов с регрессиями.`);
  process.exit(1);
}