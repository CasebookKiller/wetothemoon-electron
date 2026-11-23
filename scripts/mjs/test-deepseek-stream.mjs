// scripts/mjs/test-deepseek-stream.mjs
/**
 * @name test-deepseek-stream
 * @purpose Стриминг reasoning vs content на deepseek-flash/v4-pro при разных effort/max_tokens; timing первого чанка
 * @input env: DEEPSEEK_API_KEY или VITE_DEEPSEEK_API_KEY
 * @output stdout: reasoning/content/usage/timing по трём прогонам
 * @args null
 * @result null
 * @exit 0 — успех
 * @exit 1 — нет ключа / HTTP error
 * @tool false
 * @example node scripts/mjs/test-deepseek-stream.mjs
 */
// Стриминг: reasoning vs content, на обеих моделях.
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

async function run(model, effort, max_tokens) {
  console.log('\n=== ' + model + '  effort=' + (effort || '-') + '  max_tokens=' + max_tokens + ' ===');
  const t0 = Date.now();
  const body = {
    model,
    messages: [{ role: 'user', content: 'Назови три столицы Европы через запятую. Без объяснений.' }],
    stream: true, max_tokens, stream_options: { include_usage: true },
  };
  if (effort) body.effort = effort;

  const res = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + KEY },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120000),
  });
  if (!res.ok || !res.body) { console.error('HTTP', res.status, await res.text().catch(()=> '')); return; }

  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '', reasoning = '', content = '', firstContentMs = -1, firstReasoningMs = -1, usage = null;
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
          if (d.reasoning_content) {
            reasoning += d.reasoning_content;
            if (firstReasoningMs < 0) firstReasoningMs = Date.now() - t0;
          }
          if (d.content) {
            content += d.content;
            if (firstContentMs < 0) firstContentMs = Date.now() - t0;
          }
          if (j.usage) usage = j.usage;
        } catch {}
      }
    }
  }
  console.log('  reasoning (' + reasoning.length + ' chars, first @' + firstReasoningMs + 'ms):');
  console.log('    ' + reasoning.slice(0, 300).replace(/\n/g, '\n    '));
  console.log('  content (' + content.length + ' chars, first @' + firstContentMs + 'ms):');
  console.log('    ' + content.slice(0, 300).replace(/\n/g, '\n    '));
  console.log('  usage:', JSON.stringify(usage));
  console.log('  total:', Date.now() - t0, 'ms');
}

await run('deepseek-flash', 'low', 2048);
await run('deepseek-flash', 'high', 4096);
await run('deepseek-v4-pro', 'high', 8192);
