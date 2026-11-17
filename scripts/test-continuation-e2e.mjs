// scripts/test-continuation-e2e.mjs
// Берёт готовый continuation-*.md и шлёт его в API как system prompt.
// Вопрос — «продолжаем?», ждём план из 3-5 шагов в контексте gateway.

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
const KEY = (process.env.DEEPSEEK_API_KEY || process.env.VITE_DEEPSEEK_API_KEY || '').trim();
if (!KEY) { console.error('❌ нет ключа'); process.exit(1); }

// берём самый свежий continuation-*.md
const OUT_DIR = path.join(process.cwd(), 'recon-output');
const files = fs.readdirSync(OUT_DIR).filter(f => f.startsWith('continuation-') && f.endsWith('.md'));
if (files.length === 0) { console.error('❌ нет continuation-*.md, сначала запусти export-continuation-prompt.mjs'); process.exit(1); }
const latest = files.sort().pop();
const promptPath = path.join(OUT_DIR, latest);
const systemPrompt = fs.readFileSync(promptPath, 'utf8');

console.log('📄 prompt:', promptPath);
console.log('   размер:', Buffer.byteLength(systemPrompt, 'utf8'), 'байт');
console.log();

const USER_QUESTION = process.argv[2] || 'Продолжаем разработку. Что делаем дальше? Дай план из 3-5 шагов.';

const body = {
  model: 'deepseek-flash',
  effort: 'low',
  max_tokens: 4096,
  stream: true,
  stream_options: { include_usage: true },
  messages: [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: USER_QUESTION },
  ],
};

console.log('❓ вопрос:', USER_QUESTION);
console.log('\n=== ОТВЕТ ===');

const res = await fetch('https://api.deepseek.com/chat/completions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + KEY },
  body: JSON.stringify(body),
  signal: AbortSignal.timeout(120000),
});
if (!res.ok || !res.body) { console.error('HTTP', res.status, await res.text().catch(()=> '')); process.exit(1); }

const reader = res.body.getReader();
const dec = new TextDecoder();
let buf = '', content = '', reasoning = '', usage = null;
const t0 = Date.now();
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
        if (d.content) { content += d.content; process.stdout.write(d.content); }
        if (j.usage) usage = j.usage;
      } catch {}
    }
  }
}

console.log('\n\n=== СТАТИСТИКА ===');
console.log('latency:', Date.now() - t0, 'ms');
console.log('reasoning:', reasoning.length, 'симв.');
console.log('content:', content.length, 'симв.');
console.log('usage:', JSON.stringify(usage));

// проверка: модель должна упомянуть хотя бы 2 ключевых слова из контекста
const KEYWORDS = ['patchright', 'api', 'contextBuilder', 'workspace', 'gateway', 'continuation', 'pipeline', 'tasks', 'context'];
const found = KEYWORDS.filter(k => content.toLowerCase().includes(k.toLowerCase()));
console.log('\n=== ПРОВЕРКА КОНТЕКСТА ===');
console.log('упомянуто ключевых слов:', found.length, '/', KEYWORDS.length, '→', found.join(', '));
if (found.length >= 2) {
  console.log('✅ модель в контексте (упомянуто >= 2 специфичных терминов)');
} else {
  console.log('⚠️ модель отвечает общими словами — контекст плохо работает или вопрос слишком общий');
}
