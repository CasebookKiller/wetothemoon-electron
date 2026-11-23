// scripts/mjs/md-pipeline-compare.mjs
/**
 * @name md-pipeline-compare
 * @purpose Сравнение 4 слоёв (IDB/PW/DB/GW-DOM) из md-recon/pipeline/ + первая точка разрыва по парам
 * @input (нет аргументов; читает md-recon/pipeline/{A-indexeddb-raw,B-pw-fullhtml,C-db-html,D-gw-dom}.{json,html})
 * @output stdout: таблица 4 слоёв, диффы по парам, позиции разрывов
 * @args null
 * @result null
 * @exit 0 — успех (даже при расхождениях)
 * @tool false
 * @example node scripts/mjs/md-pipeline-compare.mjs
 */
import fs from 'node:fs';

const D = 'md-recon/pipeline';
const read = (n) => {
  const p = `${D}/${n}.json`;
  if (!fs.existsSync(p)) return null;
  const j = JSON.parse(fs.readFileSync(p, 'utf8'));
  j.html = fs.existsSync(`${D}/${n}.html`) ? fs.readFileSync(`${D}/${n}.html`, 'utf8') : '';
  return j;
};

const A = read('A-indexeddb-raw');
const B = read('B-pw-fullhtml');
const C = read('C-db-html');
const D_ = read('D-gw-dom');

console.log('\n══════ 4 СЛОЯ ══════');
for (const [k, v] of [['A IDB', A], ['B PW-fullHtml', B], ['C DB', C], ['D GW-DOM', D_]]) {
  if (!v) { console.log(`  ${k.padEnd(16)} ❌ нет данных`); continue; }
  const m = v.metrics;
  console.log(`  ${k.padEnd(16)} len=${String(m.length).padStart(5)}  p=${m.dsParagraphs} ul=${m.ul} tbl=${m.table} tok=${m.tokens} katex=${m.katex} pre=${m.pre} code=${m.code}`);
}

// Ключевые пары
const pairs = [
  ['B', B, 'C', C, 'extraction/parseMessageHtml'],
  ['C', C, 'D', D_, 'React render (GatewayMessageAssistant)'],
  ['B', B, 'D', D_, 'ИТОГОВОЕ (PW ↔ GW)'],
];

console.log('\n══════ ГДЕ РВЁТСЯ ══════');
for (const [na, a, nb, b, what] of pairs) {
  if (!a || !b) { console.log(`  ${what}: ⏭ нет данных`); continue; }
  const keys = ['length','dsParagraphs','mdCodeBlocks','tokens','katex','pre','code','table','ol','ul','li','h1','h2','h3','strong'];
  const diffs = keys.filter((k) => a.metrics[k] !== b.metrics[k]);
  if (diffs.length === 0) console.log(`  ${na} ↔ ${nb}  ✅  ${what}: OK`);
  else console.log(`  ${na} ↔ ${nb}  ⚠️  ${what}: расходится [${diffs.join(', ')}]`);
}

// Точная позиция
function firstDiff(a, b) {
  if (!a || !b) return -1;
  const A = a.html, B_ = b.html;
  let i = 0; while (i < A.length && i < B_.length && A[i] === B_[i]) i++;
  return i;
}

for (const [na, a, nb, b] of [['B', B, 'C', C], ['C', C, 'D', D_], ['B', B, 'D', D_]]) {
  if (!a || !b) continue;
  const i = firstDiff(a, b);
  if (i < 0 || (i >= a.html.length && i >= b.html.length)) continue;
  if (i === 0 && a.html === b.html) continue;
  console.log(`\n  ${na} vs ${nb}  первый разрыв на pos ${i}:`);
  console.log(`    ${na}: ...${a.html.slice(Math.max(0, i - 60), i + 100)}...`);
  console.log(`    ${nb}: ...${b.html.slice(Math.max(0, i - 60), i + 100)}...`);
}