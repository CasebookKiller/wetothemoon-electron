// scripts/mjs/recon-filter-discovered.mjs
/**
 * @name recon-filter-discovered
 * @purpose Фильтр discovered.json: blacklist (фреймворки/docs/соцсети/медиа), dedupe по домену, split chat/api
 * @input recon-free-llms.discovered.json (в scripts/, рядом с родителем)
 * @output recon-free-llms.filtered.json (в scripts/, рядом с родителем)
 * @args null
 * @result null
 * @exit 0 — успех
 * @exit 1 — ошибка (нет discovered.json / JSON parse)
 * @tool false
 * @example node scripts/mjs/recon-filter-discovered.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DISCOVERED_PATH = path.join(__dirname, '..', 'recon-free-llms.discovered.json');
const FILTERED_PATH = path.join(__dirname, '..', 'recon-free-llms.filtered.json');

// ─── Мусор: репозитории, docs, статьи, соцсети, служебные страницы ───
const BLACKLIST_PATTERNS = [
  /github\.com/i, /gitlab\.com/i, /bitbucket\.org/i,
  /t\.me\//i, /telegram/i, /twitter\.com/i, /\bx\.com/i,
  /reddit\.com/i, /youtube\.com/i, /youtu\.be/i,
  /discord\.com/i, /discord\.gg/i,
  /medium\.com/i, /dev\.to/i, /hashnode/i, /substack\.com/i,
  /\/blog\b/i, /\/docs?\b/i, /\/documentation/i, /\/wiki\b/i,
  /\/pricing\b/i, /\/about\b/i, /\/faq\b/i, /\/terms\b/i, /\/privacy\b/i,
  /\/login\b/i, /\/signup\b/i, /\/sign-up\b/i, /\/register\b/i,
  /\/careers?\b/i, /\/jobs\b/i, /\/contact\b/i,
  /\/changelog\b/i, /\/roadmap\b/i, /\/status\b/i,
  /npmjs\.com/i, /pypi\.org/i, /crates\.io/i,
  /producthunt\.com/i, /news\.ycombinator/i,
  /arxiv\.org/i, /wikipedia\.org/i, /stackoverflow/i,
  /linkedin\.com/i, /facebook\.com/i, /instagram\.com/i,
  /openai\.com/i, /anthropic\.com/i, /google\.com/i,
  /huggingface\.co\/(?!chat)/i,
];

const BLACKLIST_HOSTS = new Set([
  'example.com', 'localhost', '127.0.0.1',
  'fonts.google.com', 'cloudflare.com', 'vercel.com', 'netlify.com',
]);

// ─── Фреймворки, SDK, курсы, инфра — не чаты ───
const FRAMEWORK_BLACKLIST = [
  /langchain/i, /langgraph/i, /mastra\.ai/i, /dify\.ai/i, /dspy\.ai/i,
  /ludwig\.ai/i, /agenta\.ai/i, /litellm/i, /portkey/i, /openp\.ai/i,
  /arize\.com/i, /docling/i, /goose-docs/i,
  /lmstudio/i, /jan\.ai/i, /gpt4all/i, /librechat/i, /anythingllm/i,
  /lobehub/i, /aider\.chat/i, /opencode\.ai\/zen/i, /kilo\.ai/i, /glhf\.chat/i,
  /fast\.ai/i, /deeplearning\.ai/i, /karpathy/i, /promptingguide/i, /learnllm/i,
  /sambanova\.ai/i, /ovhcloud\.com/i, /chutes\.ai/i, /orcarouter/i,
  /requesty\.ai/i, /typesafe\.ai/i, /kavel\.ai/i, /aionlabs/i, /agnes-ai/i,
  /free\.ai\/developer/i, /ainative\.studio/i, /bfl\.ai/i, /lightning\.ai/i,
  /freellm\.net/i, /benchlm/i, /theaggregate/i, /open\.bigmodel\.cn/i,
  /longcat\.chat/i, /openrouter\.ai/i, /artificialanalysis\.ai/i,
  /yupp\.ai/i, /lmarena\.ai\/leaderboard/i, /pollinations\.ai\/models/i,
  /shields\.io/i,
];

// ─── Медиа-генераторы (картинки/видео/звук) — не чаты ───
const MEDIA_BLACKLIST = [
  /leonardo\.ai/i, /krea\.ai/i, /pixverse/i, /ideogram\.ai/i, /genmo\.ai/i,
  /uberduck/i, /fal\.ai/i, /flux/i,
];

// ─── Релевантные признаки чата ───
const CHAT_URL_PATTERNS = [
  /\/chat\b/i, /\/chat\//i,
  /^https?:\/\/(chat\.|duck\.|t3\.|arena\.|lmarena\.|huggingface\.co\/chat)/i,
  /^https?:\/\/(claude\.|gemini\.|chatgpt\.|copilot\.|perplexity\.|deepseek\.|qwen\.|grok\.|pi\.|meta\.)/i,
  /chatbot/i,
];

const API_URL_PATTERNS = [
  /\/v1\/chat\/completions/i,
  /\/v1\/models/i,
  /\/v1\/?$/i,
  /api\.(llm|openai|groq|together|fireworks|mistral|deepseek|anthropic)/i,
  /\/api\/(chat|generate|completions?)\b/i,
];

function isBlacklisted(url, name) {
  if (BLACKLIST_PATTERNS.some(p => p.test(url))) return true;
  if (FRAMEWORK_BLACKLIST.some(p => p.test(url))) return true;
  if (MEDIA_BLACKLIST.some(p => p.test(url))) return true;
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
    if (BLACKLIST_HOSTS.has(host)) return true;
    if (!/ai|llm|chat|gpt/i.test(host + ' ' + name)) return true;
  } catch { return true; }
  return false;
}

function dedupeByHost(items) {
  const seen = new Set();
  return items.filter(it => {
    try {
      const host = new URL(it.url).hostname.toLowerCase();
      if (seen.has(host)) return false;
      seen.add(host);
      return true;
    } catch { return false; }
  });
}

// ─── Main ─────────────────────────────────────────────────────────────

const raw = JSON.parse(fs.readFileSync(DISCOVERED_PATH, 'utf8'));
const all = raw.candidates || [];
console.log(`Исходно: ${all.length}`);

const filtered = all.filter(c => !isBlacklisted(c.url, c.name));
console.log(`После фильтра: ${filtered.length}`);

const deduped = dedupeByHost(filtered);
console.log(`После дедупа по домену: ${deduped.length}`);

// Уровень 2: только реальные чаты и API
const isRealChat = (url) => CHAT_URL_PATTERNS.some(p => p.test(url));
const isRealApi = (url) => API_URL_PATTERNS.some(p => p.test(url));

const api = deduped.filter(c => c.kind === 'api' || isRealApi(c.url));
const chats = deduped.filter(c => !api.includes(c) && isRealChat(c.url));

console.log(`\n=== API (${api.length}) ===`);
for (const c of api) console.log(`  ${c.url.padEnd(55)}  ${c.name}`);

console.log(`\n=== Чаты (${chats.length}) ===`);
for (const c of chats) console.log(`  ${c.url.padEnd(55)}  ${c.name}`);

fs.writeFileSync(FILTERED_PATH, JSON.stringify({
  version: 2,
  filteredAt: new Date().toISOString(),
  api, chats,
  totalBeforeFilter: all.length,
  totalAfterFilter: deduped.length,
}, null, 2), 'utf8');
console.log(`\n✅ → ${FILTERED_PATH}`);