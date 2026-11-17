// scripts/test-deepseek-models.mjs
// Проверяет какие модели реально отвечают и как ведут себя.
import fs from 'node:fs';
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

// 1. полный список моделей
const r1 = await fetch('https://api.deepseek.com/models', { headers: { Authorization: 'Bearer ' + KEY } });
const j1 = await r1.json();
console.log('=== /models ===');
console.log(JSON.stringify(j1, null, 2));

// 2. короткий не-стриминговый запрос на каждую
const models = (j1.data || []).map(m => m.id);
for (const model of models) {
  console.log('\n=== ' + model + ' (non-stream) ===');
  try {
    const t0 = Date.now();
    const res = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + KEY },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: 'Ответь одним словом: ping' }],
        max_tokens: 30,
        stream: false,
      }),
      signal: AbortSignal.timeout(30000),
    });
    const j = await res.json();
    if (!res.ok) { console.log('HTTP', res.status, JSON.stringify(j).slice(0, 300)); continue; }
    const msg = j.choices?.[0]?.message ?? {};
    console.log('  text:', JSON.stringify((msg.content || '').slice(0, 120)));
    console.log('  reasoning:', JSON.stringify((msg.reasoning_content || '').slice(0, 120)));
    console.log('  usage:', j.usage);
    console.log('  latency:', Date.now() - t0, 'ms');
  } catch (e) { console.log('  err:', e.message); }
}

// 3. alias-модели (deepseek-chat / deepseek-reasoner) — если вдруг тоже работают
for (const alias of ['deepseek-chat', 'deepseek-reasoner']) {
  console.log('\n=== alias ' + alias + ' (non-stream) ===');
  try {
    const res = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + KEY },
      body: JSON.stringify({ model: alias, messages: [{ role: 'user', content: 'ping' }], max_tokens: 10, stream: false }),
      signal: AbortSignal.timeout(20000),
    });
    const j = await res.json();
    console.log('  HTTP', res.status, 'id:', j.choices?.[0]?.message?.content?.slice(0, 60));
  } catch (e) { console.log('  err:', e.message); }
}
