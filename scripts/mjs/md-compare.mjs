// scripts/mjs/md-compare.mjs
/**
 * @name md-compare
 * @purpose Сравнение 3 дампов (PW/DB/DOM) по metrics/classes/tags + первая различающаяся подстрока
 * @input argv: [pwPath] [dbPath] [domPath] (defaults md-recon/{pw,db,dom}-dump.json)
 * @output stdout: metrics diff, потерянные/добавленные классы, теги, first-diff позиция
 * @args { "type": "object", "properties": { "pwPath": { "type": "string" }, "dbPath": { "type": "string" }, "domPath": { "type": "string" } } }
 * @result null
 * @exit 0 — всё совпадает
 * @exit 1 — есть расхождения / нет pw-dump
 * @tool false
 * @example node scripts/mjs/md-compare.mjs md-recon/pw-dump.json md-recon/gw-db-dump.json md-recon/gw-dom-dump.json
 */
import fs from 'node:fs';

const args = process.argv.slice(2);
const [pwPath, dbPath, domPath] = args.length
  ? args
  : ['md-recon/pw-dump.json', 'md-recon/gw-db-dump.json', 'md-recon/gw-dom-dump.json'];

const read = (p) => fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : null;
const pw = read(pwPath), db = read(dbPath), dom = read(domPath);
if (!pw) { console.error('❌ нет pw-dump:', pwPath); process.exit(1); }

const strip = (h) => (h || '').replace(/\s+/g, ' ').trim();

function comparePair(labelA, a, labelB, b) {
  if (!a || !b) { console.log(`\n⏭  ${labelA} vs ${labelB}: нет данных`); return; }
  console.log(`\n===== ${labelA} vs ${labelB} =====`);

  // 1. Метрики
  console.log('📊 metrics:');
  const keys = new Set([...Object.keys(a.metrics || {}), ...Object.keys(b.metrics || {})]);
  let bad = 0;
  for (const k of [...keys].sort()) {
    const va = a.metrics?.[k] ?? '-', vb = b.metrics?.[k] ?? '-';
    const mark = (typeof va === 'number' && typeof vb === 'number' && va !== vb) ? '  ⚠️' : '';
    if (mark) bad++;
    console.log(`  ${k.padEnd(16)} ${String(va).padStart(6)}  ${String(vb).padStart(6)}${mark}`);
  }

  // 2. Классы
  const ca = new Set(a.allClasses || []), cb = new Set(b.allClasses || []);
  const lost = [...ca].filter((x) => !cb.has(x));
  const gained = [...cb].filter((x) => !ca.has(x));
  console.log(`\n🏷  классы ${labelA} → ${labelB}:`);
  console.log(`  потеряно (${lost.length}):`, lost.length ? lost.slice(0, 30) : '—');
  console.log(`  добавлено (${gained.length}):`, gained.length ? gained.slice(0, 30) : '—');
  if (lost.length) bad++;

  // 3. Теги
  console.log(`\n🏷  теги ${labelA} → ${labelB}:`);
  const tags = new Set([...Object.keys(a.tagCounts || {}), ...Object.keys(b.tagCounts || {})]);
  for (const t of [...tags].sort()) {
    const va = a.tagCounts?.[t] || 0, vb = b.tagCounts?.[t] || 0;
    if (va !== vb) { console.log(`  ${t.padEnd(8)} ${String(va).padStart(4)} → ${String(vb).padStart(4)}`); bad++; }
  }
  if (!bad) console.log('  ✅ теги совпадают');

  // 4. Первая различающаяся подстрока
  const ha = strip(a.contentHtml || a.mdOuterHtml || a.domOuterHtml);
  const hb = strip(b.contentHtml || b.mdOuterHtml || b.domOuterHtml);
  if (ha && hb && ha !== hb) {
    let i = 0; while (i < ha.length && i < hb.length && ha[i] === hb[i]) i++;
    console.log(`\n🔍 первое расхождение на позиции ${i}:`);
    console.log(`  ${labelA}: ...${ha.slice(Math.max(0, i - 40), i + 80)}...`);
    console.log(`  ${labelB}: ...${hb.slice(Math.max(0, i - 40), i + 80)}...`);
  } else if (ha === hb) {
    console.log('\n✅ HTML идентичен (после whitespace-normalize)');
  }

  return bad;
}

let totalBad = 0;
totalBad += comparePair('PW', pw, 'DB', db) ?? 0;
totalBad += comparePair('DB', db, 'DOM', dom) ?? 0;
totalBad += comparePair('PW', pw, 'DOM', dom) ?? 0;

console.log('\n================================');
if (totalBad === 0) console.log('✅ всё совпадает — баг в CSS, смотри ds-markdown-paragraph → .token/.katex в deepseek-theme');
else console.log(`⚠️  найдено ${totalBad} расхождений — см. выше, где именно рвётся (PW→DB или DB→DOM)`);
process.exit(totalBad === 0 ? 0 : 1);