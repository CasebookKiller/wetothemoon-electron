// scripts/test-send-message-api.mjs
// Имитирует то, что делает sendMessageViaApi в main-процессе:
// чат + onDelta-стриминг + запись usage в api-usage.jsonl.
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

// мини-клиент (тот же, что в deepseekApiService, но без electron.app)
const USAGE_FILE = path.join(os.homedir(), '.config/wetothemoon-electron/api-usage.jsonl');
const PRICING = {
  'deepseek-flash':  { hit: {off:0.003,peak:0.006}, miss:{off:0.15,peak:0.30}, out:{off:0.60,peak:1.20} },
  'deepseek-v4-pro': { hit: {off:0.022,peak:0.044}, miss:{off:0.66,peak:1.32}, out:{off:1.98,peak:3.96} },
};
const ALIAS = { 'deepseek-chat': 'deepseek-flash', 'deepseek-reasoner': 'deepseek-v4-pro' };
const pricingKey = (m) => PRICING[m] ? m : (ALIAS[m] || Object.keys(PRICING).find(k => m.startsWith(k)) || 'deepseek-flash');
function estimate(model, p, c, h, mi) {
  const pr = PRICING[pricingKey(model)], M = 1e6;
  return { off: (h/M)*pr.hit.off + (mi/M)*pr.miss.off + (c/M)*pr.out.off,
           peak:(h/M)*pr.hit.peak+ (mi/M)*pr.miss.peak+ (c/M)*pr.out.peak };
}

async function chat(apiKey, messages, { model='deepseek-flash', effort='high', max_tokens=8192, onDelta }={}) {
  const body = { model, messages, effort, max_tokens, stream: true, stream_options: { include_usage: true } };
  const res = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + apiKey },
    body: JSON.stringify(body),
  });
  if (!res.ok || !res.body) { let t=''; try{t=await res.text()}catch{}; throw new Error('HTTP '+res.status+' '+t.slice(0,300)); }
  const reader = res.body.getReader(); const dec = new TextDecoder();
  let buf='', content='', reasoning='', usage=null;
  while (true) {
    const { value, done } = await reader.read(); if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf('\n\n')) >= 0) {
      const chunk = buf.slice(0, i); buf = buf.slice(i + 2);
      for (const line of chunk.split('\n')) {
        if (!line.startsWith('data: ')) continue;
        const p = line.slice(6).trim(); if (p === '[DONE]') continue;
        try {
          const j = JSON.parse(p); const d = j.choices?.[0]?.delta ?? {};
          if (d.reasoning_content) { reasoning += d.reasoning_content; onDelta?.({reasoning:d.reasoning_content}); }
          if (d.content) { content += d.content; onDelta?.({content:d.content}); }
          if (j.usage) usage = j.usage;
        } catch {}
      }
    }
  }
  return { content, reasoning, usage };
}

// ── запускаем имитацию sendMessageViaApi ──
const t0 = Date.now();
let rChars = 0, cChars = 0;
const r = await chat(KEY, [{ role: 'user', content: 'Скажи одно слово: ping' }], {
  onDelta: (d) => { if (d.reasoning) { rChars++; process.stdout.write('·'); } if (d.content) { cChars++; process.stdout.write(d.content); } }
});
console.log('\n---');
console.log('reasoning:', r.reasoning.slice(0, 200));
console.log('content:  ', r.content.slice(0, 200));
console.log('usage:', JSON.stringify(r.usage));
console.log('latency:', Date.now() - t0, 'ms');

// учёт
const pT = r.usage.prompt_tokens ?? 0, cT = r.usage.completion_tokens ?? 0;
const rT = r.usage.completion_tokens_details?.reasoning_tokens ?? 0;
const hT = r.usage.prompt_cache_hit_tokens ?? r.usage.prompt_tokens_details?.cached_tokens ?? 0;
const mT = r.usage.prompt_cache_miss_tokens ?? Math.max(0, pT - hT);
const costs = estimate('deepseek-flash', pT, cT, hT, mT);
fs.appendFileSync(USAGE_FILE, JSON.stringify({
  ts: Date.now(), profileId: 'script-send-message', model: 'deepseek-flash', effort: 'high',
  promptTokens: pT, completionTokens: cT, reasoningTokens: rT,
  cacheHitTokens: hT, cacheMissTokens: mT,
  costOffPeakUsd: costs.off, costPeakUsd: costs.peak,
}) + '\n');

console.log('\n💰 cost off-peak: $' + costs.off.toFixed(8));
console.log('💰 cost peak:     $' + costs.peak.toFixed(8));
console.log('✅ sendMessageViaApi (имитация) работает');
