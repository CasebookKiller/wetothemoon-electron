// scripts/test-api-usage.mjs
// Проверка учёта расхода: делает 1 запрос, показывает summary+budget.
// DEEPSEEK_BUDGET_USD — задай в .env.local для проверки бюджета.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const KEY = (process.env.DEEPSEEK_API_KEY || process.env.VITE_DEEPSEEK_API_KEY || '').trim();
if (!KEY) { console.error('❌ нет ключа'); process.exit(1); }

const USAGE_FILE = path.join(os.homedir(), '.config/wetothemoon-electron/api-usage.jsonl');
const BUDGET_TOTAL = parseFloat(process.env.DEEPSEEK_BUDGET_USD || '10.40');

// ── повторяем логику estimateCost ──
const PRICING = {
  'deepseek-flash':     { hit: { off: 0.003, peak: 0.006 }, miss: { off: 0.15, peak: 0.30 }, out: { off: 0.60, peak: 1.20 } },
  'deepseek-v4-pro':    { hit: { off: 0.022, peak: 0.044 }, miss: { off: 0.66, peak: 1.32 }, out: { off: 1.98, peak: 3.96 } },
};
const ALIAS = { 'deepseek-chat': 'deepseek-flash', 'deepseek-reasoner': 'deepseek-v4-pro' };
function pricingKey(m) {
  if (PRICING[m]) return m;
  if (ALIAS[m]) return ALIAS[m];
  for (const k of Object.keys(PRICING)) if (m.startsWith(k)) return k;
  return 'deepseek-flash';
}
function isPeak(ts) {
  const d = new Date(ts); const m = d.getUTCHours() * 60 + d.getUTCMinutes();
  return m >= 30 && m < 16 * 60 + 30;
}
function estimate(model, promptTokens, completionTokens, cacheHit, cacheMiss) {
  const p = PRICING[pricingKey(model)]; const M = 1e6;
  return {
    off: (cacheHit / M) * p.hit.off  + (cacheMiss / M) * p.miss.off  + (completionTokens / M) * p.out.off,
    peak:(cacheHit / M) * p.hit.peak + (cacheMiss / M) * p.miss.peak + (completionTokens / M) * p.out.peak,
  };
}

// ── делаем запрос ──
const model = process.argv[2] || 'deepseek-flash';
const effort = process.argv[3] || 'low';
console.log('model:', model, 'effort:', effort);

const res = await fetch('https://api.deepseek.com/chat/completions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + KEY },
  body: JSON.stringify({
    model, effort,
    messages: [{ role: 'user', content: 'Ответь одним словом: ping' }],
    stream: true, max_tokens: 1024,
    stream_options: { include_usage: true },
  }),
});
if (!res.ok || !res.body) { console.error('HTTP', res.status); process.exit(1); }

const reader = res.body.getReader(); const dec = new TextDecoder();
let buf = '', reasoning = '', content = '', usage = null;
while (true) {
  const { value, done } = await reader.read();
  if (done) break;
  buf += dec.decode(value, { stream: true });
  let i;
  while ((i = buf.indexOf('\n\n')) >= 0) {
    const chunk = buf.slice(0, i); buf = buf.slice(i + 2);
    for (const line of chunk.split('\n')) {
      if (!line.startsWith('data: ')) continue;
      const p = line.slice(6).trim();
      if (p === '[DONE]') continue;
      try {
        const j = JSON.parse(p);
        const d = j.choices?.[0]?.delta ?? {};
        if (d.reasoning_content) reasoning += d.reasoning_content;
        if (d.content) content += d.content;
        if (j.usage) usage = j.usage;
      } catch {}
    }
  }
}
console.log('reasoning:', reasoning.slice(0, 120));
console.log('content:', content.slice(0, 120));
console.log('usage:', usage);

// ── локальная запись (эмулируем то, что делает recordUsage) ──
const ts = Date.now();
const promptTokens = usage.prompt_tokens ?? 0;
const completionTokens = usage.completion_tokens ?? 0;
const reasoningTokens = usage.completion_tokens_details?.reasoning_tokens ?? 0;
const cacheHitTokens = usage.prompt_cache_hit_tokens ?? usage.prompt_tokens_details?.cached_tokens ?? 0;
const cacheMissTokens = usage.prompt_cache_miss_tokens ?? Math.max(0, promptTokens - cacheHitTokens);
const costs = estimate(model, promptTokens, completionTokens, cacheHitTokens, cacheMissTokens);
const rec = {
  ts, profileId: 'script-test', model, effort,
  promptTokens, completionTokens, reasoningTokens,
  cacheHitTokens, cacheMissTokens,
  costOffPeakUsd: costs.off, costPeakUsd: costs.peak,
};

// только для теста: пишем в тот же файл, что и main, чтобы увидеть как работает учёт
fs.mkdirSync(path.dirname(USAGE_FILE), { recursive: true });
fs.appendFileSync(USAGE_FILE, JSON.stringify(rec) + '\n', 'utf8');

console.log('\n💰 cost off-peak: $' + costs.off.toFixed(8));
console.log('💰 cost peak:     $' + costs.peak.toFixed(8));
console.log('📒 записано в:', USAGE_FILE);

// ── summary ──
const lines = fs.existsSync(USAGE_FILE) ? fs.readFileSync(USAGE_FILE, 'utf8').split('\n').filter(Boolean) : [];
let offSum = 0, peakSum = 0; const byModel = {};
for (const line of lines) {
  try {
    const r = JSON.parse(line);
    offSum += r.costOffPeakUsd || 0; peakSum += r.costPeakUsd || 0;
    const k = r.model; byModel[k] = byModel[k] || { n: 0, off: 0, peak: 0 };
    byModel[k].n++; byModel[k].off += r.costOffPeakUsd || 0; byModel[k].peak += r.costPeakUsd || 0;
  } catch {}
}

console.log('\n=== SUMMARY (все записи в файле) ===');
console.log('records:', lines.length);
console.log('total off-peak: $' + offSum.toFixed(6));
console.log('total peak:     $' + peakSum.toFixed(6));
for (const [k, v] of Object.entries(byModel)) {
  console.log('  ' + k + ': ' + v.n + ' запросов, off $' + v.off.toFixed(6) + ', peak $' + v.peak.toFixed(6));
}
const worst = Math.max(offSum, peakSum);
console.log('\n💵 Бюджет: $' + BUDGET_TOTAL.toFixed(2) + ' - $' + worst.toFixed(6) + ' = $' + (BUDGET_TOTAL - worst).toFixed(4) + ' остаток (worst-case)');
console.log('✅ done');
