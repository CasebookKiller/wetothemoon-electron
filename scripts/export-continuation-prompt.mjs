// scripts/export-continuation-prompt.mjs
// Собирает структурированный промпт для продолжения разработки.
// Использование:
//   node scripts/export-continuation-prompt.mjs [workspaceKeys] [taskTitle]
// Пример:
//   node scripts/export-continuation-prompt.mjs \
//     "wetothemoon-electron/gateway,wetothemoon-electron/gateway/api-channel" \
//     "Внедрение patchright + API-канал"

import fs from 'node:fs';
import path from 'node:path';

const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const MANIFEST = process.env.CONTEXT_MANIFEST;
const KEYS = (process.argv[2] || process.env.ACTIVE_WORKSPACE_KEYS || '').split(',').map(s => s.trim()).filter(Boolean);
const TASK = process.argv[3] || 'Продолжение разработки';
const MAX_BYTES = 20_000;

/** Бюджеты по kind (байты на узел). */
const BUDGET_BY_KIND = {
  global:    6000,
  project:   2000,
  submodule: 3000,
  module:    4000,
  direction: 3000,
};

function truncateMd(md, maxBytes) {
  if (!md) return '';
  if (Buffer.byteLength(md, 'utf8') <= maxBytes) return md;
  const lines = md.split('\n');
  let acc = '';
  for (const l of lines) {
    if (Buffer.byteLength(acc + l + '\n', 'utf8') > maxBytes - 40) break;
    acc += l + '\n';
  }
  return acc + '\n_[(контекст обрезан по бюджету)]_\n';
}

if (!MANIFEST || !fs.existsSync(MANIFEST)) { console.error('❌ CONTEXT_MANIFEST не задан или не найден'); process.exit(1); }
if (KEYS.length === 0) { console.error('❌ workspace keys пусты'); process.exit(1); }

const m = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
const nodes = m.nodes || [];

function findNode(k) { return nodes.find(n => n.key === k) || null; }
function chainOf(k) {
  const chain = []; const seen = new Set();
  let cur = findNode(k);
  while (cur) {
    if (seen.has(cur.key)) break;
    seen.add(cur.key);
    chain.unshift(cur);
    cur = cur.parent ? findNode(cur.parent) : null;
  }
  return chain;
}

// объединяем цепочки, дедуп, сортировка по глубине (для кэша)
const seen = new Set();
const chain = [];
for (const k of KEYS) {
  for (const n of chainOf(k)) {
    if (seen.has(n.key)) continue;
    seen.add(n.key);
    chain.push(n);
  }
}
chain.sort((a, b) => a.key.split('/').length - b.key.split('/').length);

// читаем файлы
function readNode(n) {
  const eff = n.summaryFile || n.file;
  if (!eff) return null;
  const abs = path.isAbsolute(eff) ? eff : path.join(m.root, eff);
  try { return fs.readFileSync(abs, 'utf8'); } catch { return null; }
}

