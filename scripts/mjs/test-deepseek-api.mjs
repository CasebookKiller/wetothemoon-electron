// scripts/mjs/test-deepseek-api.mjs
/**
 * @name test-deepseek-api
 * @purpose Смоук DeepSeek API: GET /models + POST /chat/completions (stream) + печать usage и latency
 * @input env: DEEPSEEK_API_KEY или VITE_DEEPSEEK_API_KEY (через .env.local)
 * @output stdout: список моделей, stream-вывод, usage, latency, статус
 * @args null
 * @result null
 * @exit 0 — успех
 * @exit 1 — нет ключа / HTTP error
 * @tool false
 * @example node scripts/mjs/test-deepseek-api.mjs
 */// Смоук официального DeepSeek API. Ключ из .env.local или env.
// Поддерживаем оба имени: DEEPSEEK_API_KEY и VITE_DEEPSEEK_API_KEY.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../..');
const envPath = path.join(ROOT, '.env.local');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const KEY = process.env.DEEPSEEK_API_KEY || process.env.VITE_DEEPSEEK_API_KEY;
if (!KEY || !KEY.startsWith('sk-')) {
  console.error('❌ Не найден DEEPSEEK_API_KEY / VITE_DEEPSEEK_API_KEY (env или .env.local)');
  console.error('   process.env.DEEPSEEK_API_KEY       =', JSON.stringify(process.env.DEEPSEEK_API_KEY));
  console.error('   process.env.VITE_DEEPSEEK_API_KEY  =', JSON.stringify(process.env.VITE_DEEPSEEK_API_KEY?.slice(0, 8) + '…' ?? null));
  process.exit(1);
}

console.log('🔑 key: ' + KEY.slice(0, 8) + '…  (len ' + KEY.length + ')');

const mRes = await fetch('https://api.deepseek.com/models', {
  headers: { Authorization: 'Bearer ' + KEY }, signal: AbortSignal.timeout(10000),
});
console.log('GET /models → ' + mRes.status);
if (!mRes.ok) { console.error(await mRes.text()); process.exit(1); }
const mJson = await mRes.json();
console.log('models:', (mJson.data || []).map(m => m.id).join(', '));

console.log('\nPOST /chat/completions (stream):');
const res = await fetch('https://api.deepseek.com/chat/completions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + KEY },
  body: JSON.stringify({
    model: 'deepseek-chat',
    messages: [{ role: 'user', content: 'Скажи "pong" и назови текущий год.' }],
    stream: true, max_tokens: 100,
    stream_options: { include_usage: true },
  }),
  signal: AbortSignal.timeout(60000),
});
if (!res.ok || !res.body) { console.error('HTTP ' + res.status, await res.text().catch(()=> '')); process.exit(1); }

const reader = res.body.getReader();
const dec = new TextDecoder();
let buf = '', all = '', t0 = Date.now();
while (true) {
  const { value, done } = await reader.read();
  if (done) break;
  buf += dec.decode(value, { stream: true });
  let idx;
  while ((idx = buf.indexOf('\n\n')) >= 0) {
    const chunk = buf.slice(0, idx); buf = buf.slice(idx + 2);
    for (const line of chunk.split('\n')) {
      if (!line.startsWith('data: ')) continue;
      const p = line.slice(6).trim();
      if (p === '[DONE]') { console.log('\n[DONE]'); continue; }
      try {
        const j = JSON.parse(p);
        const d = j.choices?.[0]?.delta ?? {};
        if (d.content) { all += d.content; process.stdout.write(d.content); }
        if (j.usage) console.log('\nusage:', j.usage);
      } catch {}
    }
  }
}
console.log('\n---\nlatency: ' + (Date.now() - t0) + 'ms, chars: ' + all.length);
console.log('✅ API работает');
