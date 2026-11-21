#!/usr/bin/env node
// @name test-parse-rate-limit
// @purpose Проверка парсера времени rate-limit DeepSeek (зеркало injectedScript.ts)
// @input argv: (нет)
// @args {"type":"object","properties":{}}
// @output stdout: строки ✓/✗; exit 0 если все ✓
// @result {"type":"object","properties":{"ok":{"type":"boolean"},"passed":{"type":"number"},"failed":{"type":"number"}}}
// @exit 0 — все ok, 1 — есть провалы
// @tool false
// @example node scripts/mjs/test-parse-rate-limit.mjs

// ВАЖНО: логика должна 1-в-1 совпадать с parseUntil в src/main/services/gateway/bridge/injectedScript.ts
const MONTHS_RU = { 'янв': 0, 'фев': 1, 'мар': 2, 'апр': 3, 'мая': 4, 'май': 4, 'июн': 5, 'июл': 6, 'авг': 7, 'сен': 8, 'окт': 9, 'ноя': 10, 'дек': 11 };
const RATE_FULL_RE = /(\d{1,2})\.(\d{2})\.(\d{4})[, ]+(?:в\s+)?(\d{1,2}):(\d{2})/i;
const RATE_MONTH_RE = /(\d{1,2})\s+(янв|фев|мар|апр|ма[йя]|июн|июл|авг|сен|окт|ноя|дек)[а-я]*\s*(\d{4})?[, ]+(?:в\s+)?(\d{1,2}):(\d{2})/i;
const RATE_TOMORROW_RE = /завтра[^\d]*(\d{1,2}):(\d{2})/i;
const RATE_TODAY_RE = /(?:сегодня[^\d]*)?в\s*(\d{1,2}):(\d{2})/i;
const RATE_RELATIVE_RE = /через\s+(\d+)\s*(час|часа|часов|мин|минут|минуты)/i;
const RATE_TRY_AGAIN_RE = /(?:try\s*again|retry|повторите)\s+(?:at|в|после)?\s*(\d{1,2}):(\d{2})/i;

function atLocal(y, mo, d, h, mi) {
  const dt = new Date(y, mo, d, h, mi, 0, 0);
  return isNaN(dt.getTime()) ? null : dt.getTime();
}
const RATE_EN_RE = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{1,2}),?\s+(\d{4})\s+at\s+(\d{1,2}):(\d{2})\b/i;
const MONTHS_EN = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
function parseUntil(t, nowMs = Date.now()) {
  const now = new Date(nowMs);
  const y = now.getFullYear(), mo = now.getMonth(), d = now.getDate();
  let m;
  if ((m = t.match(RATE_EN_RE)))        { const mi = MONTHS_EN[m[1].toLowerCase().slice(0,3)]; if (mi == null) return null; return atLocal(+m[3], mi, +m[2], +m[4], +m[5]); }
  if ((m = t.match(RATE_FULL_RE)))      return atLocal(+m[3], +m[2]-1, +m[1], +m[4], +m[5]);
  if ((m = t.match(RATE_MONTH_RE)))     { const mi = MONTHS_RU[m[2].toLowerCase().slice(0,3)]; if (mi == null) return null; return atLocal(m[3] ? +m[3] : y, mi, +m[1], +m[4], +m[5]); }
  if ((m = t.match(RATE_TOMORROW_RE)))  return atLocal(y, mo, d+1, +m[1], +m[2]);
  if ((m = t.match(RATE_RELATIVE_RE)))  { const n = +m[1]; return nowMs + (m[2].toLowerCase().startsWith('час') ? n*3600_000 : n*60_000); }
  if ((m = t.match(RATE_TRY_AGAIN_RE))) { const t1 = atLocal(y, mo, d, +m[1], +m[2]); return t1 == null ? null : (t1 > nowMs ? t1 : atLocal(y, mo, d+1, +m[1], +m[2])); }
  if ((m = t.match(RATE_TODAY_RE)))     { const t1 = atLocal(y, mo, d, +m[1], +m[2]); return t1 == null ? null : (t1 > nowMs ? t1 : atLocal(y, mo, d+1, +m[1], +m[2])); }
  return null;
}

const FIXED_NOW = new Date(2026, 10, 21, 15, 0, 0).getTime(); // 2026-11-21 15:00 MSK
const cases = [
  ["Лимит будет восстановлен: 21.11.2026 в 22:00", new Date(2026,10,21,22,0).getTime()],
  ["Лимит будет восстановлен 21.11.2026 22:00",     new Date(2026,10,21,22,0).getTime()],
  ["Лимит будет восстановлен: 21.11.2026, 22:00",   new Date(2026,10,21,22,0).getTime()],
  ["Лимит будет восстановлен: 21.11.2026 в 22:00 МСК", new Date(2026,10,21,22,0).getTime()],
  ["Лимит будет восстановлен через 2 часа",         FIXED_NOW + 2*3600_000],
  ["Лимит будет восстановлен через 15 минут",       FIXED_NOW + 15*60_000],
  ["Лимит будет восстановлен завтра в 22:00",       new Date(2026,10,22,22,0).getTime()],
  ["Лимит будет восстановлен 21 ноября 2026 в 22:00", new Date(2026,10,21,22,0).getTime()],
  ["Лимит будет восстановлен 21 ноября в 22:00",    new Date(2026,10,21,22,0).getTime()],
  ["Лимит будет восстановлен в 22:00",              new Date(2026,10,21,22,0).getTime()],
  ["Лимит будет восстановлен в 14:00",              new Date(2026,10,22,14,0).getTime()], // прошло → завтра
  ["Quota exceeded. Try again at 22:00",            new Date(2026,10,21,22,0).getTime()],
  ["Server is busy. Usage limit reached. Your limit will reset on Nov 22, 2026 at 20:00.", new Date(2026,10,22,20,0).getTime()],
  ["Your limit will reset on Nov 21, 2026 at 18:30.", new Date(2026,10,21,18,30).getTime()],
];
const negatives = [
  "Сервер занят, попробуйте позже",
  "Что-то другое",
];

let ok = 0, fail = 0;
for (const [t, exp] of cases) {
  const got = parseUntil(t, FIXED_NOW);
  const pass = got === exp;
  console.log((pass ? '✓' : '✗'), JSON.stringify(t), pass ? '→ ' + new Date(got).toISOString() : `got=${got} exp=${exp}`);
  pass ? ok++ : fail++;
}
for (const t of negatives) {
  const got = parseUntil(t, FIXED_NOW);
  const pass = got === null;
  console.log((pass ? '✓' : '✗'), JSON.stringify(t), pass ? '→ null' : '→ ' + new Date(got).toISOString());
  pass ? ok++ : fail++;
}
console.log(`\n${ok} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