// парсим roadmap-разделы: ✅ / 🎯 / «Ближайшие задачи»
function extractSections(md) {
  const out = { done: [], inProgress: [], next: [] };
  if (!md) return out;
  const lines = md.split('\n');
  let current = null;
  for (const line of lines) {
    // заголовки секций
    if (/^##\s/.test(line)) {
      const t = line.replace(/^##\s+/, '').toLowerCase();
      if (t.includes('выполнено') || t.includes('✅') || t.includes('done')) current = 'done';
      else if (t.includes('в работе') || t.includes('🎯') || t.includes('wip') || t.includes('in progress')) current = 'inProgress';
      else if (t.includes('ближайшие') || t.includes('next')) current = 'next';
      else current = null;
      continue;
    }
    if (!current) continue;
    // пункты списка
    const bullet = line.match(/^\s*[-*]\s+(?:\[[x ]\]\s+)?(.+)$/);
    if (bullet) out[current].push(bullet[1].trim());
  }
  return out;
}

// структурированный промпт
const parts = [];
parts.push(`# Продолжение разработки\n\n**Проект:** ${m.nodes.find(n => n.kind === 'project')?.title || 'wetothemoon'}\n**Workspace:** ${KEYS.join(' + ')}\n**Задача:** ${TASK}\n`);

// 1. Глобальные правила + project + submodule (с бюджетом на узел)
const globalNodes = chain.filter(n => ['global', 'project', 'submodule'].includes(n.kind));
for (const n of globalNodes) {
  const text = readNode(n);
  if (!text) continue;
  const budget = BUDGET_BY_KIND[n.kind] ?? 3000;
  const clipped = truncateMd(text, budget);
  parts.push(`## ${n.title}\n\n${clipped.trim()}\n`);
}

// 2. Активные modules с извлечением разделов
const activeNodes = chain.filter(n => ['module', 'direction'].includes(n.kind));
for (const n of activeNodes) {
  const text = readNode(n);
  if (!text) {
    parts.push(`## ${n.title}\n\n_(${n.key}; файл не задан, направление активно)_\n`);
    continue;
  }
  const sec = extractSections(text);
  const summary = [];

  if (sec.done.length > 0) {
    summary.push(`### ✅ Выполнено\n` + sec.done.slice(0, 10).map(x => `- ${x}`).join('\n'));
  }
  if (sec.inProgress.length > 0) {
    summary.push(`### 🎯 В работе\n` + sec.inProgress.slice(0, 10).map(x => `- ${x}`).join('\n'));
  }
  if (sec.next.length > 0) {
    summary.push(`### Ближайшие задачи\n` + sec.next.slice(0, 10).map(x => `- ${x}`).join('\n'));
  }

  if (summary.length === 0) {
    // fallback: первые N байт по бюджету kind
    const budget = BUDGET_BY_KIND[n.kind] ?? 3000;
    summary.push(truncateMd(text, budget).trim());
  }

  // на всякий случай ещё раз ограничиваем секции бюджетом
  const budget = BUDGET_BY_KIND[n.kind] ?? 3000;
  const combined = summary.join('\n\n');
  const clipped = truncateMd(combined, budget);
  parts.push(`## ${n.title}\n\n${clipped.trim()}\n`);
}

// 3. Инструкция
parts.push(`## Инструкция

1. Ознакомься с контекстом выше.
2. Предложи 3-5 конкретных следующих шагов по задаче «${TASK}».
3. Для каждого шага укажи:
   - **Что делаем** (одно предложение)
   - **Файлы/модули** (какие затронем)
   - **Зачем** (какой эффект)
4. В конце — вопрос: «Начинаем с шага 1?» (не пиши код, пока не подтвердят).

## Формат ответа
- Markdown.
- Без воды и общих фраз.
- Конкретные имена файлов, методов, переменных.
`);

let prompt = parts.join('\n\n---\n\n');
let bytes = Buffer.byteLength(prompt, 'utf8');

// жёсткий лимит: если превысили — обрезаем целиком и предупреждаем
if (bytes > MAX_BYTES) {
  console.warn(`⚠️  промпт ${bytes} байт > лимита ${MAX_BYTES} — принудительная обрезка.`);
  const lines = prompt.split('\n');
  let acc = '';
  for (const l of lines) {
    if (Buffer.byteLength(acc + l + '\n', 'utf8') > MAX_BYTES - 100) break;
    acc += l + '\n';
  }
  prompt = acc + '\n\n_[(промпт обрезан по глобальному лимиту)]_\n';
  bytes = Buffer.byteLength(prompt, 'utf8');
}

// сохраняем
const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const slug = KEYS[KEYS.length - 1].split('/').pop() || 'workspace';
const outDir = path.join(process.cwd(), 'recon-output');
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, `continuation-${slug}-${ts}.md`);
fs.writeFileSync(outPath, prompt);

console.log('✅ промпт продолжения собран');
console.log('   workspace:', KEYS.join(' + '));
console.log('   задача:  ', TASK);
console.log('   размер:  ', bytes, 'байт (~', Math.ceil(prompt.length / 3), 'токенов рус.)');
console.log('   файл:    ', outPath);
console.log();
console.log('📋 Готово к вставке в новый чат (или в API-чат после переключения).');
console.log('   Дальше:');
console.log('   1. Открой в новом чате web DeepSeek (или API-чате).');
console.log('   2. Вставь содержимое файла.');
console.log('   3. Получи план действий в контексте.');
