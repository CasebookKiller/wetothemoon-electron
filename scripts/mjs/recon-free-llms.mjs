// scripts/mjs/recon-free-llms.mjs
/**
 * @name recon-free-llms
 * @purpose Разведка бесплатных аналогов chat.deepseek.com: probe кандидатов + discovery из источников (JSON-API / markdown-raw)
 * @input argv: [--only web|api] [--filter name1,name2] [--discover]; читает recon-free-llms.candidates.json (scripts/)
 * @output stdout: таблица кандидатов; --discover → recon-free-llms.discovered.json (scripts/)
 * @args { "type": "object", "properties": { "only": { "enum": ["web", "api"] }, "filter": { "type": "string" }, "discover": { "type": "boolean", "default": false } } }
 * @result null
 * @exit 0 — успех
 * @exit 1 — не найден candidates.json
 * @tool false
 * @example node scripts/mjs/recon-free-llms.mjs --discover
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CANDIDATES_PATH = path.join(__dirname, '..', 'recon-free-llms.candidates.json');
const DISCOVERED_PATH = path.join(__dirname, '..', 'recon-free-llms.discovered.json');

function loadCandidates() {
  if (!fs.existsSync(CANDIDATES_PATH)) {
    console.error(`❌ Не найден ${CANDIDATES_PATH}`);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(CANDIDATES_PATH, 'utf8'));
}

function applyFilters(candidates) {
  const args = process.argv.slice(2);
  const onlyIdx = args.indexOf('--only');
  const filterIdx = args.indexOf('--filter');
  let out = candidates;
  if (onlyIdx !== -1 && args[onlyIdx + 1]) {
    out = out.filter(c => c.kind === args[onlyIdx + 1]);
    console.log(`🔎 Фильтр kind=${args[onlyIdx + 1]}`);
  }
  if (filterIdx !== -1 && args[filterIdx + 1]) {
    const needles = args[filterIdx + 1].toLowerCase().split(',').map(s => s.trim());
    out = out.filter(c => needles.some(n => c.name.toLowerCase().includes(n) || c.url.toLowerCase().includes(n)));
    console.log(`🔎 Фильтр по именам: ${needles.join(', ')}`);
  }
  return out;
}

async function probe(c) {
  const t0 = Date.now();
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(c.url, {
      method: 'GET',
      redirect: 'manual',
      signal: ctrl.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36' },
    });
    clearTimeout(timer);
    const loc = res.headers.get('location') || '';
    const ms = Date.now() - t0;
    let hint = '';
    if (res.status === 200) hint = '✅ доступен';
    else if (res.status === 301 || res.status === 302) hint = `↪ → ${loc.slice(0, 60)}`;
    else if (res.status === 401 || res.status === 403) hint = '🔒 требует ключ/логин';
    else if (res.status === 429) hint = '⏳ rate-limit';
    else hint = `⚠ статус ${res.status}`;
    return { ...c, status: res.status, location: loc, ms, hint };
  } catch (e) {
    return { ...c, status: 0, ms: Date.now() - t0, hint: `❌ ${e.name}: ${e.message.slice(0, 40)}` };
  }
}

// ─── Discovery ────────────────────────────────────────────────────────

function extractUrlsFromMarkdown(md) {
  const urls = [];
  const re = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g;
  let m;
  while ((m = re.exec(md)) !== null) {
    const [, label, url] = m;
    if (/chat|ai|llm|gpt|claude|gemini|deepseek|qwen|grok|perplexity|duck|hugging/i.test(label + ' ' + url)) {
      urls.push({ name: label.trim(), url: url.trim() });
    }
  }
  return urls;
}

async function discoverFromSource(source, existingUrls) {
  const found = [];
  try {
    const res = await fetch(source.url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36' },
    });
    if (!res.ok) {
      console.warn(`  ⚠ ${source.id}: HTTP ${res.status}`);
      return found;
    }

    if (source.kind === 'json-api') {
      const json = await res.json();
      // Поддерживаем несколько форматов: массив, {providers:[]}, {data:[]}
      const items = Array.isArray(json) ? json
        : Array.isArray(json.providers) ? json.providers
        : Array.isArray(json.data) ? json.data
        : [];
      for (const it of items) {
        const url = it.url || it.base_url || it.baseUrl || it.api || it.homepage;
        const name = it.name || it.id || it.title || 'unknown';
        if (url && /^https?:\/\//.test(url) && !existingUrls.has(url)) {
          found.push({
            name,
            url,
            kind: it.kind || (url.includes('/v1') || url.includes('/api') ? 'api' : 'web'),
            auth: it.auth || 'unknown',
            note: `discovered from ${source.id}`,
          });
        }
      }
    } else if (source.kind === 'markdown-raw') {
      const md = await res.text();
      const urls = extractUrlsFromMarkdown(md);
      for (const u of urls) {
        if (!existingUrls.has(u.url)) {
          const isApi = /\/v1|\/api|api\./i.test(u.url);
          found.push({
            name: u.name,
            url: u.url,
            kind: isApi ? 'api' : 'web',
            auth: 'unknown',
            note: `discovered from ${source.id}`,
          });
        }
      }
    }
  } catch (e) {
    console.warn(`  ⚠ ${source.id}: ${e.message}`);
  }
  return found;
}

async function runDiscovery(config) {
  const sources = config.discoverySources || [];
  if (sources.length === 0) {
    console.log('⚠ Нет discoverySources в JSON');
    return;
  }

  const existingUrls = new Set(config.candidates.map(c => c.url));
  const allFound = [];

  console.log(`\n🔭 Discovery из ${sources.length} источников\n`);
  for (const src of sources) {
    console.log(`  → ${src.id} (${src.kind})`);
    const found = await discoverFromSource(src, existingUrls);
    console.log(`     найдено: ${found.length}`);
    for (const f of found) {
      existingUrls.add(f.url); // чтобы не дублировать между источниками
      allFound.push(f);
    }
  }

  if (allFound.length === 0) {
    console.log('\n📭 Новых кандидатов не найдено');
    return;
  }

  const out = {
    version: 1,
    discoveredAt: new Date().toISOString(),
    note: 'Новые кандидаты из discoverySources. Проверь вручную и перенеси в candidates.',
    candidates: allFound,
  };
  fs.writeFileSync(DISCOVERED_PATH, JSON.stringify(out, null, 2), 'utf8');
  console.log(`\n✅ ${allFound.length} новых кандидатов → ${DISCOVERED_PATH}`);
  console.log('\n💡 Проверь файл, затем добавь нужных в recon-free-llms.candidates.json');
}

// ─── Main ─────────────────────────────────────────────────────────────

(async () => {
  const config = loadCandidates();
  const args = process.argv.slice(2);

  if (args.includes('--discover')) {
    await runDiscovery(config);
    return;
  }

  const list = applyFilters(config.candidates);
  console.log(`\n🔍 Разведка бесплатных LLM (${list.length}/${config.candidates.length} кандидатов)\n`);
  console.log(
    'Провайдер'.padEnd(18), 'Тип'.padEnd(5), 'Auth'.padEnd(8),
    'Статус'.padEnd(8), 'мс'.padEnd(6), 'Примечание'
  );
  console.log('─'.repeat(95));

  const results = await Promise.all(list.map(probe));
  for (const r of results) {
    console.log(
      r.name.padEnd(18), r.kind.padEnd(5), (r.auth || '?').padEnd(8),
      String(r.status).padEnd(8), String(r.ms).padEnd(6),
      r.hint + (r.note ? `  (${r.note})` : '')
    );
  }

  const alive = results.filter(r => r.status === 200 || (r.status >= 300 && r.status < 400));
  const api = alive.filter(r => r.kind === 'api');
  const web = alive.filter(r => r.kind === 'web');
  console.log(`\n📊 Живых: ${alive.length}/${results.length}  (web: ${web.length}, api: ${api.length})`);

  if (web.length > 0) {
    console.log('\n💡 Web-кандидаты (CDP):');
    for (const w of web) console.log('   • ' + w.name.padEnd(16) + w.url);
  }
  if (api.length > 0) {
    console.log('\n💡 API-кандидаты:');
    for (const a of api) console.log('   • ' + a.name.padEnd(16) + a.url);
  }
})();